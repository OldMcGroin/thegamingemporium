export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.SUGGESTIONS_DB) return reply({ ok: false, message: "Suggestions database is not configured." }, 500);
    const body = await request.json().catch(() => ({}));
    const title = String(body.game_title || "").trim();
    const link = String(body.game_link || "").trim();
    const honeypot = String(body.website || "").trim();
    if (honeypot) return reply({ ok: true }, 200);
    if (title.length < 2 || title.length > 120) return reply({ ok: false, message: "Please enter a valid game title." }, 400);
    if (link.length > 500 || !isHttpUrl(link)) return reply({ ok: false, message: "Please enter a valid http or https link." }, 400);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash = await sha256(ip + ":tge-suggestions-v1");
    const recent = await env.SUGGESTIONS_DB.prepare(
      "SELECT COUNT(*) AS n FROM suggestions WHERE ip_hash = ?1 AND submitted_at >= datetime('now','-1 hour')"
    ).bind(ipHash).first();
    if ((recent?.n || 0) >= 5) return reply({ ok: false, message: "Too many suggestions were submitted recently. Please try again later." }, 429);

    const duplicate = await env.SUGGESTIONS_DB.prepare(
      "SELECT id FROM suggestions WHERE lower(game_title)=lower(?1) AND game_link=?2 AND submitted_at >= datetime('now','-7 days') LIMIT 1"
    ).bind(title, link).first();
    if (duplicate) return reply({ ok: false, message: "That suggestion has already been submitted recently." }, 409);

    await env.SUGGESTIONS_DB.prepare(
      "INSERT INTO suggestions (game_title, game_link, status, submitted_at, ip_hash) VALUES (?1, ?2, 'new', datetime('now'), ?3)"
    ).bind(title, link, ipHash).run();
    return reply({ ok: true }, 201);
  } catch (error) {
    console.error("Suggestion submission failed:", error);

    return reply({
      ok: false,
      message: error?.stack || error?.message || String(error)
    }, 500);
  }
}
export function onRequestOptions() { return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } }); }
function isHttpUrl(value) { try { const u = new URL(value); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } }
async function sha256(value) { const bytes = new TextEncoder().encode(value); const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join(""); }
function reply(data, status) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
