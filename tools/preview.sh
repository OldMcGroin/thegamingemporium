#!/usr/bin/env bash
set -euo pipefail

# Start helper server in background (preview-only visibility toggle)
python3 tools/visibility_server.py &
HELPER_PID=$!

cleanup() {
  kill "$HELPER_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Generate derived files/pages so preview matches deploy
python3 tools/generate_game_pages.py
python3 tools/generate_series_pages.py
INCLUDE_HIDDEN=1 python3 tools/generate_search_index.py

# Run hugo server (disableFastRender helps ensure data changes trigger updates)
hugo server -D --disableFastRender
