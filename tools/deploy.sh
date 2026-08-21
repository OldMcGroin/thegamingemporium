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
# Generated files can occasionally still be changing when Git first reads them.
# Give them a moment to settle, then retry staging automatically if necessary.
sleep 1

GIT_STAGED=0

for attempt in 1 2 3 4 5; do
    if git add -A; then
        GIT_STAGED=1
        break
    fi

    echo
    echo "Git staging failed — waiting 2 seconds and retrying ($attempt/5)..."
    sleep 2
done

if [[ "$GIT_STAGED" -ne 1 ]]; then
    echo "ERROR: Git could not stage the files after 5 attempts."
    exit 1
fi

# Only commit when something actually changed
if ! git diff --cached --quiet; then
    git commit -m "Deploy $(date +"%Y-%m-%d %H:%M")"
else
    echo "No changes to commit."
fi

git push
