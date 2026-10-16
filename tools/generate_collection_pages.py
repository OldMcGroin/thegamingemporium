#!/usr/bin/env python3
"""Generate only explicitly enabled decomp/recomp collection pages."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
collections = json.loads((root / 'data/collections.json').read_text())
games = json.loads((root / 'data/games.json').read_text())
out = root / 'content/collections'
out.mkdir(parents=True, exist_ok=True)
active = set()
for c in collections:
    slug = c.get('slug', '')
    if not c.get('enabled') or not slug or not any(g.get('category') == 'decompilations-recompilations' and g.get('collection') == slug for g in games):
        continue
    active.add(slug)
    folder = out / slug
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'index.md').write_text('---\ntitle: ' + json.dumps(c['name'] + ' Collection') + '\ntype: collections\ncollection_slug: ' + json.dumps(slug) + '\n---\n')
for folder in out.iterdir():
    if folder.is_dir() and folder.name not in active and (folder / 'index.md').exists():
        (folder / 'index.md').unlink()
        try: folder.rmdir()
        except OSError: pass
print(f'Generated {len(active)} collection pages')
