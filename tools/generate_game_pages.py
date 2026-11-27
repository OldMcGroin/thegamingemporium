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
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GAMES_JSON = PROJECT_ROOT / "data" / "games.json"
OUT_DIR = PROJECT_ROOT / "content" / "game"

ABANDONWARE = {"abandonware"}
HIDDEN_OVERRIDES = PROJECT_ROOT / "data" / "hidden_overrides.json"
PLATFORM_REGISTRY = PROJECT_ROOT / "data" / "release_platform_registry.json"

# Check catalogue identity and related text, including aliases for projects that
# omit the franchise from their title. Missing series defaults to the brand card.
NINTENDO = re.compile(
    r"\b(?:nintendo|mario|luigi|wario|warioware|yoshi|zelda|hyrule|link s awakening|"
    r"ocarina of time|majora s mask|ocarina|harkinian|twilight princess|dusklight|"
    r"breath of the wild|tears of the kingdom|wind waker|phantom hourglass|spirit tracks|"
    r"skyward sword|minish cap|four swords|zquest|zelda64recompiled|zelda64|"
    r"pokemon|pokemmo|poken|pokopia|pokken|pokewilds|pokeclicker|pokefirered|pokeemerald|"
    r"pokered|pokegold|pokecrystal|gen[1245]recomp|pmd mystery dungeon|"
    r"donkey kong|diddy kong|dixie kong|dkc\d*(?:recomp)?|dk64|kong country|"
    r"metroid|samus|am2r|am64|kirby|papa kirby|star fox|starfox|"
    r"animal crossing|pikmin|splatoon|fire emblem|advance wars|famicom wars|"
    r"earthbound|mother [123]|mother zero|f zero|fzero|captain falcon|"
    r"smash bros|smash brothers|smash remix|project m|project plus|"
    r"kid icarus|punch out|golden sun|pilotwings|wave race|1080 snowboarding|"
    r"ice climbers?|duck hunt|balloon fight|excitebike|excitetruck|"
    r"chibi robo|rhythm (?:heaven|tengoku|paradise)|xenoblade(?: chronicles)?|"
    r"eternal darkness|sin and punishment|custom robo|drill dozer|"
    r"nintendogs|miitopia|tomodachi|brain age|big brain academy|"
    r"endless ocean|steel diver|pushmo|boxboy|battle clash|"
    r"stunt race fx|hotel dusk|another code|captain rainbow|fossil fighters|"
    r"urban champion|clu clu land|tentai|murasame|mach rider|"
    r"joy mech fight|color tv game|snipperclips|astral chain|"
    r"doshin the giant|zangeki no reginleiv|zero tsukihami|fatal frame mask of the lunar eclipse|"
    r"baten kaitos origins|captain toad|cruis n|starfy|kururin|tingle|"
    r"game watch|sutte hakkun|wild gunman|uniracers|unirally|"
    r"kaeru no tame ni kane wa naru|the frog for whom the bell tolls|pokemon mini|"
    r"sakura samurai|dillon s rolling western|freakyforms|kiki trick|"
    r"wii (?:sports|party|play|fit|music|chess)|mii channel|switch sports|"
    r"dr mario|picross|panel de pon|tetris attack|swapnote|ring fit|"
    r"nintendo64|gamecube|game boy|gameboy|super famicom|famicom)\b"
)
NINTENDO_PLATFORM = re.compile(r"\b(?:nes|snes|n64|gba|gbc|nds|3ds|dsi|wii|wiiu)\b")

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

def permits_social_artwork(game: Dict[str, Any]) -> bool:
    if not str(game.get("series") or "").strip():
        return False

    def normalize(value: Any) -> str:
        folded = unicodedata.normalize("NFKD", str(value or "").casefold())
        plain = "".join(char for char in folded if not unicodedata.combining(char))
        return re.sub(r"[^a-z0-9]+", " ", plain).strip()

    identity = " ".join(
        normalize(game.get(field))
        for field in ("title", "series", "slug", "collection", "image", "link", "notes")
    )
    platform = normalize(game.get("platform"))
    return not (NINTENDO.search(identity) or NINTENDO.search(platform) or NINTENDO_PLATFORM.search(platform))


def release_metadata(game: Dict[str, Any], registry: Dict[str, str]) -> tuple[list[str], bool]:
    platforms = []
    source_available = False
    for release in game.get("release_platforms") or []:
        if not isinstance(release, dict) or release.get("verification") not in {"manual", "verified"}:
            continue
        classification = release.get("classification")
        source_available |= classification == "source"
        if classification in {"downloadable", "hosted"}:
            label = registry.get(release.get("id"))
            if label and label not in platforms:
                platforms.append(label)
    return platforms, source_available


def write_game_page(game: Dict[str, Any], overrides: Dict[str, bool], registry: Dict[str, str]) -> None:
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
    seo_hidden = bool(game.get("hidden") or overrides.get(str(game.get("id"))))
    platforms, source_available = release_metadata(game, registry)
    collection = str(game.get("collection") or "").strip()

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
        f"draft: {str(bool(game.get('draft'))).lower()}",
        "params:",
        f"  external_link: {fm_escape(ext)}",
        f"  category: {fm_escape(cat)}",
        f"  hidden: {str(bool(game.get('hidden'))).lower()}",
        f"  genre1: {fm_escape(genre1)}",
        f"  genre2: {fm_escape(genre2)}",
        f"  series: {fm_escape(series)}",
        f"  video_link: {fm_escape(video)}",
        f"  date_added: {fm_escape(date_added)}",
        f"  image: {fm_escape(image)}",
        f"  seo_hidden: {str(bool(seo_hidden)).lower()}",
        f"  seo_artwork: {str(permits_social_artwork(game)).lower()}",
        f"  seo_release_platforms: {json.dumps(platforms, ensure_ascii=False)}",
        f"  seo_source_available: {str(source_available).lower()}",
        f"  seo_collection: {fm_escape(collection)}",
        "---",
        "",
        body,
    ]
    out_path.write_text("\n".join(fm), encoding="utf-8")

def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    games = read_games()
    overrides = json.loads(HIDDEN_OVERRIDES.read_text(encoding="utf-8"))
    registry = json.loads(PLATFORM_REGISTRY.read_text(encoding="utf-8"))

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
        write_game_page(g, overrides, registry)
        # Count written if file exists
        title = str(g.get("title") or "").strip()
        slug = str(g.get("slug") or "").strip() or slugify_title(title)
        if slug and (OUT_DIR / slug / "index.md").exists():
            written += 1

    print(f"Generated {written} game pages into {OUT_DIR}")

if __name__ == "__main__":
    main()
