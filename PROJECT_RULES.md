# The Gaming Emporium — source preservation rules

## Canonical baseline
The latest user-supplied source archive (16 October 2026) is the baseline for future modifications. Do not rebuild from an older assistant-generated ZIP or patch. Always request or inspect the newest source before modifying files.

## Non-regression requirements
- Preserve game data, categories, weights, hidden flags, collections, and generated page identifiers. Never replace `data/games.json` with an older copy.
- Preserve ratings API, client JavaScript, shared slug mapping, eligibility list, existing database votes, ability to change ratings, and the three-vote display threshold. Titles with punctuation and Unicode must remain supported.
- Preserve collections cards, full-image styling, long-title safeguards, and collections generator.
- Preserve AI usage reporting and moderation, search results and hidden-game exclusion, suggestions, and popularity features.
- Preserve `.github/workflows/link-health.yml`, `scripts/check_links.py`, link health administration, daily confirmation email behavior, and the intended 04:00 Europe/Dublin schedule. Note that GitHub scheduled workflows can run late; schedule configuration does not guarantee execution.
- Preserve Cloudflare Pages Functions and bindings. Never remove a function to solve a frontend issue.
- Preserve the user's working deployment workflow and unrelated templates/styles.

## Procedure for every future build
1. Begin from the latest source tree / latest Git commit, not an old archive.
2. Make a narrowly scoped change; do not replace unrelated files.
3. Run `python3 tools/check_source_preservation.py` to identify missing or altered baseline-critical files. Review changed hashes rather than blindly reverting them; intentional improvements will change hashes.
4. Inspect `git status --short` and `git diff --stat` and review changes to protected files.
5. Run the normal build and feature-specific tests; confirm workflows and generated assets are present.
6. Commit changes to GitHub. Update the preservation manifest intentionally after verifying an approved change.

The baseline hash manifest is an audit aid, not an immutable lock. A changed hash means REVIEW, not necessarily failure. This cannot prevent a future assistant from using the wrong archive unless the latest source is supplied or available.
