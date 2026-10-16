#!/usr/bin/env bash
set -euo pipefail

# Choose Hugo command (Steam Deck friendly)
HUGO_CMD=""
if [[ -x "$HOME/bin/hugo" ]]; then
  HUGO_CMD="$HOME/bin/hugo"
elif command -v hugo >/dev/null 2>&1; then
  HUGO_CMD="hugo"
else
  echo "ERROR: Hugo not found. Install Hugo Extended, or place it at $HOME/bin/hugo" >&2
  exit 1
fi

# Always regenerate derived content before building
python3 tools/generate_rating_projects.py
python3 tools/generate_game_pages.py
python3 tools/generate_collection_pages.py
python3 tools/generate_series_pages.py
python3 tools/generate_browse_indexes.py
python3 tools/generate_feature_data.py --include-hidden 0

# Exclude hidden games from public search suggestions and results.
INCLUDE_HIDDEN=0 python3 tools/generate_search_index.py
python3 tools/generate_rss_feed.py || true

./check-social

# Build Hugo
"$HUGO_CMD" --minify

# Git deploy (safe if repo has .git)
git add -A
git commit -m "Deploy $(date +"%Y-%m-%d %H:%M")" || true
git push
