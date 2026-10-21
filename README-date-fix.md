# TGE date_added correction (2026-10-22)

Based on uploaded tge-latest.tar.gz. This source archive predates the Metal Slug X live publication; DO NOT replace current data/games.json with archive data.

Files:
- functions/admin/game-manager/publish.js: server-side Irish date on game creation only; preserve original date on game edits. Collection publishing unchanged.
- tools/fix_metal_slug_x_date_once.py: optional one-time correction for published game id 3966, with safety checks. Run ONLY after safely syncing an up-to-date branch containing live Metal Slug X; do not run on the old archive. Review git diff before committing.

The Recent Additions Hugo template is unchanged: undated games remain excluded. The mobile form may still display an empty readonly date before publication; the authoritative date is assigned on the server at publish time.

Workflow: apply the server patch on the Preview worktree only; test new-game creation and existing-game update with branch publishing controls. Then prepare Production using current origin/main and explicitly approve deployment. Correct the live Metal Slug X date separately on a fresh branch based on current origin/main, preserving all newer games. Do not overwrite production blindly.
