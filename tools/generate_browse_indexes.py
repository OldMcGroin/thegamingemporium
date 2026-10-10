#!/usr/bin/env python3
from __future__ import annotations
import json, re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAMES = ROOT / 'data' / 'games.json'
OUT = ROOT / 'data' / 'browse_indexes.json'


def slugify(value: str) -> str:
    s = str(value or '').strip().lower()
    s = s.replace('&', 'and').replace('’', "'").replace("'", '')
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return re.sub(r'-{2,}', '-', s).strip('-')


def series_key(value: str) -> str:
    s = slugify(value)
    return s[4:] if s.startswith('the-') else s


def build(games, include_hidden: bool):
    selected = [g for g in games if include_hidden or not g.get('hidden', False)]
    series_games = defaultdict(list)
    series_names = {}
    genre_games = defaultdict(list)
    genre_names = {}

    for g in selected:
        raw = str(g.get('series') or '').strip()
        if raw:
            key = series_key(raw)
            if key:
                series_names.setdefault(key, raw)
                series_games[key].append(g)
        for field in ('genre1','genre2'):
            rawg = str(g.get(field) or '').strip()
            if not rawg:
                continue
            key = slugify(rawg)
            if key:
                genre_names.setdefault(key, rawg)
                # avoid same game twice if genre1 == genre2 variant
                if not any(x.get('id') == g.get('id') for x in genre_games[key]):
                    genre_games[key].append(g)

    exclude = {'disney','james bond','lego','marvel','nfl','spongebob squarepants','dragon ball fighterz'}
    series_catalog=[]
    for key, vals in series_games.items():
        name=series_names[key]
        if len(vals) >= 2 and name.lower() not in exclude:
            series_catalog.append({'slug':key,'name':name,'count':len(vals)})
    series_catalog.sort(key=lambda x:x['name'].lower())

    genre_catalog=[{'slug':k,'name':genre_names[k],'count':len(v)} for k,v in genre_games.items()]
    genre_catalog.sort(key=lambda x:x['name'].lower())

    for vals in series_games.values(): vals.sort(key=lambda g:str(g.get('title') or '').lower())
    for vals in genre_games.values(): vals.sort(key=lambda g:str(g.get('title') or '').lower())

    return {
        'series_catalog': series_catalog,
        'series_games': dict(series_games),
        'genre_catalog': genre_catalog,
        'genre_games': dict(genre_games),
    }


def main():
    games=json.loads(GAMES.read_text(encoding='utf-8'))
    payload={'all':build(games, True),'visible':build(games, False)}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    print(f"Browse indexes: series={len(payload['all']['series_catalog'])}, genres={len(payload['all']['genre_catalog'])}")

if __name__=='__main__': main()
