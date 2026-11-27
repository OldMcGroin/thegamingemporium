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

echo "Refreshing Game Manager embedded data..."
python3 tools/refresh_manager.py

echo "Building Hugo site..."
hugo

# Publish a marker with the site's assets so IndexNow can identify the live
# Cloudflare deployment. Any marker failure is independent of publishing.
if [[ ${CF_PAGES:-} == 1 && ${CF_PAGES_BRANCH:-} == main &&
      ${CF_PAGES_COMMIT_SHA:-} =~ ^[0-9a-f]{40}$ ]]; then
  if ! printf '{"branch":"main","commit":"%s"}\n' "$CF_PAGES_COMMIT_SHA" > public/tge-indexnow-deployment.json; then
    echo "WARNING: Could not write the IndexNow deployment marker." >&2
  fi
fi

echo "Done. Output is in ./public"
