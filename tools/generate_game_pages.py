#!/usr/bin/env python3
"""
Generate internal per-game pages under content/game/<slug>/index.md from data/games.json.

Goal: allow RSS items (and anyone) to land on The Gaming Emporium first,
then choose the external link from that page.

- Supports stable slug override via "slug" in games.json.
- Skips Abandonware entries.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GAMES_JSON = PROJECT_ROOT / "data" / "games.json"
OUT_DIR = PROJECT_ROOT / "content" / "game"

ABANDONWARE = {"abandonware"}

def is_abandonware(game: Dict[str, Any]) -> bool:
    cat = game.get("category")
    if cat is None:
        return False
    return str(cat).strip().lower() in ABANDONWARE

def slugify_title(title: str) -> str:
    # Match the JS slugifyTitle() behaviour used elsewhere (close enough for URLs)
    s = (title or "")
    try:
        import unicodedata
        s = unicodedata.normalize("NFKD", s)
        s = "".join(ch for ch in s if not unicodedata.combining(ch))
    except Exception:
        pass
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"^-+|-+$", "", s)
    return s

def read_games() -> List[Dict[str, Any]]:
    if not GAMES_JSON.exists():
        raise SystemExit(f"Missing {GAMES_JSON}")
    data = json.loads(GAMES_JSON.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("data/games.json must be a JSON array")
    return [x for x in data if isinstance(x, dict)]

def fm_escape(s: str) -> str:
    # Basic YAML-safe quoting
    s = (s or "").replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'

def write_game_page(game: Dict[str, Any]) -> None:
    title = str(game.get("title") or "").strip()
    ext = str(game.get("link") or "").strip()
    if not title or not ext:
        return

    slug = str(game.get("slug") or "").strip() or slugify_title(title)
    if not slug:
        return

    cat = str(game.get("category") or "").strip()
    genre1 = str(game.get("genre1") or "").strip()
    genre2 = str(game.get("genre2") or "").strip()
    series = str(game.get("series") or "").strip()
    notes = str(game.get("notes") or "").strip()
    video = str(game.get("video_link") or "").strip()
    date_added = str(game.get("date_added") or "").strip()
    image = str(game.get("image") or "").strip()

    out_folder = OUT_DIR / slug
    out_folder.mkdir(parents=True, exist_ok=True)
    out_path = out_folder / "index.md"

    # Keep body minimal; template renders everything from params.
    body = ""
    if notes:
        body = notes.strip() + "\n"

    fm = [
        "---",
        f"title: {fm_escape(title)}",
        f"url: {fm_escape('/game/' + slug + '/')}",
        "type: game",
        "params:",
        f"  external_link: {fm_escape(ext)}",
        f"  category: {fm_escape(cat)}",
        f"  genre1: {fm_escape(genre1)}",
        f"  genre2: {fm_escape(genre2)}",
        f"  series: {fm_escape(series)}",
        f"  video_link: {fm_escape(video)}",
        f"  date_added: {fm_escape(date_added)}",
        f"  image: {fm_escape(image)}",
        "---",
        "",
        body,
    ]
    out_path.write_text("\n".join(fm), encoding="utf-8")

def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    games = read_games()

    # Clean previously generated pages (only the /content/game folder)
    # but keep the folder itself.
    if OUT_DIR.exists():
        for child in OUT_DIR.iterdir():
            if child.is_dir():
                # Only remove folders that contain an index.md we generated
                idx = child / "index.md"
                if idx.exists():
                    for p in child.rglob("*"):
                        if p.is_file():
                            p.unlink()
                    # remove empty dirs bottom-up
                    for p in sorted(child.rglob("*"), reverse=True):
                        if p.is_dir():
                            try:
                                p.rmdir()
                            except OSError:
                                pass
                    try:
                        child.rmdir()
                    except OSError:
                        pass

    written = 0
    for g in games:
        if is_abandonware(g):
            continue
        before = written
        write_game_page(g)
        # Count written if file exists
        title = str(g.get("title") or "").strip()
        slug = str(g.get("slug") or "").strip() or slugify_title(title)
        if slug and (OUT_DIR / slug / "index.md").exists():
            written += 1

    print(f"Generated {written} game pages into {OUT_DIR}")

if __name__ == "__main__":
    main()
