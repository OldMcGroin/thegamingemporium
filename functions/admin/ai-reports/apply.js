// Cloudflare Pages Function: approve a submitted AI usage report and commit to GitHub.
// Required Production secrets/variables: GITHUB_TOKEN, ACCESS_TEAM_DOMAIN, ACCESS_AUD.
const OWNER = 'OldMcGroin';
const REPO = 'thegamingemporium';
const BRANCH = 'main';
const FILE = 'data/games.json';
const allowed = new Set(['none', 'light', 'heavy']);
const respond = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const bytes = str => Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
const decode = str => JSON.parse(new TextDecoder().decode(bytes(str)));

async function authorized(request, env) {
  const domain = String(env.ACCESS_TEAM_DOMAIN || '').trim().replace(/^https?:\/\//,'').replace(/\/$/,'');
  const aud = String(env.ACCESS_AUD || '').trim();
  if (!domain || !aud || !/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(domain)) return false;
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return false;
  const parts = jwt.split('.');
  if (parts.length !== 3) return false;
  let header, payload;
  try { header = decode(parts[0]); payload = decode(parts[1]); } catch { return false; }
  const now = Math.floor(Date.now()/1000);
  if (header.alg !== 'RS256' || !header.kid || payload.iss !== `https://${domain}` ||
      !(Array.isArray(payload.aud) ? payload.aud.includes(aud) : payload.aud === aud) ||
      !Number.isFinite(payload.exp) || payload.exp <= now || !Number.isFinite(payload.iat) || payload.iat > now + 60) return false;
  try {
    const response = await fetch(`https://${domain}/cdn-cgi/access/certs`);
    if (!response.ok) return false;
    const jwks = await response.json();
    const jwk = jwks.keys?.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(parts[0]+'.'+parts[1]));
  } catch { return false; }
}
function normalize(url) {
  try { const u = new URL(url); if (!['http:','https:'].includes(u.protocol)) return ''; u.hash=''; return (u.origin+u.pathname.replace(/\/+$/,'')+u.search).toLowerCase(); }
  catch { return ''; }
}
async function github(env, path, options = {}) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    ...options, headers: {'Accept':'application/vnd.github+json','Authorization':`Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version':'2022-11-28','User-Agent':'thegamingemporium-ai-reports', ...(options.headers || {})}
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(`GitHub ${r.status}: ${json.message || 'Request failed'}`);
  return json;
}
export async function onRequestPost({request, env}) {
  if (!(await authorized(request, env))) return respond({ok:false,message:'Administrator authentication required or Access configuration missing.'},403);
  if (!env.GITHUB_TOKEN || !env.SUGGESTIONS_DB) return respond({ok:false,message:'GitHub token or reports database not configured.'},503);
  let id;
  try { id = Number((await request.json()).id); } catch { return respond({ok:false,message:'Invalid JSON.'},400); }
  if (!Number.isSafeInteger(id) || id < 1) return respond({ok:false,message:'Invalid report ID.'},400);
  try {
    const report = await env.SUGGESTIONS_DB.prepare('SELECT id, game_title, game_link, classification, status FROM ai_reports WHERE id=?1').bind(id).first();
    if (!report) return respond({ok:false,message:'Report no longer exists.'},404);
    if (report.status !== 'new') return respond({ok:false,message:'Only new reports can be applied.'},409);
    if (!allowed.has(report.classification)) return respond({ok:false,message:'Invalid classification.'},400);
    const file = await github(env, FILE+'?ref='+encodeURIComponent(BRANCH));
    // GitHub's Contents API omits `content` for files larger than 1 MB.
    // Retrieve the blob separately in that case (the Git Blobs API supports larger files).
    let content = file.content;
    if (!content || file.encoding !== 'base64') {
      if (!file.sha || !/^[0-9a-f]{40}$/i.test(file.sha)) throw Error('GitHub did not return a valid file SHA');
      const blob = await github(env, `git/blobs/${file.sha}`);
      if (blob.encoding !== 'base64' || !blob.content) throw Error('GitHub blob content unavailable');
      content = blob.content;
    }
    const raw = new TextDecoder().decode(bytes(content.replace(/\s/g,'')));
    const games = JSON.parse(raw);
    if (!Array.isArray(games)) throw Error('Unexpected games.json format');
    const link = normalize(report.game_link);
    const matches = games.filter(g => String(g.title || '').trim().toLowerCase() === String(report.game_title || '').trim().toLowerCase() && normalize(g.link) === link);
    if (!link || matches.length !== 1) return respond({ok:false,message:`Could not identify exactly one game (found ${matches.length}). No changes made.`},409);
    const game = matches[0];
    if (game.ai_usage !== report.classification) {
      game.ai_usage = report.classification;
      const updated = JSON.stringify(games, null, 2) + '\n';
      const encoded = btoa(Array.from(new TextEncoder().encode(updated), c => String.fromCharCode(c)).join(''));
      await github(env, FILE, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Apply AI usage classification: ${game.title} (${report.classification})`,content:encoded,sha:file.sha,branch:BRANCH})});
    }
    try {
      await env.SUGGESTIONS_DB.prepare("UPDATE ai_reports SET status='reviewed' WHERE id=?1 AND status='new'").bind(id).run();
    } catch { return respond({ok:true,warning:'GitHub updated, but report could not be marked reviewed. Please mark it manually.',classification:report.classification,game:game.title}); }
    return respond({ok:true,game:game.title,classification:report.classification,message:'GitHub updated. Cloudflare deployment may take a few minutes.'});
  } catch (e) {
    console.error('Apply AI classification failed',e);
    return respond({ok:false,message:'Could not update GitHub. Check repository permissions and deployment logs.'},502);
  }
}
