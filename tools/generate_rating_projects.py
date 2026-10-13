#!/usr/bin/env python3
import json,re,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[1]
games=json.loads((root/'data/games.json').read_text())
def slug(s):
 s=unicodedata.normalize('NFKD',s.lower());s=''.join(c for c in s if not unicodedata.combining(c));return re.sub(r'(^-+|-+$)','',re.sub(r'[^a-z0-9]+','-',s))
projects=set()
for g in games:
 if g.get('category')!='decompilations-recompilations' or g.get('hidden') or not g.get('title'):
  continue
 title=g['title']
 projects.add(slug(title))
 # Hugo urlize can remove apostrophes rather than turn them into separators.
 # Accept both forms so the card's actual slug is recognized by the API.
 projects.add(slug(title.replace("'", '').replace('’', '')))
projects=sorted(projects)
(root/'static/rating-projects.json').write_text(json.dumps(projects,separators=(',',':')))
print('Rating eligible projects:',len(projects))
