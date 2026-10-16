#!/usr/bin/env python3
"""Generate a single canonical rating identifier map for Hugo and the API."""
import json
import re
import unicodedata
from pathlib import Path

root = Path(__file__).resolve().parents[1]
games = json.loads((root / 'data/games.json').read_text(encoding='utf-8'))


def rating_slug(title):
    text = unicodedata.normalize('NFKD', title.casefold())
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    # Apostrophes are omitted rather than turned into separators, matching
    # the pre-existing Hugo card IDs (e.g. "Majora's" -> "majoras").
    text = re.sub(r"['\u2018\u2019\u02bc\u0060\u00b4]", '', text)
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', text))

eligible = [g for g in games if g.get('category') == 'decompilations-recompilations'
            and not g.get('hidden') and g.get('title')]
slug_map = {g['title']: rating_slug(g['title']) for g in eligible if rating_slug(g['title'])}
projects = sorted(set(slug_map.values()))
(root / 'data').mkdir(parents=True, exist_ok=True)
(root / 'static').mkdir(parents=True, exist_ok=True)
(root / 'data/rating_slugs.json').write_text(json.dumps(slug_map, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(root / 'static/rating-projects.json').write_text(json.dumps(projects, separators=(',', ':')), encoding='utf-8')
print(f'Rating eligible projects: {len(projects)} (shared slug map: {len(slug_map)})')
