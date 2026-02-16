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

# Start helper server in background (preview-only visibility toggle)
HELPER_PID=""
if command -v lsof >/dev/null 2>&1 && lsof -i :7331 >/dev/null 2>&1; then
  echo "Visibility helper already running on :7331 (not starting another)."
else
  python3 tools/visibility_server.py >/dev/null 2>&1 &
  HELPER_PID=$!
fi

cleanup() {
  if [[ -n "${HELPER_PID}" ]]; then
    kill "$HELPER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Generate derived files/pages so preview matches deploy
python3 tools/generate_game_pages.py
python3 tools/generate_series_pages.py

# Preview search can include hidden so you can still find + toggle them
INCLUDE_HIDDEN=1 python3 tools/generate_search_index.py

# Run hugo server (disableFastRender helps ensure data changes trigger updates)
"$HUGO_CMD" server -D --disableFastRender
