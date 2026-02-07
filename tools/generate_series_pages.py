#!/usr/bin/env python3
"""
Auto-generate Hugo content pages for each Series found in data/games.json.

Why: Browse-by-Series links to /series/<slug>/, but Hugo only generates that page
if a matching content file exists at content/series/<slug>.md.
"""

from __future__ import annotations

import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GAMES_JSON = PROJECT_ROOT / "data" / "games.json"
SERIES_DIR = PROJECT_ROOT / "content" / "series"

AUTO_MARKER = "AUTO-GENERATED: series page (do not edit manually)"

def hugo_urlize(value: str) -> str:
    """
    Approximate Hugo's `urlize`:
    - lowercase
    - strip apostrophes
    - convert & to "and"
    - replace non-alnum with hyphens
    - collapse multiple hyphens
    """
    s = value.strip().lower()
    s = s.replace("&", "and")
    s = s.replace("’", "'")
    s = s.replace("'", "")
    # Replace any non-alphanumeric with hyphen
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "series"

def read_games(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("data/games.json must be a JSON array of objects")
    return [x for x in data if isinstance(x, dict)]

def extract_series(games: List[Dict[str, Any]]) -> List[str]:
    out: List[str] = []
    for g in games:
        s = g.get("series")
        if not s:
            continue
        # Some entries might accidentally store non-strings; ignore those safely.
        if isinstance(s, str):
            out.append(s.strip())
    return [x for x in out if x]

def should_overwrite(existing_text: str) -> bool:
    return AUTO_MARKER in existing_text

def make_content(series_name: str, slug: str) -> str:
    # YAML front matter
    # If the series name looks like a slug (e.g. "tux-games"), generate a nicer title
    display_name = series_name
    if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)+", series_name.strip().lower()) and series_name == series_name.lower():
        display_name = series_name.replace("-", " ").title()
    return (
        "---\n"
        f'title: "{display_name}"\n'
        f'series: "{series_name}"\n'
        f'slug: "{slug}"\n'
        f"# {AUTO_MARKER}\n"
        "---\n"
    )

def main() -> None:
    if not GAMES_JSON.exists():
        raise SystemExit(f"Missing {GAMES_JSON}")

    games = read_games(GAMES_JSON)
    series_list = extract_series(games)

    counts = Counter(series_list)
    SERIES_DIR.mkdir(parents=True, exist_ok=True)

    created = 0
    updated = 0
    skipped = 0

    for series_name, _count in sorted(counts.items(), key=lambda kv: kv[0].lower()):
        slug = hugo_urlize(series_name)
        path = SERIES_DIR / f"{slug}.md"

        new_text = make_content(series_name, slug)

        if path.exists():
            old_text = path.read_text(encoding="utf-8", errors="ignore")
            if should_overwrite(old_text):
                if old_text != new_text:
                    path.write_text(new_text, encoding="utf-8")
                    updated += 1
                else:
                    skipped += 1
            else:
                # Respect any manually-created content pages.
                skipped += 1
        else:
            path.write_text(new_text, encoding="utf-8")
            created += 1

    print(f"Series pages: created={created}, updated={updated}, skipped={skipped}, total_series={len(counts)}")

if __name__ == "__main__":
    main()
