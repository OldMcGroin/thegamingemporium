#!/usr/bin/env bash
set -euo pipefail

# Sync canonical data/games.json -> root games.json (never overwrite data)
if [ -f "./data/games.json" ]; then
  echo "Syncing ./data/games.json -> ./games.json"
  cp ./data/games.json ./games.json
fi



echo "Generating game pages..."
python3 tools/generate_game_pages.py


echo "Generating series pages..."
python3 tools/generate_series_pages.py

echo "Generating search index..."
python3 tools/generate_search_index.py

echo "Building Hugo site..."
hugo

echo "Done. Output is in ./public"
