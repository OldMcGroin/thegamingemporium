#!/usr/bin/env bash
set -euo pipefail

# Always operate on the repository containing this script.
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

# Do not interfere with unfinished Git operations.
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

# Save all edits before touching Git history so a failed merge can be undone.
commit_changes() {
  local message="$1"
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "$message"
  else
    say "No new files to commit."
  fi
}

abort_merge_safely() {
  if [[ -e "$(git rev-parse --git-path MERGE_HEAD)" ]]; then
    if ! git merge --abort; then
      fail "Could not abort the merge. Do NOT deploy or push. Send the full Git status for manual recovery."
    fi
  fi
}

sync_with_github() {
  # Caller must have fetched origin/main.
  if [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]; then
    say "Local main already matches GitHub."
    return
  fi

  if git merge-base --is-ancestor origin/main HEAD; then
    say "Local main already contains GitHub's latest updates."
    return
  fi

  if git merge-base --is-ancestor HEAD origin/main; then
    say "Fast-forwarding to newer GitHub commits..."
    git merge --ff-only origin/main
    return
  fi

  # ALWAYS examine game records if both branches changed games.json, even if
  # Git could auto-merge the text without raising a conflict. This catches
  # new ID collisions, deletions, and overlapping field edits.
  local merge_base merged_games conflicts
  merge_base="$(git merge-base HEAD origin/main)" || fail "Cannot find a common Git ancestor."
  merged_games=""
  if ! git diff --quiet "$merge_base" HEAD -- data/games.json && \
     ! git diff --quiet "$merge_base" origin/main -- data/games.json; then
    [[ -f "$SCRIPT_DIR/merge_games_json.py" ]] || \
      fail "Missing tools/merge_games_json.py. Install both supplied files before deploying."
    merged_games="$(mktemp "${TMPDIR:-/tmp}/tge-games-XXXXXXXX.json")"
    say "Checking both versions of games.json for safe, independent changes..."
    if ! python3 "$SCRIPT_DIR/merge_games_json.py" --git-revisions \
        "$merge_base" HEAD origin/main "$merged_games"; then
      rm -f -- "$merged_games"
      fail "games.json needs manual review. Your local commits are preserved; no Git merge or push was attempted."
    fi
  fi

  # Merge non-JSON files using Git normally. The validated record-level JSON
  # result (when needed) replaces Git's text-level merge of games.json.
  say "Combining local commits with newer GitHub updates..."
  if ! git merge --no-commit --no-ff origin/main; then
    if [[ ! -e "$(git rev-parse --git-path MERGE_HEAD)" ]]; then
      [[ -z "$merged_games" ]] || rm -f -- "$merged_games"
      fail "Git could not start the merge; no push attempted. Check the terminal output."
    fi
    mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
    if (( ${#conflicts[@]} != 1 )) || [[ "${conflicts[0]:-}" != "data/games.json" ]] || \
       [[ -z "$merged_games" ]]; then
      say "Files needing manual review: ${conflicts[*]:-(unknown)}"
      abort_merge_safely
      [[ -z "$merged_games" ]] || rm -f -- "$merged_games"
      fail "Merge needs review beyond the safely mergeable JSON. Local commits preserved; no push attempted."
    fi
  fi

  if [[ -n "$merged_games" ]]; then
    cp -- "$merged_games" data/games.json
    rm -f -- "$merged_games"
    git add -- data/games.json
  fi
  if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
    abort_merge_safely
    fail "Unresolved files remain; no push attempted."
  fi
  git commit -m "Merge latest GitHub and local website updates"
}

build_site() {
  say "Regenerating site content..."
  python3 tools/generate_rating_projects.py
  python3 tools/generate_game_pages.py
  python3 tools/generate_collection_pages.py
  python3 tools/generate_series_pages.py
  python3 tools/generate_browse_indexes.py
  python3 tools/generate_feature_data.py --include-hidden 0

  # Keep hidden games out of both search suggestions and full results.
  INCLUDE_HIDDEN=0 python3 tools/generate_search_index.py

  # RSS generation has historically been optional / non-fatal.
  if ! python3 tools/generate_rss_feed.py; then
    printf 'WARNING: RSS generation failed; continuing.\n' >&2
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

# Website admin updates can land during a long Hugo build; retry only if
# GitHub actually advanced. Never force-push.
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
    fail "GitHub has not advanced; push may have failed due to network, authentication or permission. No force-push attempted."
  fi

  sync_with_github
  # Regenerate to include the new data brought in from GitHub.
  build_site
  commit_changes "Refresh deploy after GitHub update $(date +'%Y-%m-%d %H:%M')"
done
