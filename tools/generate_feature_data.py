#!/usr/bin/env python3
import argparse, json, re, unicodedata
from collections import Counter
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
GAMES = ROOT / 'data' / 'games.json'
OUT = ROOT / 'static' / 'js' / 'tge-feature-data.js'

def category_label(slug):
    overrides = {
        'console-to-pc-port': 'Console To PC Ports',
        'console-ports': 'Console To Console Ports',
        'in-the-works': 'In The Works',
        'decompilations-recompilations': 'Decompilations & Recompilations',
        'open-source': 'Open Source',
        'source-port': 'Open Source',
        'fan-games': 'Fan Games & Homebrew',
        'android-ports': 'Android Ports',
        'browser-based': 'Browser Based',
        'vr-ports': 'VR',
        'rom-hacks': 'ROM Hacks',
        'utilities': 'Utilities',
        'utility': 'Utilities',
    }
    if not slug:
        return ''
    if slug in overrides:
        return overrides[slug]
    text = str(slug).replace('-', ' ').title()
    return re.sub(r'\bPc\b', 'PC', text)

def slugify(text):
    # Mirrors the slug logic already used by the site's page generator and Hugo urlize.
    s = unicodedata.normalize("NFKD", str(text or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--include-hidden', choices=['0','1'], default='0')
    args = ap.parse_args()
    include_hidden = args.include_hidden == '1'

    games = json.loads(GAMES.read_text(encoding='utf-8'))
    visible = games if include_hidden else [g for g in games if g.get('hidden') is not True]

    surprise = []
    favourites = []
    games_by_slug = {}
    cats = set()
    month_prefix = datetime.now().strftime('%Y-%m')
    added_this_month = 0

    for g in visible:
        cat = g.get('category') or ''
        link = g.get('link') or ''
        title = g.get('title') or ''
        label = category_label(cat)
        tracking_id = str(g.get('slug') or slugify(title))
        if tracking_id:
            games_by_slug[tracking_id] = {'title': title, 'url': link}
        if link and cat:
            surprise.append({'title': title, 'url': link, 'category': cat, 'categoryLabel': label})
        if link:
            favourites.append({'id': slugify(title), 'title': title, 'url': link, 'categoryLabel': label})
        if cat: cats.add(cat)
        if str(g.get('date_added') or '').startswith(month_prefix):
            added_this_month += 1

    category_counts = Counter(g.get('category') for g in visible if g.get('category'))
    category_stats = [
        {'slug': slug, 'label': category_label(slug), 'count': count}
        for slug, count in category_counts.items()
    ]
    category_stats.sort(key=lambda item: item['label'].casefold())

    stats = {
        'totalProjects': len(visible),
        'addedThisMonth': added_this_month,
        'categoryCounts': category_stats,
    }

    payload = {'surprise': surprise, 'favourites': favourites, 'stats': stats, 'gamesBySlug': games_by_slug}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    compact = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    OUT.write_text('window.TGE_FEATURE_DATA=' + compact + ';window.__GAMES_BY_SLUG__=window.TGE_FEATURE_DATA.gamesBySlug||{};\n', encoding='utf-8')
    print(f'Generated {OUT.relative_to(ROOT)} ({len(visible)} games, include_hidden={include_hidden})')

if __name__ == '__main__':
    main()
