Rating identifier consistency patch

Replace the five matching paths in your Hugo project with these files.
Run: python3 tools/generate_rating_projects.py
Confirm data/rating_slugs.json is created and static/rating-projects.json exists.
Run your usual deploy command.

The generator preserves the existing Python slug IDs, so votes under those IDs remain intact. No database reset or migration. The game-card layout is otherwise unchanged.

Note: Existing votes saved under a different Hugo slug cannot automatically be merged without a database migration.
