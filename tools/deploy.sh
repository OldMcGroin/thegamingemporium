#!/usr/bin/env bash
set -euo pipefail

# Build + deploy helper for The Gaming Emporium
# Ensures all generated files (game pages, series pages, search index, RSS) are up to date
# before running Hugo, then commits + pushes.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Generate dynamic content (these are safe to re-run)
python3 tools/generate_game_pages.py
python3 tools/generate_series_pages.py
python3 tools/generate_search_index.py
python3 tools/generate_rss_feed.py

# Build
hugo --minify

# Commit + push (only if this is a git repo)
if [ -d .git ]; then
  git add -A
  if git diff --cached --quiet; then
    echo "Nothing to commit. Build complete."
    exit 0
  fi
  git commit -m "Deploy $(date +"%Y-%m-%d %H:%M")"
  git push
  echo "Deploy pushed."
else
  echo "No .git directory found; build complete (no commit/push)."
fi
