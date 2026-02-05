#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "games.json"
OUT  = ROOT / "static" / "search-index.js"

def norm(s):
    return (s or "").strip().lower()

def main():
    games = json.loads(DATA.read_text(encoding="utf-8"))
    index = []
    for g in games:
        cat = norm(g.get("category"))
        if cat == "abandonware":
            continue
        title = g.get("title") or g.get("name") or ""
        url = g.get("url") or g.get("link") or ""
        title = str(title).strip()
        url = str(url).strip()
        if not title:
            continue
        index.append({"title": title, "url": url})
    # sort alphabetically for stable diffs
    index.sort(key=lambda x: x["title"].lower())

    OUT.write_text("window.__GAME_INDEX__ = " + json.dumps(index, ensure_ascii=False) + ";\n", encoding="utf-8")

if __name__ == "__main__":
    main()
