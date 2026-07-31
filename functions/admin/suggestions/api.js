export async function onRequestGet({ request, env }) {
  if (!env.SUGGESTIONS_DB) return reply({ ok: false, message: "Database not configured." }, 500);
  try {
    const url = new URL(request.url);
    const requested = url.searchParams.get("status");
    const status = ["new", "reviewed", "all"].includes(requested) ? requested : "new";
    const sql = status === "all"
      ? "SELECT id, game_title, game_link, category, status, submitted_at FROM suggestions ORDER BY datetime(submitted_at) DESC LIMIT 500"
      : "SELECT id, game_title, game_link, category, status, submitted_at FROM suggestions WHERE status=?1 ORDER BY datetime(submitted_at) DESC LIMIT 500";
    const result = status === "all"
      ? await env.SUGGESTIONS_DB.prepare(sql).all()
      : await env.SUGGESTIONS_DB.prepare(sql).bind(status).all();
    return reply({ ok: true, suggestions: result.results || [] }, 200);
  } catch {
    return reply({ ok: false, message: "Could not load suggestions." }, 500);
  }
}

export async function onRequestPatch({ request, env }) {
  if (!env.SUGGESTIONS_DB) return reply({ ok: false, message: "Database not configured." }, 500);
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const status = String(body.status || "");
    if (!Number.isInteger(id) || id < 1 || !["new", "reviewed"].includes(status)) {
      return reply({ ok: false, message: "Invalid request." }, 400);
    }
    await env.SUGGESTIONS_DB.prepare("UPDATE suggestions SET status=?1 WHERE id=?2").bind(status, id).run();
    return reply({ ok: true }, 200);
  } catch {
    return reply({ ok: false, message: "Could not update the suggestion." }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!env.SUGGESTIONS_DB) return reply({ ok: false, message: "Database not configured." }, 500);
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return reply({ ok: false, message: "Invalid suggestion." }, 400);
    await env.SUGGESTIONS_DB.prepare("DELETE FROM suggestions WHERE id=?1").bind(id).run();
    return reply({ ok: true }, 200);
  } catch {
    return reply({ ok: false, message: "Could not delete the suggestion." }, 500);
  }
}

function reply(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
