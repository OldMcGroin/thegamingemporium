#!/usr/bin/env python3
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import tempfile

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GAMES_PATH = PROJECT_ROOT / "data" / "games.json"

class Handler(BaseHTTPRequestHandler):
    def _headers(self, code: int, content_type: str = "text/plain; charset=utf-8") -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        # Allow preview JS (served from hugo server) to talk to localhost helper
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._headers(204)
        self.wfile.write(b"")

    def do_GET(self):
        if self.path == "/ping":
            self._headers(200)
            self.wfile.write(b"OK")
            return
        if self.path.startswith("/status"):
            # /status?id=123
            try:
                from urllib.parse import urlparse, parse_qs
                q = parse_qs(urlparse(self.path).query)
                game_id = int(q.get("id", ["-1"])[0])
            except Exception:
                self._headers(400)
                self.wfile.write(b"Bad id")
                return

            try:
                games = json.loads(GAMES_PATH.read_text(encoding="utf-8"))
                hidden_val = None
                for g in games:
                    if isinstance(g, dict) and int(g.get("id", -1)) == game_id:
                        hidden_val = bool(g.get("hidden"))
                        break
                if hidden_val is None:
                    self._headers(404)
                    self.wfile.write(b"Not found")
                    return
                self._headers(200, "application/json; charset=utf-8")
                self.wfile.write(json.dumps({"id": game_id, "hidden": hidden_val}).encode("utf-8"))
            except Exception as e:
                self._headers(500)
                self.wfile.write(f"Failed: {e}".encode("utf-8"))
            return
        self._headers(404)
        self.wfile.write(b"Not found")

    def do_POST(self):
        if self.path != "/toggle":
            self._headers(404)
            self.wfile.write(b"Not found")
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            payload = json.loads(raw)
            game_id = int(payload.get("id"))
            hidden = bool(payload.get("hidden"))
        except Exception as e:
            self._headers(400)
            self.wfile.write(f"Bad JSON: {e}".encode("utf-8"))
            return

        if not GAMES_PATH.exists():
            self._headers(500)
            self.wfile.write(f"Missing {GAMES_PATH}".encode("utf-8"))
            return

        try:
            games = json.loads(GAMES_PATH.read_text(encoding="utf-8"))
            if not isinstance(games, list):
                raise ValueError("data/games.json must be a JSON array")

            found = False
            for g in games:
                if isinstance(g, dict) and int(g.get("id", -1)) == game_id:
                    g["hidden"] = hidden
                    found = True
                    break

            if not found:
                self._headers(404)
                self.wfile.write(b"Game id not found")
                return

            # Atomic write to avoid partial reads while Hugo/search helpers are reading.
            payload_out = json.dumps(games, indent=2, ensure_ascii=False)
            tmp_dir = GAMES_PATH.parent
            with tempfile.NamedTemporaryFile("w", delete=False, dir=tmp_dir, encoding="utf-8") as tf:
                tf.write(payload_out)
                tmp_path = Path(tf.name)
            tmp_path.replace(GAMES_PATH)

            self._headers(200, "application/json; charset=utf-8")
            self.wfile.write(json.dumps({"id": game_id, "hidden": hidden}).encode("utf-8"))
        except Exception as e:
            self._headers(500)
            self.wfile.write(f"Failed: {e}".encode("utf-8"))

def main() -> None:
    server = HTTPServer(("127.0.0.1", 7331), Handler)
    print("Visibility server running on http://127.0.0.1:7331")
    print(f"Editing: {GAMES_PATH}")
    server.serve_forever()

if __name__ == "__main__":
    main()
