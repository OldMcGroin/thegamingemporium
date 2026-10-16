#!/usr/bin/env python3
import json,re,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[1]
games=json.loads((root/'data/games.json').read_text())
def slug(s):
 s=unicodedata.normalize('NFKD',s.lower());s=''.join(c for c in s if not unicodedata.combining(c));return re.sub(r'(^-+|-+$)','',re.sub(r'[^a-z0-9]+','-',s))
eligible=[g for g in games if g.get('category')=='decompilations-recompilations' and not g.get('hidden') and g.get('title')]
projects=sorted({slug(g['title']) for g in eligible if slug(g['title'])})
# Share the exact same canonical IDs with both Hugo rating templates.
# Keep the existing Python slug algorithm to preserve previously saved votes.
slug_map={g['title']:slug(g['title']) for g in eligible if slug(g['title'])}
(root/'data').mkdir(parents=True,exist_ok=True)
(root/'data/rating_slugs.json').write_text(json.dumps(slug_map,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(root/'static/rating-projects.json').write_text(json.dumps(projects,separators=(',',':')))
print('Rating eligible projects:',len(projects),'(shared slug map:',len(slug_map),')')
