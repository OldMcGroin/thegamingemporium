#!/usr/bin/env bash
set -e

cd ~/Downloads/thegamingemporium

echo "== Git safety: remove stale index.lock if no git running =="
if [ -f .git/index.lock ]; then
  if pgrep -u "$USER" -f "git" >/dev/null 2>&1; then
    echo "Git appears to be running AND .git/index.lock exists."
    echo "Close any stuck git process, then re-run deploy."
    exit 1
  fi
  rm -f .git/index.lock
fi

echo "== Clean Hugo output/cache =="
rm -rf public resources .hugo_build.lock 2>/dev/null || true

echo "== Generate game pages (if present) =="
if [ -f tools/generate_game_pages.py ]; then
  python3 tools/generate_game_pages.py
fi

echo "== Generate RSS (if present) =="
if [ -f tools/generate_rss.py ]; then
  python3 tools/generate_rss.py
elif [ -f tools/generate_feed.py ]; then
  python3 tools/generate_feed.py
fi

echo "== Build site =="
hugo --minify

echo "== Commit & push =="
git add -A
git commit -m "Deploy $(date +"%Y-%m-%d %H:%M")" || true
git push

echo "Done."
