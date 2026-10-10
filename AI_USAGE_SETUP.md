# AI Usage feature setup

1. Deploy the updated site and Cloudflare Pages Functions.
2. In Cloudflare D1, open the database bound as `SUGGESTIONS_DB` and execute `cloudflare/d1_ai_reports.sql` once. The existing Suggestions database and email configuration are reused.
3. Protect `/admin/ai-reports/` and `/admin/ai-reports/api` using the same Cloudflare Access rules as `/admin/suggestions/` and its API. **Do this before deploying** to prevent public access to reports.
4. In local Preview Mode (`tools/preview.sh`), use the `Set AI` button on Decompilations & Recompilations cards. It saves to `data/games.json` through the local helper on port 7331. Commit/deploy that updated JSON as usual.
5. AI report submissions are review-only and do not automatically change game classifications. Visit `/admin/ai-reports/` to inspect them.
6. The public AI Usage filter remembers the visitor's selection. Unclassified projects display `Unknown`.

For standalone use, replace the bundled `data/games.json` with your latest version if it changes after this package was created.
