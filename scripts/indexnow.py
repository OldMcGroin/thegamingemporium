#!/usr/bin/env python3
"""Notify IndexNow of public game changes on the live Cloudflare Pages site."""

import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from xml.etree import ElementTree
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from generate_game_pages import is_abandonware, slugify_title

HOST = "thegamingemporium.com"
ORIGIN = f"https://{HOST}"
MARKER = "/tge-indexnow-deployment.json"
ENDPOINT = "https://api.indexnow.org/indexnow"
REPO = "OldMcGroin/thegamingemporium"
API = f"https://api.github.com/repos/{REPO}"
# Last verified production catalogue before IndexNow was introduced.
BASELINE = "b536997447e434bbe5e4e48757dca122351f5780"
ARTIFACT = "indexnow-production-v1"
SHA = re.compile(r"[0-9a-f]{40}")
DIGEST = re.compile(r"[0-9a-f]{64}")
GAME_PATH = re.compile(r"/game/[a-z0-9][a-z0-9_-]*/")


class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        if request.get_method() != "GET":
            raise HTTPError(request.full_url, code, message, headers, response)
        redirected = super().redirect_request(request, response, code, message, headers, new_url)
        if redirected and urlsplit(request.full_url).netloc != urlsplit(new_url).netloc:
            redirected.remove_header("Authorization")
        return redirected


OPENER = build_opener(SafeRedirect())


def request(url, *, headers=None, data=None):
    return OPENER.open(
        Request(url, headers={"User-Agent": "TheGamingEmporium-IndexNow", **(headers or {})},
                data=data),
        timeout=20,
    )


def live_file(path):
    # The cache buster and the second marker read guard against a deployment
    # switching while the sitemap and source snapshot are being gathered.
    with request(f"{ORIGIN}{path}?indexnow={time.time_ns()}",
                 headers={"Cache-Control": "no-cache"}) as response:
        resolved = urlsplit(response.url)
        if (resolved.scheme, resolved.netloc, resolved.path) != ("https", HOST, path):
            raise ValueError(f"Unexpected redirect for production {path}")
        return response.read()


def production_commit():
    try:
        marker = json.loads(live_file(MARKER))
    except HTTPError as error:
        if error.code == 404:
            print("The production deployment marker is not live yet.")
            return None
        raise
    revision = marker.get("commit", "")
    if marker.get("branch") != "main" or not SHA.fullmatch(revision):
        raise ValueError("Production deployment marker has an invalid branch or commit")
    return revision


def github(path, *, raw=False):
    headers = {
        "Accept": "application/vnd.github.raw+json" if raw else "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token := os.environ.get("GH_TOKEN"):
        headers["Authorization"] = f"Bearer {token}"
    with request(f"{API}{path}", headers=headers) as response:
        return response.read()


def image_blobs(revision):
    tree = json.loads(github(f"/git/trees/{revision}"))
    for name in ("static", "Images"):
        node = next(entry for entry in tree["tree"] if entry["path"] == name)
        recursive = "?recursive=1" if name == "Images" else ""
        tree = json.loads(github(f"/git/trees/{node['sha']}{recursive}"))
    if tree["truncated"]:
        raise ValueError("GitHub returned an incomplete artwork tree")
    return {
        f"/Images/{entry['path']}": entry["sha"]
        for entry in tree["tree"] if entry["type"] == "blob"
    }


def game_paths(xml):
    root = ElementTree.fromstring(xml)
    if root.tag != "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset":
        raise ValueError("Production sitemap is not a sitemap URL set")
    return {
        loc.text.removeprefix(ORIGIN) for loc in root.findall(".//{*}loc")
        if loc.text and loc.text.startswith(ORIGIN + "/game/")
        and GAME_PATH.fullmatch(loc.text.removeprefix(ORIGIN))
    }


def public_games(games, overrides, artwork, sitemap=None):
    # Preserve the generator's last-record-wins behaviour for duplicate slugs.
    pages = {}
    for game in games:
        if not isinstance(game, dict) or is_abandonware(game):
            continue
        title = str(game.get("title") or "").strip()
        slug = str(game.get("slug") or "").strip() or slugify_title(title)
        path = f"/game/{slug}/"
        if title and str(game.get("link") or "").strip() and GAME_PATH.fullmatch(path):
            pages[path] = game

    if not sitemap and sitemap is not None and pages:
        raise ValueError("Production sitemap contains no game URLs")

    result = {}
    for path, game in pages.items():
        if game.get("hidden") or overrides.get(str(game.get("id"))) or game.get("draft"):
            continue
        if sitemap is not None and path not in sitemap:
            continue
        image = str(game.get("image") or "").strip()
        # Use the Git blob so artwork replaced at the same path counts as an edit.
        fingerprint = json.dumps([game, artwork.get(image)], sort_keys=True,
                                 ensure_ascii=False, separators=(",", ":"))
        result[path] = hashlib.sha256(fingerprint.encode()).hexdigest()
    return result


def snapshot(revision, sitemap=None):
    games = json.loads(github(f"/contents/data/games.json?ref={revision}", raw=True))
    try:
        overrides = json.loads(github(f"/contents/data/hidden_overrides.json?ref={revision}", raw=True))
    except HTTPError as error:
        if error.code != 404:
            raise
        overrides = {}
    if not isinstance(games, list) or not isinstance(overrides, dict):
        raise ValueError("Invalid game catalogue or visibility overrides")
    return public_games(games, overrides, image_blobs(revision), sitemap)


def changes(before, after):
    return {
        "added": sorted(after.keys() - before.keys()),
        "modified": sorted(path for path in before.keys() & after.keys()
                           if before[path] != after[path]),
        "removed": sorted(before.keys() - after.keys()),
    }


def checkpoint():
    listing = json.loads(github(f"/actions/artifacts?name={ARTIFACT}&per_page=100"))
    artifacts = [entry for entry in listing["artifacts"]
                 if not entry["expired"] and (entry.get("workflow_run") or {}).get("head_branch") == "main"]
    if not artifacts:
        print(f"No checkpoint found. Using verified production baseline {BASELINE[:12]}.")
        return BASELINE, snapshot(BASELINE), True
    latest = max(artifacts, key=lambda entry: (entry["created_at"], entry["id"]))
    archive = github(f"/actions/artifacts/{latest['id']}/zip")
    with ZipFile(io.BytesIO(archive)) as package:
        previous = json.loads(package.read("checkpoint.json"))
    revision, pages = previous["commit"], previous["pages"]
    if not SHA.fullmatch(revision) or not isinstance(pages, dict) or any(
        not GAME_PATH.fullmatch(path) or not DIGEST.fullmatch(digest)
        for path, digest in pages.items()
    ):
        raise ValueError("Invalid IndexNow checkpoint")
    age = datetime.now(timezone.utc) - datetime.fromisoformat(latest["created_at"])
    return revision, pages, age.days >= 7


def indexnow_key():
    key = os.environ.get("INDEXNOW_KEY", "").strip()
    if not key:
        # This is the public ownership file already deployed by the site.
        key_file = Path("static/3945de8574974f6db94f730d606a4b12.txt")
        key = key_file.read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"[a-zA-Z0-9-]{8,128}", key):
        raise ValueError("Invalid IndexNow key")
    if live_file(f"/{key}.txt").decode().strip() != key:
        raise ValueError("Live IndexNow ownership file does not match the configured key")
    return key


def retry_seconds(value, attempt):
    if not value:
        return 2 ** attempt
    if value.isdecimal():
        return int(value)
    try:
        target = parsedate_to_datetime(value)
        return max(0, (target - datetime.now(timezone.utc)).total_seconds())
    except (TypeError, ValueError):
        return 2 ** attempt


def submit(paths, key):
    payload = json.dumps({
        "host": HOST,
        "key": key,
        "keyLocation": f"{ORIGIN}/{quote(key)}.txt",
        "urlList": [ORIGIN + path for path in paths],
    }).encode()
    for attempt in range(1, 5):
        try:
            with request(ENDPOINT, headers={"Content-Type": "application/json; charset=utf-8"},
                         data=payload) as response:
                status = response.status
            if status not in (200, 202):
                raise RuntimeError(f"Unexpected IndexNow HTTP {status}")
            print(f"IndexNow accepted {len(paths)} URL(s), HTTP {status}.")
            return
        except HTTPError as error:
            status = error.code
            retryable = status in (408, 429) or 500 <= status <= 599
            delay = retry_seconds(error.headers.get("Retry-After"), attempt)
            print(f"IndexNow attempt {attempt} returned HTTP {status}.", flush=True)
            if not retryable:
                raise RuntimeError(f"IndexNow rejected the submission (HTTP {status})") from None
        except (URLError, TimeoutError, OSError) as error:
            delay = retry_seconds(None, attempt)
            print(f"IndexNow attempt {attempt} had a connection failure ({type(error).__name__}).",
                  flush=True)
        if attempt < 4 and delay <= 60:
            time.sleep(delay)
        else:
            raise RuntimeError("IndexNow temporarily unavailable. Checkpoint retained for the next run.")


def save_checkpoint(revision, pages, output):
    output.write_text(json.dumps({"commit": revision, "pages": pages}, sort_keys=True),
                      encoding="utf-8")


def synchronize(output):
    revision = production_commit()
    if not revision:
        return
    previous, before, refresh = checkpoint()
    if revision == previous:
        print(f"Production {revision[:12]} is already tracked.")
        if refresh:
            save_checkpoint(previous, before, output)
        return
    after = snapshot(revision, game_paths(live_file("/sitemap.xml")))
    delta = changes(before, after)
    paths = sorted(path for group in delta.values() for path in group)
    print(f"Production {previous[:12]} -> {revision[:12]}: "
          + ", ".join(f"{len(group)} {action}" for action, group in delta.items()))
    for action, group in delta.items():
        for path in group:
            print(f"{action}: {path}")
    key = indexnow_key() if paths else None
    if production_commit() != revision:
        print("Production changed during the scan. The next run will recheck it.")
        return
    for start in range(0, len(paths), 10_000):
        submit(paths[start:start + 10_000], key)
    save_checkpoint(revision, after, output)


if __name__ == "__main__":
    try:
        synchronize(Path("checkpoint.json"))
    except (ValueError, RuntimeError, HTTPError, URLError, OSError, KeyError) as error:
        # Avoid printing request URLs, which can contain the configured key.
        message = (str(error) if isinstance(error, (ValueError, RuntimeError))
                   else f"{type(error).__name__}: {getattr(error, 'code', 'request or data error')}")
        print(f"::error::IndexNow sync failed. The previous checkpoint was retained. {message}")
        sys.exit(1)
