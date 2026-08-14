# Popularity API: Trending + All‑time

Your site now supports **two tabs** in the “Most Popular” popover:

- 🔥 **Trending (last 7 days)**
- 🏆 **All‑time popular** (with gold/silver/bronze for ranks 1–3)

To make this work, your Cloudflare **Worker** needs to support the `mode=trending` query and your D1 database needs the `events_daily` table.

## 1) Update D1 schema

Cloudflare Dashboard → **... D1 Database** → your DB (`gaming-emporium-popularity`) → **Console**

Paste and execute the contents of:

- `cloudflare/d1_schema_popularity.sql`

(It's safe to run more than once.)

## 2) Update the Worker code

Cloudflare Dashboard → **Workers & Pages** → your worker (`gaming-emporium-popularity-api`) → **Edit code**

Replace the Worker code with:

- `cloudflare/worker_popularity.js`

Then **Deploy**.

## 3) Quick test

- Open `https://thegamingemporium.com/api/top?mode=all`
- Open `https://thegamingemporium.com/api/top?mode=trending&days=7`

Both should return JSON with `{ ok: true, top: [...] }`.

## Worker routes (important)

Popularity is click-based only. The site no longer calls `/api/view`.

If you use Cloudflare Worker Routes, do **not** route a broad `/api/*` pattern to the popularity Worker. Route only the endpoints it needs:

- `thegamingemporium.com/api/click*`
- `thegamingemporium.com/api/top*`

This prevents unrelated API requests from consuming the popularity Worker's request quota.

