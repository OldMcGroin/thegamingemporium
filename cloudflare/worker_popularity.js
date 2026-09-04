/**
 * The Gaming Emporium - Popularity API (Cloudflare Worker)
 *
 * Routes:
 *  - GET  /api/click?id=<game-id>
 *  - GET  /api/top?mode=trending|all|hidden|rising&days=7&limit=10
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

      if (url.pathname === "/api/top") {
        const mode = (url.searchParams.get("mode") || "all").toLowerCase();
        const limit = clampInt(url.searchParams.get("limit"), 10, 1, 25);
        const days = clampInt(url.searchParams.get("days"), 7, 1, 30);
        const ids = (url.searchParams.get("ids") || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 50);

        let rows = [];

        // Global leaderboard modes are identical for every visitor, so do not
        // re-scan D1 on every request. Keep a tiny shared cache inside D1.
        // Category-specific requests (ids=...) are already selective and are
        // intentionally left uncached here.
        const cacheable = ids.length === 0 && ["all", "trending", "hidden", "rising"].includes(mode);
        const cacheLimit = mode === "hidden"
          ? clampInt(url.searchParams.get("limit"), 100, 1, 100)
          : limit;
        const cacheKey = cacheable
          ? `top:${mode}:days=${mode === "trending" ? days : 0}:limit=${cacheLimit}`
          : "";
        const cacheTtl = mode === "trending" ? 900 : (mode === "all" ? 900 : 1800);
        const now = Math.floor(Date.now() / 1000);

        if (cacheable) {
          try {
            const hit = await env.DB.prepare(
              `SELECT payload, updated_at FROM api_cache WHERE key = ?1 LIMIT 1`
            ).bind(cacheKey).first();
            if (hit && Number(hit.updated_at || 0) >= (now - cacheTtl)) {
              const cachedRows = JSON.parse(String(hit.payload || "[]"));
              if (Array.isArray(cachedRows)) {
                return json({ ok: true, mode, top: cachedRows }, 200, corsHeaders);
              }
            }
          } catch (cacheErr) {
            // Safe fallback if the cache table has not been created yet.
          }
        }

        if (mode === "rising") {
          // Rising: compare the last 3 days with the preceding 14-day baseline.
          // We smooth the baseline slightly and weight by recent volume so that
          // a project with 2 clicks after a quiet spell does not outrank one
          // with a genuinely meaningful surge. No extra D1 table is required.
          const recentDays = 3;
          const baselineDays = 14;
          const startOffset = -(recentDays + baselineDays - 1);
          const recentOffset = -(recentDays - 1);
          const risingLimit = clampInt(url.searchParams.get("limit"), 10, 1, 25);
          const q = `
            WITH momentum AS (
              SELECT
                id,
                SUM(CASE WHEN day >= date('now', ?1) THEN clicks ELSE 0 END) AS recent_count,
                SUM(CASE WHEN day < date('now', ?1) THEN clicks ELSE 0 END) AS baseline_count
              FROM events_daily
              WHERE day >= date('now', ?2)
              GROUP BY id
            )
            SELECT
              id,
              recent_count,
              baseline_count,
              ROUND(
                ((recent_count * recent_count) * ?3 * 1.0) /
                ((baseline_count + 1) * ?4),
                2
              ) AS score
            FROM momentum
            WHERE recent_count >= 2
              AND (recent_count * ?3 * 1.0 / ?4) > baseline_count
            ORDER BY score DESC, recent_count DESC
            LIMIT ?5
          `;
          const res = await env.DB.prepare(q).bind(
            `${recentOffset} days`,
            `${startOffset} days`,
            baselineDays,
            recentDays,
            risingLimit
          ).all();
          rows = res.results || [];
        } else if (mode === "hidden") {
          // Hidden Gems: return genuinely low-engagement projects directly
          // from D1 instead of making the browser probe thousands of IDs.
          // Keep only projects that have at least one click; eligibility by age
          // is applied client-side using the generated site data.
          const hiddenLimit = clampInt(url.searchParams.get("limit"), 100, 1, 100);
          // Avoid ORDER BY RANDOM(), which forces SQLite to inspect/sort a much
          // larger part of the clicks table. Read a low-click pool using the
          // count index, then shuffle the small result set in Worker memory.
          const poolLimit = Math.min(300, Math.max(hiddenLimit * 3, hiddenLimit));
          const res = await env.DB.prepare(
            `SELECT id, count FROM clicks WHERE count > 0 ORDER BY count ASC LIMIT ?1`
          ).bind(poolLimit).all();
          rows = shuffleRows(res.results || []).slice(0, hiddenLimit);
        } else if (mode === "trending") {
          // Last N days inclusive (e.g. days=7 => today + previous 6 days)
          const offset = -(days - 1);
          if (ids.length) {
            const marks = ids.map(() => "?").join(",");
            const q = `
              SELECT id, SUM(clicks) AS count
              FROM events_daily
              WHERE day >= date('now', ?) AND id IN (${marks})
              GROUP BY id
              HAVING count > 0
              ORDER BY count DESC
              LIMIT ?
            `;
            const res = await env.DB.prepare(q).bind(`${offset} days`, ...ids, limit).all();
            rows = res.results || [];
          } else {
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
          }
        } else {
          if (ids.length) {
            const marks = ids.map(() => "?").join(",");
            const q = `SELECT id, count FROM clicks WHERE id IN (${marks}) ORDER BY count DESC LIMIT ?`;
            const res = await env.DB.prepare(q).bind(...ids, limit).all();
            rows = res.results || [];
          } else {
            const res = await env.DB.prepare(
              `SELECT id, count FROM clicks ORDER BY count DESC LIMIT ?1`
            ).bind(limit).all();
            rows = res.results || [];
          }
        }

        if (cacheable) {
          try {
            await env.DB.prepare(
              `INSERT INTO api_cache (key, payload, updated_at)
               VALUES (?1, ?2, ?3)
               ON CONFLICT(key) DO UPDATE SET
                 payload = excluded.payload,
                 updated_at = excluded.updated_at`
            ).bind(cacheKey, JSON.stringify(rows), now).run();
          } catch (cacheErr) {
            // Safe fallback if the cache table has not been created yet.
          }
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

function shuffleRows(rows) {
  const out = Array.isArray(rows) ? rows.slice() : [];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function clampInt(v, fallback, min, max) {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
