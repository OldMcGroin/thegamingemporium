#!/usr/bin/env bash
set -euo pipefail

echo "Generating game pages..."
python3 tools/generate_rating_projects.py
python3 tools/generate_game_pages.py
python3 tools/generate_collection_pages.py


echo "Generating series pages..."
python3 tools/generate_series_pages.py
python3 tools/generate_browse_indexes.py

echo "Generating search index..."
python3 tools/generate_search_index.py

./check-social

echo "Refreshing Game Manager embedded data..."\npython3 tools/refresh_manager.py\n\necho "Building Hugo site..."
hugo

echo "Done. Output is in ./public"
