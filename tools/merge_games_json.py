#!/usr/bin/env python3
"""Conservative, record-aware, three-way merge of The Gaming Emporium games.json.

Before Git merges the two branches:
    python3 tools/merge_games_json.py --git-revisions BASE LOCAL GITHUB OUTPUT.json

For an existing Git conflict:
    python3 tools/merge_games_json.py --git-index data/games.json

For testing/offline use:
    python3 tools/merge_games_json.py --files BASE.json LOCAL.json GITHUB.json OUT.json

The existing 'id' identifies an entry. Because some historic IDs are duplicated,
we preserve them by occurrence within that ID, refusing to merge if their
(title, link) identity has changed or if new duplicate IDs are introduced.

Only non-overlapping field edits and independent new IDs merge automatically.
Deletions, competing edits, and new ID collisions stop without writing a file.
"""

import argparse
from collections import Counter
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile


class UnsafeMerge(Exception):
    pass


ABSENT = object()


def parse(raw, label):
    try:
        entries = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise UnsafeMerge(f"{label}: invalid JSON: {exc}") from exc
    if not isinstance(entries, list):
        raise UnsafeMerge(f"{label}: expected a JSON list of game objects")
    for num, entry in enumerate(entries, 1):
        if not isinstance(entry, dict):
            raise UnsafeMerge(f"{label}: entry {num} is not an object")
        if type(entry.get('id')) is not int:
            raise UnsafeMerge(f"{label}: entry {num} has no integer id")
        if not isinstance(entry.get('title'), str) or not isinstance(entry.get('link'), str):
            raise UnsafeMerge(f"{label}: entry {num} has no text title/link")
    return entries


def indexed(entries, label, baseline_counts):
    counters = Counter()
    result = {}
    order = []
    for entry in entries:
        game_id = entry['id']
        number = counters[game_id]
        counters[game_id] += 1
        if game_id in baseline_counts and counters[game_id] > baseline_counts[game_id]:
            raise UnsafeMerge(
                f"{label}: new additional occurrence of existing ID {game_id}; manual review required"
            )
        if game_id not in baseline_counts and counters[game_id] > 1:
            raise UnsafeMerge(f"{label}: duplicate newly assigned ID {game_id}")
        key = (game_id, number)
        result[key] = entry
        order.append(key)
    return result, order


def merge_records(base, ours, theirs):
    """Return merged list or raise UnsafeMerge; never modify input lists."""
    baseline_counts = Counter(game['id'] for game in base)
    b, b_order = indexed(base, 'Base', baseline_counts)
    o, o_order = indexed(ours, 'Local', baseline_counts)
    t, t_order = indexed(theirs, 'GitHub', baseline_counts)

    for key in b_order:
        game_id, index = key
        if key not in o or key not in t:
            raise UnsafeMerge(
                f"ID {game_id} (occurrence {index + 1}) was deleted on one side; "
                "review it manually rather than risk losing a game"
            )
        if baseline_counts[game_id] > 1:
            fingerprint = (b[key]['title'], b[key]['link'])
            if ((o[key]['title'], o[key]['link']) != fingerprint
                    or (t[key]['title'], t[key]['link']) != fingerprint):
                raise UnsafeMerge(
                    f"ID {game_id} is an existing duplicated ID whose title/link "
                    "was modified or reordered; review manually"
                )
        # An apparent replacement under the same ID is not merged automatically.
        for side_label, game in [('Local', o[key]), ('GitHub', t[key])]:
            if game['title'] != b[key]['title'] and game['link'] != b[key]['link']:
                raise UnsafeMerge(
                    f"{side_label}: title AND link changed for ID {game_id}; "
                    "possible ID reuse, requires manual review"
                )

    output = []
    additions_local = 0
    additions_remote = 0
    merged_updates = 0
    keys_in_order = list(o_order) + [key for key in t_order if key not in o]
    for key in keys_in_order:
        game_id = key[0]
        base_entry = b.get(key)
        local_entry = o.get(key)
        remote_entry = t.get(key)

        if base_entry is None:
            if local_entry is None:
                additions_remote += 1
                output.append(dict(remote_entry))
            elif remote_entry is None:
                additions_local += 1
                output.append(dict(local_entry))
            elif local_entry == remote_entry:
                output.append(dict(local_entry))
            else:
                raise UnsafeMerge(
                    f"Both sides added different entries with the same new ID {game_id}; "
                    "manual ID assignment needed"
                )
            continue

        # Keep predictable key order and apply only safe, independent edits.
        key_order = dict.fromkeys([*base_entry, *local_entry, *remote_entry])
        result = {}
        for field in key_order:
            old = base_entry.get(field, ABSENT)
            local = local_entry.get(field, ABSENT)
            remote = remote_entry.get(field, ABSENT)
            if local == remote:
                selected = local
            elif local == old:
                selected = remote
            elif remote == old:
                selected = local
            else:
                raise UnsafeMerge(
                    f"Conflicting edits to ID {game_id} ({base_entry['title']!r}), "
                    f"field {field!r}; nothing was overwritten"
                )
            if selected is not ABSENT:
                result[field] = selected
        if result != base_entry:
            merged_updates += 1
        output.append(result)

    if len(output) < len(base):
        raise UnsafeMerge("Result unexpectedly lost game records")
    # Final self-check: all original identities still exist and no duplicate new IDs.
    merged, _ = indexed(output, 'Result', baseline_counts)
    if not set(b).issubset(merged):
        raise UnsafeMerge("Result is missing baseline game IDs")
    return output, additions_local, additions_remote, merged_updates


def git_revision(revision):
    cmd = ['git', 'show', f'{revision}:data/games.json']
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode:
        raise UnsafeMerge(
            f"Cannot read games.json at {revision}: "
            f"{proc.stderr.decode('utf-8', errors='replace').strip()}"
        )
    try:
        return proc.stdout.decode('utf-8')
    except UnicodeDecodeError as exc:
        raise UnsafeMerge(f"Revision {revision} is not UTF-8") from exc


def git_stage(path, number):
    cmd = ['git', 'show', f':{number}:{path}']
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode:
        raise UnsafeMerge(
            f"Cannot read Git's conflict stage {number} for {path}: "
            f"{proc.stderr.decode('utf-8', errors='replace').strip()}"
        )
    try:
        return proc.stdout.decode('utf-8')
    except UnicodeDecodeError as exc:
        raise UnsafeMerge(f"Git stage {number} is not UTF-8") from exc


def write_json_atomic(path, entries):
    destination = Path(path)
    parent = destination.parent
    original_mode = stat.S_IMODE(destination.stat().st_mode) if destination.exists() else 0o644
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8',
                                     dir=str(parent), prefix='.games-merge-',
                                     suffix='.json', delete=False) as tmp:
        tmp_path = Path(tmp.name)
        try:
            json.dump(entries, tmp, indent=2, ensure_ascii=False)
            tmp.write('\n')
            tmp.flush()
            os.fsync(tmp.fileno())
            os.chmod(tmp_path, original_mode)
        except BaseException:
            tmp_path.unlink(missing_ok=True)
            raise
    try:
        os.replace(tmp_path, destination)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--git-index', metavar='PATH',
                       help='Read stages 1 (base), 2 (local), and 3 (GitHub)')
    group.add_argument('--files', nargs=4, metavar=('BASE', 'LOCAL', 'GITHUB', 'OUTPUT'))
    group.add_argument('--git-revisions', nargs=4, metavar=('BASE', 'LOCAL', 'GITHUB', 'OUTPUT'))
    args = parser.parse_args()
    try:
        if args.git_index:
            out_path = args.git_index
            contents = [git_stage(out_path, n) for n in (1, 2, 3)]
        elif args.git_revisions:
            *revisions, out_path = args.git_revisions
            contents = [git_revision(rev) for rev in revisions]
        else:
            *paths, out_path = args.files
            contents = [Path(p).read_text(encoding='utf-8') for p in paths]
        base, local, remote = [parse(content, label) for content, label in
                               zip(contents, ('Base', 'Local', 'GitHub'))]
        result, local_added, remote_added, changed = merge_records(base, local, remote)
        write_json_atomic(out_path, result)
        print(f"Safe games.json merge: {len(result)} games; "
              f"{local_added} local additions, {remote_added} GitHub additions, "
              f"{changed} updated entries.")
    except (UnsafeMerge, OSError) as exc:
        print(f"SAFE MERGE STOPPED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
