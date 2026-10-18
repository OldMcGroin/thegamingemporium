const json=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const db=e=>e.RATINGS_DB||e.SUGGESTIONS_DB;
const slug=s=>typeof s==='string'&&/^[a-z0-9-]{1,160}$/.test(s);
const statuses=['completed','issues','partial','broken','untested'];
const platforms=['Windows','Linux','Steam Deck','Android','Other'];
async function eligible(request,env,project){if(!slug(project))return false;const r=await env.ASSETS.fetch(new Request(new URL('/rating-projects.json',request.url)));return r.ok&&(await r.json()).includes(project)}
async function hash(s){const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
export async function onRequestGet({request,env}){
 const d=db(env),project=new URL(request.url).searchParams.get('project');if(!d)return json({error:'Database unavailable'},503);
 if(!(await eligible(request,env,project)))return json({error:'Invalid project'},400);
 try{const counts=await d.prepare('SELECT status, COUNT(*) AS n FROM project_playability WHERE project=? AND visible=1 GROUP BY status').bind(project).all();
 const reports=await d.prepare('SELECT status,platform,details,build_version,updated_at FROM project_playability WHERE project=? AND visible=1 ORDER BY updated_at DESC LIMIT 30').bind(project).all();
 return json({counts:counts.results,reports:reports.results});}catch(e){console.error(e);return json({error:'Playability database needs migration'},503)}
}
export async function onRequestPost({request,env}){
 const d=db(env);if(!d)return json({error:'Database unavailable'},503);
 try{const b=await request.json();if(!(await eligible(request,env,b.project))||!statuses.includes(b.status)||!platforms.includes(b.platform)||typeof b.details!=='string'||b.details.length>1500||typeof b.build_version!=='string'||b.build_version.length>100)return json({error:'Invalid report'},400);
 const cookie=request.headers.get('Cookie')||'';const found=cookie.match(/(?:^|;\s*)tge_rating_id=([a-f0-9]{64})(?:;|$)/);const token=found?.[1]||Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
 const voter=await hash(token),ip=await hash((request.headers.get('CF-Connecting-IP')||'')+':tge-playability-v1');
 const recent=await d.prepare("SELECT COUNT(*) AS n FROM project_playability_events WHERE ip_hash=? AND created_at>=datetime('now','-1 hour')").bind(ip).first();if(Number(recent?.n||0)>=10)return json({error:'Too many submissions. Try later.'},429);
 await d.batch([d.prepare("INSERT INTO project_playability(project,voter_hash,status,platform,details,build_version,visible,updated_at) VALUES(?,?,?,?,?,?,1,datetime('now')) ON CONFLICT(project,voter_hash) DO UPDATE SET status=excluded.status,platform=excluded.platform,details=excluded.details,build_version=excluded.build_version,visible=1,updated_at=datetime('now')").bind(b.project,voter,b.status,b.platform,b.details.trim(),b.build_version.trim()),d.prepare('INSERT INTO project_playability_events(ip_hash) VALUES(?)').bind(ip)]);
 return json({ok:true},200,{'Set-Cookie':`tge_rating_id=${token}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`});
 }catch(e){console.error(e);return json({error:'Unable to save report'},503)}
}
