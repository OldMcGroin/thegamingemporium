#!/usr/bin/env python3
"""Refresh Game Manager embedded data from canonical source JSON. Run before Hugo."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = root / 'static/admin/game-manager/index.html'
source = root / 'data/games.json'
collections = root / 'data/collections.json'
html = page.read_text(encoding='utf-8')

def replace_array(html, variable, records):
    # The existing manager stores its initial dataset as one JS array literal.
    pattern = r'(const ' + re.escape(variable) + r'=)(\[.*?\])(?=;)'
    matches = list(re.finditer(pattern, html, flags=re.S))
    if len(matches) != 1:
        raise RuntimeError(f'Expected exactly one {variable} embedded array, got {len(matches)}')
    serialized = json.dumps(records, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    m = matches[0]
    return html[:m.start(2)] + serialized + html[m.end(2):]

games = json.loads(source.read_text(encoding='utf-8'))
if not isinstance(games, list) or not games:
    raise RuntimeError('Invalid or empty games.json')
html = replace_array(html, 'baseline', games)
if collections.exists():
    items = json.loads(collections.read_text(encoding='utf-8'))
    if not isinstance(items, list):
        raise RuntimeError('Invalid collections.json')
    html = replace_array(html, 'baselineCollections', items)
page.write_text(html, encoding='utf-8')
print(f'Game Manager embedded data refreshed: {len(games)} games')
