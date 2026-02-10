#!/usr/bin/env python3
"""
Generate static/rss.xml (Recent Additions feed) from data/games.json.

Feed design:
- Last 50 items with a valid date_added (YYYY-MM-DD), newest first.
- Item <link> points to internal /game/<slug>/ pages (traffic stays on-site).
- Skips Abandonware.
- Supports stable slug override via "slug" in games.json.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GAMES_JSON = PROJECT_ROOT / "data" / "games.json"
CONFIG_TOML = PROJECT_ROOT / "config.toml"
OUT_PATH = PROJECT_ROOT / "static" / "rss.xml"

ABANDONWARE = {"abandonware"}

def is_abandonware(game: Dict[str, Any]) -> bool:
    cat = game.get("category")
    if cat is None:
        return False
    return str(cat).strip().lower() in ABANDONWARE

def slugify_title(title: str) -> str:
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
    data = json.loads(GAMES_JSON.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("data/games.json must be a JSON array")
    return [x for x in data if isinstance(x, dict)]

def read_base_url() -> str:
    # Very small TOML read: find baseURL = "..."
    if not CONFIG_TOML.exists():
        return "https://thegamingemporium.com/"
    txt = CONFIG_TOML.read_text(encoding="utf-8")
    m = re.search(r'^\s*baseURL\s*=\s*"([^"]+)"\s*$', txt, flags=re.MULTILINE)
    if not m:
        return "https://thegamingemporium.com/"
    url = m.group(1).strip()
    if not url.endswith("/"):
        url += "/"
    return url

def parse_date(date_str: str) -> Optional[datetime]:
    date_str = (date_str or "").strip()
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None

def xml_escape(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def build_item(game: Dict[str, Any], base_url: str) -> Optional[str]:
    title = str(game.get("title") or "").strip()
    if not title:
        return None
    date_added = str(game.get("date_added") or "").strip()
    dt = parse_date(date_added)
    if dt is None:
        return None

    slug = str(game.get("slug") or "").strip() or slugify_title(title)
    if not slug:
        return None

    internal = f"{base_url}game/{slug}/"
    cat = str(game.get("category") or "").strip()
    genre1 = str(game.get("genre1") or "").strip()
    genre2 = str(game.get("genre2") or "").strip()
    series = str(game.get("series") or "").strip()

    # Keep description short.
    parts = []
    if cat: parts.append(cat.replace("-", " ").title())
    if series: parts.append(f"Series: {series}")
    genres = ", ".join([g for g in [genre1, genre2] if g])
    if genres: parts.append(f"Genre: {genres.replace('-', ' ')}")
    desc = " · ".join(parts) if parts else "New addition"

    pub = format_datetime(dt)

    return "\n".join([
        "    <item>",
        f"      <title>{xml_escape(title)}</title>",
        f"      <link>{xml_escape(internal)}</link>",
        f"      <guid isPermaLink=\"true\">{xml_escape(internal)}</guid>",
        f"      <pubDate>{xml_escape(pub)}</pubDate>",
        f"      <description>{xml_escape(desc)}</description>",
        "    </item>",
    ])

def main() -> None:
    if not GAMES_JSON.exists():
        raise SystemExit(f"Missing {GAMES_JSON}")

    base_url = read_base_url()
    now = datetime.now(timezone.utc)
    last_build = format_datetime(now)

    games = [g for g in read_games() if not is_abandonware(g)]
    # Filter to dated items only, sort newest first
    dated = []
    for g in games:
        dt = parse_date(str(g.get("date_added") or "").strip())
        if dt is not None:
            dated.append((dt, g))
    dated.sort(key=lambda x: x[0], reverse=True)
    top = [g for _, g in dated[:50]]

    items = []
    for g in top:
        it = build_item(g, base_url)
        if it:
            items.append(it)

    channel_title = "The Gaming Emporium — Recent Additions"
    channel_link = base_url
    channel_desc = "The 50 most recent additions to The Gaming Emporium (links go to the site first)."
    self_link = f"{base_url}rss.xml"

    xml = "\n".join([
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">",
        "  <channel>",
        f"    <title>{xml_escape(channel_title)}</title>",
        f"    <link>{xml_escape(channel_link)}</link>",
        f"    <atom:link href=\"{xml_escape(self_link)}\" rel=\"self\" type=\"application/rss+xml\" />",
        f"    <description>{xml_escape(channel_desc)}</description>",
        f"    <lastBuildDate>{xml_escape(last_build)}</lastBuildDate>",
        *items,
        "  </channel>",
        "</rss>",
        "",
    ])

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(xml, encoding="utf-8")
    print(f"Wrote {OUT_PATH} with {len(items)} items")

if __name__ == "__main__":
    main()
