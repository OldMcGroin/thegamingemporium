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
python3 tools/generate_series_pages.py
python3 tools/generate_browse_indexes.py
python3 tools/generate_feature_data.py --include-hidden 0

# Exclude hidden games from public search suggestions and results.
INCLUDE_HIDDEN=0 python3 tools/generate_search_index.py
python3 tools/generate_rss_feed.py || true

./check-social

# Build Hugo
"$HUGO_CMD" --minify

# Safely publish local changes without overwriting newer GitHub commits.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Not inside a Git repository." >&2
  exit 1
fi
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "ERROR: Expected branch 'main'. Switch to main before deploying." >&2
  exit 1
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "ERROR: Git remote 'origin' is not configured." >&2
  exit 1
fi
if [[ -d "$(git rev-parse --git-path rebase-merge)" || -d "$(git rev-parse --git-path rebase-apply)" || -f "$(git rev-parse --git-path MERGE_HEAD)" ]]; then
  echo "ERROR: A merge or rebase is already in progress. Resolve it before deploying." >&2
  exit 1
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "Deploy $(date +"%Y-%m-%d %H:%M")"
else
  echo "No new local changes to commit."
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean after committing. Stopping safely." >&2
  exit 1
fi

echo "Fetching latest GitHub changes..."
git fetch origin main

echo "Rebasing local commits onto GitHub main..."
if ! git rebase origin/main; then
  echo >&2
  echo "STOP: Git found a conflict. No force push was attempted." >&2
  echo "Run 'git status' to see the conflicting files." >&2
  echo "After resolving conflicts: git add <resolved-files>; git rebase --continue" >&2
  echo "Or cancel the rebase safely with: git rebase --abort" >&2
  exit 1
fi

echo "Pushing to GitHub..."
if ! git push origin main; then
  echo "Push did not succeed (GitHub may have changed again)." >&2
  echo "Your local commits are preserved. Run deploy again to retry." >&2
  exit 1
fi

echo "Deployment pushed successfully to origin/main."
