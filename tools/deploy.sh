#!/usr/bin/env bash
set -euo pipefail


# AUTO-SYNC BEFORE BUILD
# Preserve Steam Deck edits while fetching changes from the website form.

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "ERROR: Please deploy from the main branch."
  exit 1
fi

AUTO_STASH=0

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Saving local changes temporarily..."
  git stash push -u -m "Automatic backup before deploy"
  AUTO_STASH=1
fi

echo "Synchronising with GitHub..."

if ! git pull --rebase origin main; then
  echo "ERROR: GitHub sync needs manual conflict resolution."
  echo "Any automatic backup remains saved."
  exit 1
fi

if [[ "$AUTO_STASH" == "1" ]]; then
  echo "Restoring local changes..."

  if ! git stash apply 'stash@{0}'; then
    echo "ERROR: Local changes conflicted with GitHub."
    echo "The backup remains saved. Resolve before deploying."
    exit 1
  fi

  git stash drop 'stash@{0}'
fi

echo "GitHub synchronisation complete."
# END AUTO-SYNC

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

# Git deploy (safe if repo has .git)
git add -A
git commit -m "Deploy $(date +"%Y-%m-%d %H:%M")" || true
git push
