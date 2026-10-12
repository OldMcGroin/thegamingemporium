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

# Synchronise with GitHub before building
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "ERROR: Not on main branch. Stopping." >&2
  exit 1
fi

if [[ -n "$(git ls-files -u)" ]]; then
  echo "ERROR: Unresolved Git conflicts. Stopping." >&2
  exit 1
fi

echo "Checking GitHub for updates..."
git pull --rebase --autostash origin main

if [[ "$(git branch --show-current)" != "main" ]] || [[ -n "$(git ls-files -u)" ]]; then
  echo "ERROR: Git needs attention. Stopping." >&2
  exit 1
fi

# Always regenerate derived content before building
python3 tools/generate_game_pages.py
python3 tools/generate_series_pages.py
python3 tools/generate_browse_indexes.py
python3 tools/generate_feature_data.py --include-hidden 0

# Live build: (you said you don't care if hidden appears in search)
# If you ever want hidden excluded later, change INCLUDE_HIDDEN=1 -> 0
INCLUDE_HIDDEN=1 python3 tools/generate_search_index.py
python3 tools/generate_rss_feed.py || true

./check-social

# Build Hugo
"$HUGO_CMD" --minify

# Git deploy
git add -A
if ! git diff --cached --quiet; then
  git commit -m "Deploy $(date +'%Y-%m-%d %H:%M')"
fi
git push origin main
