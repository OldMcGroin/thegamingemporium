#!/usr/bin/env bash
set -euo pipefail

echo "Generating series pages..."
python3 tools/generate_series_pages.py

echo "Building Hugo site..."
hugo

echo "Done. Output is in ./public"
