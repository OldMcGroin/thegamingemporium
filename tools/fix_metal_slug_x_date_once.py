#!/usr/bin/env python3
"""One-time correction, run ONLY on an up-to-date working copy of GitHub main."""
import json
from pathlib import Path
p=Path('data/games.json')
items=json.loads(p.read_text(encoding='utf-8'))
assert isinstance(items,list)
match=[x for x in items if x.get('id')==3966 and x.get('title')=='Metal Slug X - Apple Silicon Native Port']
assert len(match)==1, 'Expected exactly one matching published Metal Slug X game'
g=match[0]
assert 'date_added' not in g or g['date_added'] in ('','2026-10-22'), 'Date already exists; refusing to overwrite'
if g.get('date_added')=='2026-10-22':
 print('Already dated; no changes')
else:
 g['date_added']='2026-10-22'
 p.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Set date_added for Metal Slug X to 2026-10-22')
