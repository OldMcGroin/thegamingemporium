#!/usr/bin/env bash
set -euo pipefail

# Always use the repository containing this script, even if launched elsewhere.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(git rev-parse --is-inside-work-tree 2>/dev/null || true)" == "true" ]] || \
  fail "Not inside a Git repository."
[[ "$(git branch --show-current)" == "main" ]] || \
  fail "Switch to your main branch before deploying."
git remote get-url origin >/dev/null 2>&1 || \
  fail "Git remote 'origin' is not configured."

# Do not interfere with an unfinished merge, rebase or cherry-pick.
for state in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do
  if [[ -e "$(git rev-parse --git-path "$state")" ]]; then
    fail "An unfinished Git operation ($state) exists. Resolve it before deploying."
  fi
done

# Choose Hugo command (Steam Deck friendly).
if [[ -x "$HOME/bin/hugo" ]]; then
  HUGO_CMD="$HOME/bin/hugo"
elif command -v hugo >/dev/null 2>&1; then
  HUGO_CMD="$(command -v hugo)"
else
  fail "Hugo not found. Install Hugo Extended, or place it at $HOME/bin/hugo"
fi

commit_changes() {
  local message="$1"
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "$message"
  else
    say "No new files to commit."
  fi
}

sync_with_github() {
  # Requires up-to-date origin/main (fetched by caller).
  if [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]; then
    say "Local main already matches GitHub."
    return
  fi

  if git merge-base --is-ancestor origin/main HEAD; then
    say "Local commits are already based on the latest GitHub version."
    return
  fi

  say "Rebasing local commits on the latest GitHub changes..."
  if ! git rebase origin/main; then
    # The original local commits are preserved; never force-push or choose
    # a side automatically when overlapping edits could lose game updates.
    if ! git rebase --abort; then
      fail "Rebase failed AND Git could not abort it. Stop here; send me the terminal output before running another Git command."
    fi
    fail "GitHub and your local files conflict. Your local commits are preserved; no push was attempted. Send me the conflict output so we can merge safely."
  fi
}

build_site() {
  say "Regenerating site content..."
  python3 tools/generate_rating_projects.py
  python3 tools/generate_game_pages.py
  python3 tools/generate_collection_pages.py
  python3 tools/generate_series_pages.py
  python3 tools/generate_browse_indexes.py
  python3 tools/generate_feature_data.py --include-hidden 0

  # Keep hidden games out of search suggestions AND full search results.
  INCLUDE_HIDDEN=0 python3 tools/generate_search_index.py

  # Preserve existing non-fatal behaviour for optional RSS generation.
  if ! python3 tools/generate_rss_feed.py; then
    printf 'WARNING: RSS generation failed; continuing as your previous script did.\n' >&2
  fi

  ./check-social

  say "Building Hugo site..."
  "$HUGO_CMD" --minify
}

say "Saving any local edits before syncing..."
commit_changes "Save local edits before deploy $(date +'%Y-%m-%d %H:%M')"

say "Fetching the latest GitHub changes..."
git fetch origin main
sync_with_github

build_site
commit_changes "Deploy $(date +'%Y-%m-%d %H:%M')"

# GitHub admin updates can land while Hugo is building. Retry only when
# GitHub truly advanced. Stop on network/auth errors or real merge conflicts.
for attempt in 1 2 3; do
  say "Pushing to GitHub (attempt $attempt of 3)..."
  if git push origin main; then
    say "SUCCESS: GitHub main is up to date. Cloudflare can now deploy it."
    exit 0
  fi

  if (( attempt == 3 )); then
    fail "Push was unsuccessful after 3 attempts. Nothing was force-pushed."
  fi

  say "Checking whether GitHub changed during the deployment..."
  old_remote="$(git rev-parse origin/main)"
  git fetch origin main || fail "Cannot fetch GitHub after push failure."
  new_remote="$(git rev-parse origin/main)"

  if [[ "$(git rev-parse HEAD)" == "$new_remote" ]]; then
    say "SUCCESS: GitHub already contains the latest commit."
    exit 0
  fi

  if [[ "$old_remote" == "$new_remote" ]]; then
    fail "GitHub has not advanced; the push may have failed due to a network, authentication or permission issue. No force-push attempted."
  fi

  sync_with_github
  # Regenerate once more from the merged source so the public pages and
  # search index reflect GitHub's new game/admin edits as well.
  build_site
  commit_changes "Refresh deploy after GitHub update $(date +'%Y-%m-%d %H:%M')"
done
