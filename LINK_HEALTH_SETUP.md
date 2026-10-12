# Link Health Monitor setup

1. Deploy this ZIP to the existing repository as usual. The admin page is `/admin/link-health/`.
2. In GitHub → Actions → **Check external game links**, choose **Run workflow**. The first scan writes `static/link-health-report.json` and publishes the dashboard through the next Cloudflare deployment. Subsequent scans run daily at approximately 05:17 UTC (GitHub schedule can be delayed).
3. In GitHub → Settings → Secrets and variables → Actions, add **RESEND_API_KEY**, **LINK_HEALTH_EMAIL_TO** (your destination address), and **LINK_HEALTH_EMAIL_FROM** (a sender address verified with Resend). Email alerts are disabled until all three exist. These GitHub secrets are separate from Cloudflare Pages environment variables.
4. GitHub Actions needs repository **Contents: write** permission (workflow declares it; repository policy must allow it). Existing Cloudflare Pages variables **GITHUB_TOKEN**, **ACCESS_TEAM_DOMAIN**, and **ACCESS_AUD** are required for Hide, Unhide, and Change Link, using the existing verified Cloudflare Access authentication. Protect `/admin/link-health/*` using the same Cloudflare Access policy as your other admin routes.
5. The first scan flags 404/410 results for review; only repeat 404/410 failures across daily scans become 'broken'. HTTP 403, 429, timeouts, and other errors are marked suspicious, never automatically hidden. A successful response is not proof the correct project content still exists. The 'Open / Check Link' button opens the URL for manual verification.
6. Hiding/unhiding or changing links writes only the matched `games.json` entry and triggers a normal GitHub/Cloudflare deployment. The report will reflect the new URL or visibility after the next scan.

**Note:** Daily scans of thousands of sites may take time, some sites block bots, and GitHub-hosted runners have limits. This version does not automatically recheck a single URL server-side. No automatic hiding/deletion occurs.

## One-click manual reviews
Checked & OK and Reopen Review are saved to browser localStorage without authentication. They are specific to that browser/device, not synchronized through GitHub. Clearing browser storage clears reviews. A changed URL or scan error detail invalidates the review. Hide Game and Change Link still require authenticated Cloudflare Access.
