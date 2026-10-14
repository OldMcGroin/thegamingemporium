#!/usr/bin/env python3
import json,re,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[1]
games=json.loads((root/'data/games.json').read_text())
def slug(s):
 s=unicodedata.normalize('NFKD',s.lower());s=''.join(c for c in s if not unicodedata.combining(c));return re.sub(r'(^-+|-+$)','',re.sub(r'[^a-z0-9]+','-',s))
projects=sorted({slug(g.get('title','')) for g in games if g.get('category')=='decompilations-recompilations' and not g.get('hidden') and g.get('title')})
(root/'static/rating-projects.json').write_text(json.dumps(projects,separators=(',',':')))
print('Rating eligible projects:',len(projects))
