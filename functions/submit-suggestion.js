export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.SUGGESTIONS_DB) {
      return reply({ ok: false, message: "Suggestions database is not configured." }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body.game_title || "").trim();
    const link = String(body.game_link || "").trim();
    const category = String(body.category || "").trim();
    const honeypot = String(body.website || "").trim();

    if (honeypot) return reply({ ok: true }, 200);
    if (title.length < 2 || title.length > 120) {
      return reply({ ok: false, message: "Please enter a valid game title." }, 400);
    }
    if (link.length > 500 || !isHttpUrl(link)) {
      return reply({ ok: false, message: "Please enter a valid http or https link." }, 400);
    }
    if (!CATEGORY_LABELS[category]) {
      return reply({ ok: false, message: "Please select a valid category." }, 400);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash = await sha256(ip + ":tge-suggestions-v1");

    const recent = await env.SUGGESTIONS_DB.prepare(
      "SELECT COUNT(*) AS n FROM suggestions WHERE ip_hash = ?1 AND submitted_at >= datetime('now','-1 hour')"
    ).bind(ipHash).first();

    if ((recent?.n || 0) >= 5) {
      return reply({ ok: false, message: "Too many suggestions were submitted recently. Please try again later." }, 429);
    }

    const duplicate = await env.SUGGESTIONS_DB.prepare(
      "SELECT id FROM suggestions WHERE lower(game_title)=lower(?1) AND game_link=?2 AND submitted_at >= datetime('now','-7 days') LIMIT 1"
    ).bind(title, link).first();

    if (duplicate) {
      return reply({ ok: false, message: "That suggestion has already been submitted recently." }, 409);
    }

    await env.SUGGESTIONS_DB.prepare(
      "INSERT INTO suggestions (game_title, game_link, category, status, submitted_at, ip_hash) VALUES (?1, ?2, ?3, 'new', datetime('now'), ?4)"
    ).bind(title, link, category, ipHash).run();

    // Email is deliberately sent after the database write and in the background.
    // A temporary email-provider failure will never make a valid suggestion look failed.
    if (emailNotificationsConfigured(env)) {
      context.waitUntil(
        sendSuggestionEmail(env, { title, link, category }).catch((error) => {
          console.error("Suggestion notification email failed:", error);
        })
      );
    }

    return reply({ ok: true }, 201);
  } catch (error) {
    console.error("Suggestion submission failed:", error);

    return reply({
      ok: false,
      message: error?.stack || error?.message || String(error)
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "POST, OPTIONS" }
  });
}

function emailNotificationsConfigured(env) {
  return Boolean(
    env.RESEND_API_KEY &&
    env.SUGGESTION_NOTIFY_TO &&
    env.SUGGESTION_NOTIFY_FROM
  );
}

async function sendSuggestionEmail(env, suggestion) {
  const adminUrl = String(
    env.SUGGESTION_ADMIN_URL ||
    "https://thegamingemporium.com/admin/suggestions/"
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.SUGGESTION_NOTIFY_FROM,
      to: [env.SUGGESTION_NOTIFY_TO],
      subject: `New game suggestion: ${suggestion.title}`,
      text: [
        "A new game suggestion was submitted to The Gaming Emporium.",
        "",
        `Game: ${suggestion.title}`,
        `Category: ${categoryLabel(suggestion.category)}`,
        `Submitted link: ${suggestion.link}`,
        "",
        `Open the Suggestion Inbox: ${adminUrl}`
      ].join("\n"),
      html: buildEmailHtml(suggestion, adminUrl)
    })
  });

  const body = await response.text().catch(()=>"");
  if (!response.ok) {
    console.error("[Resend] Email failed", {
      status: response.status,
      recipient: env.SUGGESTION_NOTIFY_TO,
      title: suggestion.title,
      response: body
    });
    throw new Error(`Resend returned ${response.status}: ${body || response.statusText}`);
  }
  console.log("[Resend] Email sent", {
    status: response.status,
    recipient: env.SUGGESTION_NOTIFY_TO,
    title: suggestion.title,
    response: body
  });
}

function buildEmailHtml(suggestion, adminUrl) {
  const safeTitle = escapeHtml(suggestion.title);
  const safeLink = escapeHtml(suggestion.link);
  const safeCategory = escapeHtml(categoryLabel(suggestion.category));
  const safeAdminUrl = escapeHtml(adminUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#111;color:#f5f5f5;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;background:#1d1d1d;border:1px solid #3a3a3a;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 18px;font-size:24px;">New game suggestion</h1>
      <p style="margin:0 0 8px;color:#bdbdbd;">A visitor submitted:</p>
      <p style="margin:0 0 10px;font-size:20px;font-weight:700;">${safeTitle}</p>
      <p style="margin:0 0 18px;color:#bdbdbd;"><strong style="color:#f5f5f5;">Category:</strong> ${safeCategory}</p>
      <p style="margin:0 0 24px;word-break:break-word;">
        <a href="${safeLink}" style="color:#ffcf00;">${safeLink}</a>
      </p>
      <a href="${safeAdminUrl}" style="display:inline-block;background:#ffcf00;color:#111;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;">
        Open Suggestion Inbox
      </a>
    </div>
  </body>
</html>`;
}

const CATEGORY_LABELS = Object.freeze({
  "abandonware": "Abandonware",
  "android-ports": "Android Ports",
  "console-ports": "Console To Console Ports",
  "console-to-pc-port": "Console To PC Ports",
  "decompilations-recompilations": "Decompilations & Recompilations",
  "english-translation-patches": "English Translation Patches",
  "fan-games": "Fan Games & Homebrew",
  "guides": "Guides",
  "in-the-works": "In The Works",
  "mods": "Mods",
  "open-source": "Open Source",
  "preserved-games": "Preserved Games",
  "rom-hacks": "ROM Hacks",
  "texture-packs": "Texture Packs",
  "utility": "Utilities",
  "vr-ports": "VR Ports"
});

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
