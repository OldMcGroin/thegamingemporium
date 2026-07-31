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

## 5. Enable email notifications (Resend)

This build can email you after each new suggestion is saved. The email includes the submitted game title/link and an **Open Suggestion Inbox** button linking to:

`https://thegamingemporium.com/admin/suggestions/`

Email delivery runs in the background. If Resend is temporarily unavailable, the suggestion is still stored successfully.

### Create and verify Resend

1. Create a Resend account.
2. Add and verify `thegamingemporium.com` in Resend. Resend will provide DNS records to add in Cloudflare.
3. Create a Resend API key.

### Add Cloudflare Pages variables

Cloudflare Dashboard → Workers & Pages → your Pages project → Settings → Variables and Secrets.

Add these to **Production** (and Preview too if you test preview deployments):

- Secret: `RESEND_API_KEY` — the API key from Resend
- Variable: `SUGGESTION_NOTIFY_TO` — the email address that should receive notifications
- Variable: `SUGGESTION_NOTIFY_FROM` — for example `The Gaming Emporium <suggestions@thegamingemporium.com>`
- Optional variable: `SUGGESTION_ADMIN_URL` — defaults to `https://thegamingemporium.com/admin/suggestions/`

Redeploy the Pages project after adding the variables.

### Test

Submit a new, non-duplicate game suggestion. It should appear in the admin inbox immediately, and the notification email should arrive shortly afterwards.

If the suggestion appears but no email arrives, check Cloudflare Pages/Workers real-time logs for `Suggestion notification email failed` and confirm the domain, API key, sender, and recipient values in Resend.


## Category dropdown database update (existing installations)

If the suggestions database already exists, run this once in the D1 Console before deploying this build:

```sql
ALTER TABLE suggestions ADD COLUMN category TEXT;
```

The same command is provided in `cloudflare/d1_add_suggestion_category.sql`. Existing suggestions are preserved and will show “No category”; all new suggestions must select a category.
