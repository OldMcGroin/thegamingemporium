/**
 * The Gaming Emporium - Popularity API (Cloudflare Worker)
 *
 * Routes:
 *  - GET  /api/click?id=<game-id>
 *  - GET  /api/view?id=<game-id>
 *  - GET  /api/top?mode=trending|all&days=7&limit=10
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS (simple + permissive)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname === "/api/click") {
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ ok: false, error: "missing_id" }, 400, corsHeaders);

        // All-time counter
        await env.DB.prepare(
          `INSERT INTO clicks (id, count, updated_at)
           VALUES (?1, 1, unixepoch())
           ON CONFLICT(id) DO UPDATE SET
             count = count + 1,
             updated_at = unixepoch()`
        ).bind(id).run();

        // Rolling window (daily) counter
        await env.DB.prepare(
          `INSERT INTO events_daily (day, id, clicks, views)
           VALUES (date('now'), ?1, 1, 0)
           ON CONFLICT(day, id) DO UPDATE SET
             clicks = clicks + 1`
        ).bind(id).run();

        return json({ ok: true }, 200, corsHeaders);
      }

      if (url.pathname === "/api/view") {
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ ok: false, error: "missing_id" }, 400, corsHeaders);

        // Views are stored only in the daily table (used for future tweaks)
        await env.DB.prepare(
          `INSERT INTO events_daily (day, id, clicks, views)
           VALUES (date('now'), ?1, 0, 1)
           ON CONFLICT(day, id) DO UPDATE SET
             views = views + 1`
        ).bind(id).run();

        return json({ ok: true }, 200, corsHeaders);
      }

      if (url.pathname === "/api/top") {
        const mode = (url.searchParams.get("mode") || "all").toLowerCase();
        const limit = clampInt(url.searchParams.get("limit"), 10, 1, 25);
        const days = clampInt(url.searchParams.get("days"), 7, 1, 30);

        let rows = [];

        if (mode === "trending") {
          // Last N days inclusive (e.g. days=7 => today + previous 6 days)
          const offset = -(days - 1);
          const q = `
            SELECT id, SUM(clicks) AS count
            FROM events_daily
            WHERE day >= date('now', ?1)
            GROUP BY id
            HAVING count > 0
            ORDER BY count DESC
            LIMIT ?2
          `;
          const res = await env.DB.prepare(q).bind(`${offset} days`, limit).all();
          rows = res.results || [];
        } else {
          const res = await env.DB.prepare(
            `SELECT id, count FROM clicks ORDER BY count DESC LIMIT ?1`
          ).bind(limit).all();
          rows = res.results || [];
        }

        return json({ ok: true, mode, top: rows }, 200, corsHeaders);
      }

      return json({ ok: false, error: "not_found" }, 404, corsHeaders);
    } catch (err) {
      return json({ ok: false, error: "server_error" }, 500, corsHeaders);
    }
  },
};

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function clampInt(v, fallback, min, max) {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
