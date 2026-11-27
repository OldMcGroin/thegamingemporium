"""Regression tests for the isolated production notification path."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from urllib.request import Request

import indexnow


def row(title, **fields):
    return {"title": title, "link": "https://example.org", **fields}


def response(status):
    result = Mock(status=status)
    result.__enter__ = Mock(return_value=result)
    result.__exit__ = Mock(return_value=False)
    return result


def failure(status, **headers):
    return HTTPError(indexnow.ENDPOINT, status, "", headers, None)


class IndexNowTest(unittest.TestCase):
    def test_public_game_changes_include_slug_moves_and_same_path_artwork(self):
        original = row("Artwork", image="/Images/a.webp")
        before = indexnow.public_games(
            [row("Removed"), row("Hidden Later"), row("Renamed"), original,
             row("Stable"), row("Updated", notes="old")], {}, {"/Images/a.webp": "old"},
        )
        after = indexnow.public_games(
            [row("Added"), row("Hidden Later", hidden=True), row("Renamed", slug="new-name"),
             original, row("Stable"), row("Updated", notes="new")], {}, {"/Images/a.webp": "new"},
        )
        self.assertEqual(indexnow.changes(before, after), {
            "added": ["/game/added/", "/game/new-name/"],
            "modified": ["/game/artwork/", "/game/updated/"],
            "removed": ["/game/hidden-later/", "/game/removed/", "/game/renamed/"],
        })

    def test_drafts_hidden_excluded_and_duplicate_slugs_follow_generator(self):
        records = [
            row("Café"), row("Draft", draft=True), row("Hidden", hidden=True),
            row("Override", id=7), row("Skip Category", category="abandonware"),
            row("Unsitemapped"), row("Duplicate"), row("Duplicate", hidden=True),
        ]
        sitemap = {"/game/cafe/", "/game/draft/", "/game/hidden/", "/game/override/",
                   "/game/skip-category/", "/game/duplicate/"}
        self.assertEqual(set(indexnow.public_games(records, {"7": True}, {}, sitemap)),
                         {"/game/cafe/"})
        with self.assertRaisesRegex(ValueError, "no game URLs"):
            indexnow.public_games(records, {}, {}, set())

    def test_only_canonical_sitemap_game_detail_urls(self):
        sitemap = """
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://thegamingemporium.com/game/title/</loc></url>
            <url><loc>https://thegamingemporium.com/game/</loc></url>
            <url><loc>https://thegamingemporium.com/series/title/</loc></url>
            <url><loc>https://preview.pages.dev/game/title/</loc></url>
          </urlset>"""
        self.assertEqual(indexnow.game_paths(sitemap), {"/game/title/"})

    def test_preview_and_failed_or_missing_production_marker(self):
        with patch.object(indexnow, "live_file", return_value=json.dumps({
            "branch": "test/indexnow", "commit": "a" * 40,
        })):
            with self.assertRaisesRegex(ValueError, "invalid branch"):
                indexnow.production_commit()
        for status in (404, 503):
            with self.subTest(status=status), patch.object(indexnow, "live_file",
                                                             side_effect=failure(status)):
                if status == 404:
                    self.assertIsNone(indexnow.production_commit())
                else:
                    with self.assertRaises(HTTPError):
                        indexnow.production_commit()

    def test_retry_and_indexnow_payload(self):
        with patch.object(indexnow, "request", side_effect=[
            failure(429, **{"Retry-After": "1"}), URLError("connection"), response(202),
        ]) as send, patch.object(indexnow.time, "sleep") as sleep:
            indexnow.submit(["/game/removed/"], "test-key")
        self.assertEqual(send.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 4])
        self.assertEqual(json.loads(send.call_args.kwargs["data"]), {
            "host": indexnow.HOST, "key": "test-key",
            "keyLocation": f"{indexnow.ORIGIN}/test-key.txt",
            "urlList": [f"{indexnow.ORIGIN}/game/removed/"],
        })

    def test_permanent_and_exhausted_failures(self):
        for status, attempts in ((403, 1), (503, 4)):
            with self.subTest(status=status), patch.object(indexnow, "request",
                    side_effect=failure(status)) as send, patch.object(indexnow.time, "sleep"):
                with self.assertRaises(RuntimeError):
                    indexnow.submit(["/game/test/"], "test-key")
                self.assertEqual(send.call_count, attempts)

    def test_cross_host_redirect_drops_the_github_token_and_post_never_follows(self):
        url = "https://api.github.com/artifact"
        target = "https://artifacts.example/download"
        get = Request(url, headers={"Authorization": "Bearer fake"})
        redirect = indexnow.SafeRedirect()
        self.assertIsNone(redirect.redirect_request(get, None, 302, "", {}, target)
                          .get_header("Authorization"))
        post = Request(indexnow.ENDPOINT, data=b"{}")
        with self.assertRaises(HTTPError):
            redirect.redirect_request(post, None, 302, "", {}, target)

    def test_checkpoint_advances_only_after_delivery_and_a_stable_production_read(self):
        old = "a" * 40
        new = "b" * 40
        pages = {"/game/new/": "c" * 64}
        for mode in ("missing", "changed", "failed", "success"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temp:
                output = Path(temp) / "checkpoint.json"
                markers = [None] if mode == "missing" else [new, old if mode == "changed" else new]
                with (
                    patch.object(indexnow, "production_commit", side_effect=markers),
                    patch.object(indexnow, "checkpoint", return_value=(old, {}, False)),
                    patch.object(indexnow, "snapshot", return_value=pages),
                    patch.object(indexnow, "game_paths", return_value=set(pages)),
                    patch.object(indexnow, "live_file", return_value=b""),
                    patch.object(indexnow, "indexnow_key", return_value="test-key"),
                    patch.object(indexnow, "submit",
                                 side_effect=RuntimeError("failed") if mode == "failed" else None) as send,
                ):
                    if mode == "failed":
                        with self.assertRaises(RuntimeError):
                            indexnow.synchronize(output)
                    else:
                        indexnow.synchronize(output)
                self.assertEqual(output.exists(), mode == "success")
                self.assertEqual(send.call_count, int(mode in ("failed", "success")))
                if mode == "success":
                    self.assertEqual(json.loads(output.read_text()), {"commit": new, "pages": pages})

    def test_build_writes_production_marker_only_and_marker_failure_is_nonfatal(self):
        build = Path(__file__).resolve().parents[1] / "build.sh"
        for mode in ("production", "preview", "local", "invalid", "unwritable"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                for name in ("hugo", "python3", "check-social"):
                    executable = root / name
                    executable.write_text("#!/bin/sh\nexit 0\n")
                    executable.chmod(0o755)
                (root / "public").mkdir()
                marker = root / "public/tge-indexnow-deployment.json"
                if mode == "unwritable":
                    marker.mkdir()
                result = subprocess.run(["bash", str(build)], cwd=root, env={
                    **os.environ,
                    "PATH": f"{root}:{os.environ['PATH']}",
                    "CF_PAGES": "" if mode == "local" else "1",
                    "CF_PAGES_BRANCH": "test/indexnow" if mode == "preview" else "main",
                    "CF_PAGES_COMMIT_SHA": "" if mode == "invalid" else "a" * 40,
                }, capture_output=True, text=True, check=True)
                self.assertIn("Done. Output is in ./public", result.stdout)
                self.assertEqual(marker.is_file(), mode == "production")
                if mode == "production":
                    self.assertEqual(json.loads(marker.read_text()), {"branch": "main", "commit": "a" * 40})
                if mode == "unwritable":
                    self.assertIn("Could not write the IndexNow deployment marker", result.stderr)


if __name__ == "__main__":
    unittest.main()
