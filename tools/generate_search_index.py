#!/usr/bin/env python3
"""
Generate static/search-index.js and static/games-slug-map.js from data/games.json.

This powers the site-wide search dropdown. Keeping it generated avoids
stale search results when games.json changes.

Output format:
  window.__GAME_INDEX__ = [{"title": "...", "url": "..."}, ...]
"""

from __future__ import annotations

import json
from pathlib import Path
import os
from typing import Any, Dict, List

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GAMES_JSON = PROJECT_ROOT / "data" / "games.json"
OUT_PATH = PROJECT_ROOT / "static" / "search-index.js"
SLUG_MAP_OUT = PROJECT_ROOT / "static" / "games-slug-map.js"

def read_games(path: Path) -> List[Dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("data/games.json must be a JSON array")
    return [x for x in data if isinstance(x, dict)]

def main() -> None:
    if not GAMES_JSON.exists():
        raise SystemExit(f"Missing {GAMES_JSON}")

    games = read_games(GAMES_JSON)

    include_hidden = os.environ.get("INCLUDE_HIDDEN") == "1"

    index = []
    slug_map: Dict[str, Dict[str, str]] = {}
    skipped = 0
    for g in games:
        if (not include_hidden) and bool(g.get("hidden")):
            continue
        title = str(g.get("title") or "").strip()
        url = str(g.get("link") or "").strip()
        # Stable slug override support: allow "slug" in games.json.
        # If omitted, fall back to a simple slugified title.
        slug = str(g.get("slug") or "").strip() or slugify_title(title)
        if not title or not url:
            skipped += 1
            continue
        index.append({"title": title, "url": url})
        if slug:
            slug_map[slug] = {"title": title, "url": url}

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text("window.__GAME_INDEX__ = " + json.dumps(index, ensure_ascii=False) + ";", encoding="utf-8")
    SLUG_MAP_OUT.write_text(
        "window.__GAMES_BY_SLUG__ = " + json.dumps(slug_map, ensure_ascii=False) + ";",
        encoding="utf-8",
    )
    print(f"Search index: items={len(index)}, skipped_missing_fields={skipped}")


def slugify_title(title: str) -> str:
    """Mimic Hugo's urlize closely enough for our tracking ids."""
    import re
    s = (title or "").strip().lower()
    # Replace ampersands with 'and' (common in Hugo urlize)
    s = s.replace("&", " and ")
    # Replace non-alphanumeric with spaces
    s = re.sub(r"[^a-z0-9]+", " ", s)
    # Collapse whitespace, join with hyphens
    s = re.sub(r"\s+", " ", s).strip()
    return s.replace(" ", "-")

if __name__ == "__main__":
    main()
