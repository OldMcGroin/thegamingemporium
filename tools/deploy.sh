#!/usr/bin/env bash
set -euo pipefail

# The Gaming Emporium — safe Steam Deck / GitHub / Cloudflare deployment.
# Stops rather than choosing a winner when the same game field was edited
# differently locally and on GitHub.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[[ -d .git ]] || fail "This is not the Git repository: $ROOT"
[[ "$(git branch --show-current)" == "main" ]] || fail "Switch to the main branch before deploying."
[[ -n "$(git remote get-url origin 2>/dev/null || true)" ]] || fail "Git remote 'origin' is missing."

# Never stage files or start another rebase on top of an unfinished operation.
GIT_DIR="$(git rev-parse --git-dir)"
if [[ -d "$(git rev-parse --git-path rebase-merge)" || \
      -d "$(git rev-parse --git-path rebase-apply)" || \
      -f "$(git rev-parse --git-path MERGE_HEAD)" || \
      -f "$(git rev-parse --git-path CHERRY_PICK_HEAD)" ]]; then
  fail "A Git merge/rebase is already underway. Finish it before running deploy again."
fi
[[ -z "$(git ls-files -u)" ]] || fail "Unresolved Git conflicts exist. Resolve them before deploying."

if [[ -x "$HOME/bin/hugo" ]]; then
  HUGO_CMD="$HOME/bin/hugo"
elif command -v hugo >/dev/null 2>&1; then
  HUGO_CMD="hugo"
else
  fail "Hugo not found. Install Hugo Extended, or place it at $HOME/bin/hugo"
fi

# Avoid a dependency on extra files: merge the JSON during the rebase itself.
# The actual game list contains some reused IDs, so ID alone is NOT a safe key.
merge_games_json() {
  python3 - <<'PY'
import json
import os
import subprocess
import sys
import tempfile
from collections import defaultdict

PATH = 'data/games.json'
MISSING = object()

def get_stage(stage):
    raw = subprocess.check_output(['git', 'show', f':{stage}:{PATH}'])
    result = json.loads(raw)
    if not isinstance(result, list):
        raise ValueError(f'Stage {stage} does not contain a JSON list')
    return result

def keyed(games, label):
    counts = defaultdict(int)
    ordered = []
    result = {}
    for index, game in enumerate(games):
        if not isinstance(game, dict) or not all(k in game for k in ('id', 'title', 'link', 'category')):
            raise ValueError(f'Bad game record in {label}, item {index + 1}')
        # category separates entries that deliberately share ID, title and link.
        # occurrence index preserves even genuinely duplicated entries.
        stem = (str(game['id']), game['title'], game['link'], game['category'])
        occurrence = counts[stem]
        counts[stem] += 1
        key = (*stem, occurrence)
        ordered.append(key)
        result[key] = game
    return ordered, result

def short(key):
    return f'{key[1]} (ID {key[0]})'

def combine(base, remote, local, name):
    if remote == local:
        return remote
    if remote == base:
        return local
    if local == base:
        return remote
    if base is not MISSING and remote is not MISSING and local is not MISSING:
        if isinstance(base, dict) and isinstance(remote, dict) and isinstance(local, dict):
            merged = {}
            for k in dict.fromkeys([*base, *remote, *local]):
                new_value = combine(base.get(k, MISSING), remote.get(k, MISSING),
                                    local.get(k, MISSING), f'{name} / {k}')
                if new_value is not MISSING:
                    merged[k] = new_value
            return merged
    raise ValueError(f'Both versions changed the same information: {name}')

try:
    base_list, remote_list, local_list = (get_stage(i) for i in (1, 2, 3))
    base_order, base = keyed(base_list, 'common ancestor')
    remote_order, remote = keyed(remote_list, 'GitHub')
    local_order, local = keyed(local_list, 'Steam Deck')
    order = list(dict.fromkeys([*remote_order, *local_order, *base_order]))
    merged = []
    for key in order:
        value = combine(base.get(key, MISSING), remote.get(key, MISSING),
                        local.get(key, MISSING), short(key))
        if value is not MISSING:
            merged.append(value)
    # Validate the result before replacing the conflict-marked file.
    json.loads(json.dumps(merged, ensure_ascii=False))
    dirname = os.path.dirname(PATH)
    fd, temp = tempfile.mkstemp(prefix='.games-merge-', suffix='.json', dir=dirname)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)
            f.write('\n')
        os.replace(temp, PATH)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
    print(f'Automatically merged data/games.json: {len(merged)} game records preserved.')
except Exception as exc:
    print(f'Cannot safely auto-merge {PATH}: {exc}', file=sys.stderr)
    sys.exit(1)
PY
}

sync_from_github() {
  echo "Checking GitHub for new changes..."
  git fetch origin main || fail "Could not fetch GitHub updates. No remote changes were overwritten."
  if git merge-base --is-ancestor origin/main HEAD; then
    return 1  # No rebase was necessary.
  fi

  echo "GitHub contains newer changes; incorporating them now..."
  if git -c rerere.enabled=false rebase origin/main; then
    return 0
  fi

  # Rebase may encounter other conflicts. Only auto-resolve games.json when
  # it is the SOLE unmerged path. Never overwrite other conflicting files.
  local conflicted
  conflicted="$(git diff --name-only --diff-filter=U)"
  if [[ "$conflicted" != "data/games.json" ]]; then
    printf '\nGit stopped for conflicts requiring review:\n%s\n' "$conflicted" >&2
    fail "Rebase paused safely. Do NOT run deploy again or use git rebase --skip; send the conflict screenshot."
  fi

  echo "Attempting field-by-field three-way merge of data/games.json..."
  if ! merge_games_json; then
    fail "The game data has overlapping edits. Rebase paused; send the conflict screenshot for manual review."
  fi
  git add data/games.json
  if ! GIT_EDITOR=true git rebase --continue; then
    fail "Rebase needs additional attention. Do NOT re-run deploy; send the output."
  fi
  # Several local commits can each conflict; do not pretend a partially
  # applied rebase is finished. Later steps will never run with rebase active.
  if [[ -d "$(git rev-parse --git-path rebase-merge)" || \
        -d "$(git rev-parse --git-path rebase-apply)" ]]; then
    fail "Rebase is still in progress. Stop and send the output."
  fi
  return 0
}

check_games_json() {
  python3 - <<'PY'
import json
with open('data/games.json', encoding='utf-8') as f:
    data = json.load(f)
if not isinstance(data, list) or not all(isinstance(x, dict) for x in data):
    raise SystemExit('ERROR: data/games.json must be a list of game objects')
print(f'Game database valid: {len(data)} records.')
PY
}

commit_if_changed() {
  local label="$1"
  git add -A
  if git diff --cached --quiet; then
    echo "No new changes to commit."
  else
    git commit -m "$label"
  fi
}

build_site() {
  check_games_json
  python3 tools/generate_rating_projects.py
  python3 tools/generate_game_pages.py
  python3 tools/generate_series_pages.py
  python3 tools/generate_browse_indexes.py
  python3 tools/generate_feature_data.py --include-hidden 0
  INCLUDE_HIDDEN=0 python3 tools/generate_search_index.py
  python3 tools/generate_rss_feed.py || true
  ./check-social
  "$HUGO_CMD" --minify
}

# First commit any local edits (including changes from site admin tools).
# Then rebase BEFORE generating pages, so new GitHub data is included in the build.
commit_if_changed "Save local updates $(date +'%Y-%m-%d %H:%M')"
if sync_from_github; then
  echo "Latest GitHub updates incorporated."
fi
build_site
commit_if_changed "Deploy $(date +'%Y-%m-%d %H:%M')"

# Site editing tools may update GitHub while this is building. Recheck just
# before pushing and retry a bounded number of times rather than force-pushing.
for attempt in 1 2 3; do
  echo "Push attempt $attempt of 3..."
  if sync_from_github; then
    echo "New GitHub changes arrived during the build; regenerating the site..."
    build_site
    commit_if_changed "Refresh site after GitHub updates $(date +'%Y-%m-%d %H:%M')"
  fi
  if git push origin main; then
    echo
    echo "SUCCESS: GitHub updated. Cloudflare Pages should deploy automatically."
    exit 0
  fi
  echo "Push did not succeed. Checking whether GitHub changed in the meantime..."
  git fetch origin main || fail "Push/fetch failed. Check connection and GitHub status; no force push was attempted."
  if git merge-base --is-ancestor origin/main HEAD; then
    fail "Push failed for a reason other than new GitHub commits (possibly network or permissions). See output above."
  fi
done
fail "GitHub kept changing during deployment. Try again later; no data was overwritten."
