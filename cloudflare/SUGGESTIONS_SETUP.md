# Suggestion Box setup

The site code is complete. These Cloudflare steps are required once.

## 1. Create the D1 database

Cloudflare Dashboard → Workers & Pages → D1 SQL Database → Create.

Suggested name: `gaming-emporium-suggestions`

Open its Console and run the contents of `cloudflare/d1_schema_suggestions.sql`.

## 2. Bind D1 to the Pages project

Cloudflare Dashboard → Workers & Pages → your **Pages project** → Settings → Bindings → Add → D1 database.

- Variable name: `SUGGESTIONS_DB`
- Database: `gaming-emporium-suggestions`

Add it to Production and Preview if Cloudflare shows both environments, then redeploy the site.

## 3. Protect the private page and API

In Cloudflare Zero Trust → Access → Applications → Add application → Self-hosted.

- Application name: `Gaming Emporium Suggestions`
- Domain: `thegamingemporium.com`
- Path: `/admin/suggestions*`

Create an **Allow** policy containing only your email address. This one path protects both:

- `/admin/suggestions/` — the private inbox page
- `/admin/suggestions/api` — its private data API

Do not protect `/api/suggestions`; visitors need that route to submit suggestions.

## 4. Deploy and test

Run your normal `./deploy` command. Then:

1. Open the homepage and submit a test suggestion.
2. Open `https://thegamingemporium.com/admin/suggestions/`.
3. Sign in through Cloudflare Access.
4. Mark the test suggestion reviewed, then delete it.

## Included spam protection

The public form has a hidden bot-trap field, validates titles and URLs, rejects recent duplicates, and limits each hashed visitor IP to five submissions per hour. Raw IP addresses are not stored.
