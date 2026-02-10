#!/usr/bin/env bash
set -euo pipefail

# Optional: if you keep an updated games.json at repo root, sync it into /data automatically.
# This prevents stale builds when you forget to copy it.
if [ -f "./games.json" ]; then
  echo "Syncing ./games.json -> ./data/games.json"
  cp ./games.json ./data/games.json
fi

echo "Generating game pages..."
python3 tools/generate_game_pages.py

echo "Generating RSS feed..."
python3 tools/generate_rss_feed.py

echo "Generating series pages..."
python3 tools/generate_series_pages.py

echo "Generating search index..."
python3 tools/generate_search_index.py

echo "Building Hugo site..."
hugo

echo "Done. Output is in ./public"
