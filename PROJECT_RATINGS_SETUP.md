# Project quality ratings setup

1. In Cloudflare → D1 → your existing **suggestions** database (bound as `SUGGESTIONS_DB`), open Console and execute the SQL from `cloudflare/d1_project_ratings.sql`. Alternatively create/bind a separate database named `RATINGS_DB` and run it there.
2. Deploy this updated site to Cloudflare Pages. The Functions endpoint `/api/ratings` requires Cloudflare Pages (local `hugo server` cannot save votes).
3. Test a decompilation/recompilation card and its corresponding `/game/<slug>/` page. Submit ratings from three distinct browser profiles. A score only becomes visible at three ratings; the same browser can revise its vote.
4. The eligibility list is generated from `data/games.json` by `tools/generate_rating_projects.py` on every normal build/deploy. Hidden projects are excluded. If using a custom build command, run that Python script before `hugo`.

## Important limitations

Anonymous votes are tied to a secure, HttpOnly browser cookie, **not a verified person**. Clearing cookies or changing browser/device allows another vote. A hashed-IP hourly submission limit helps deter abuse but shared networks can be affected. No user account is required.

The GET endpoint reads D1 for every visible project's summary. The client batches up to 40 projects per request, but each summary is a D1 read. Consider a materialized/cached aggregate if traffic is high. The `project_rating_events` table grows; periodically delete events older than 7 days using `DELETE FROM project_rating_events WHERE created_at < datetime('now','-7 days');`.

Only the decompilations/recompilations category gets rating buttons. Ratings are stored separately from `games.json` and do not trigger rebuilds.
