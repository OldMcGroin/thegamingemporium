#!/usr/bin/env bash
set -e

cd ~/Downloads/thegamingemporium

echo "Starting Hugo preview server..."
exec hugo server --buildDrafts --disableFastRender
