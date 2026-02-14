#!/usr/bin/env bash
set -euo pipefail
chmod +x tools/*.sh 2>/dev/null || true
chmod +x preview deploy 2>/dev/null || true
echo "Permissions fixed. Run: ./preview or ./deploy (or: bash preview / bash deploy)"
