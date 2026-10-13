#!/usr/bin/env bash
set -euo pipefail

# Run from the site root, even when launched from another directory.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

# This site deploys from main. Never accidentally push a different branch.
BRANCH="$(git symbolic-ref --quiet --short HEAD)" || {
  echo "ERROR: Git is not on a branch. Deployment stopped." >&2
  exit 1
}
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: You're on '$BRANCH', not 'main'. Deployment stopped." >&2
  exit 1
fi

# Commit only when there are changes; unlike 'git commit || true',
# this doesn't silently hide genuine commit errors.
commit_if_changed() {
  local message="$1"
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "$message"
  else
    echo "No new changes to commit."
  fi
}

# Integrate remote commits without ever force-pushing. If a rebase conflicts,
# abort it to leave local commits intact and stop for manual assistance.
sync_with_github() {
  echo "Checking GitHub for newer changes..."
  git fetch origin main || {
    echo "ERROR: Could not fetch GitHub changes. Deployment stopped." >&2
    return 1
  }

  if ! git rebase origin/main; then
    echo "ERROR: GitHub changes conflict with local commits." >&2
    echo "Aborting the rebase to preserve your local work. Nothing was pushed." >&2
    git rebase --abort || true
    echo "Run 'git status' and get help resolving the conflict." >&2
    return 1
  fi
}

build_site() {
  # Choose Hugo command (Steam Deck friendly).
  local HUGO_CMD=""
  if [[ -x "$HOME/bin/hugo" ]]; then
    HUGO_CMD="$HOME/bin/hugo"
  elif command -v hugo >/dev/null 2>&1; then
    HUGO_CMD="hugo"
  else
    echo "ERROR: Hugo not found. Install Hugo Extended, or place it at $HOME/bin/hugo" >&2
    return 1
  fi

  # Always regenerate derived content before building.
  python3 tools/generate_game_pages.py
  python3 tools/generate_series_pages.py
  python3 tools/generate_browse_indexes.py
  python3 tools/generate_feature_data.py --include-hidden 0

  # Exclude hidden games from public search suggestions and results.
  INCLUDE_HIDDEN=0 python3 tools/generate_search_index.py
  python3 tools/generate_rss_feed.py || true

  ./check-social

  # Build Hugo.
  "$HUGO_CMD" --minify
}

# Protect local edits (including new game files) before rebasing.
# A pre-sync commit means we never need to stash or discard them.
commit_if_changed "Pre-deploy local changes $(date +'%Y-%m-%d %H:%M')"

# Synchronize BEFORE rebuilding, so generated pages use the latest data.
sync_with_github

build_site
commit_if_changed "Deploy $(date +'%Y-%m-%d %H:%M')"

# Another GitHub workflow might push while we're building. Retry a few
# times, re-synchronizing and rebuilding each time. Never force-push.
MAX_ATTEMPTS=3
for ((attempt=1; attempt<=MAX_ATTEMPTS; attempt++)); do
  echo "Pushing to GitHub (attempt $attempt/$MAX_ATTEMPTS)..."
  if git push origin main; then
    echo "SUCCESS: Site changes pushed to GitHub."
    exit 0
  fi

  if (( attempt == MAX_ATTEMPTS )); then
    echo "ERROR: Git push failed after $MAX_ATTEMPTS attempts." >&2
    echo "Your commits are still saved locally. Nothing was discarded." >&2
    exit 1
  fi

  # Retry only if GitHub genuinely moved ahead. Other failures (network,
  # authentication, permissions) need attention, not another rebase.
  git fetch origin main || {
    echo "ERROR: Push failed and GitHub could not be reached." >&2
    exit 1
  }
  if git merge-base --is-ancestor origin/main HEAD; then
    echo "ERROR: Push failed, but GitHub has no newer commits to integrate." >&2
    echo "Check the error above (e.g. authentication or permissions)." >&2
    exit 1
  fi

  echo "GitHub changed during the build. Synchronizing and rebuilding..."
  if ! git rebase origin/main; then
    echo "ERROR: Rebase conflict. Aborting safely; no force push." >&2
    git rebase --abort || true
    echo "Your changes remain in local commits. Run 'git status' for details." >&2
    exit 1
  fi
  build_site
  commit_if_changed "Deploy refresh $(date +'%Y-%m-%d %H:%M')"
done
