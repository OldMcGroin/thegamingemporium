const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
const validSlug=s=>typeof s==='string'&&/^[a-z0-9-]{1,160}$/.test(s);
async function eligible(request,env,project){
  if(!validSlug(project))return false;
  const url=new URL('/rating-projects.json',request.url);
  const response=await env.ASSETS.fetch(new Request(url.toString()));
  if(!response.ok)return false;
  const names=await response.json();return Array.isArray(names)&&names.includes(project);
}
const db=env=>env.RATINGS_DB||env.SUGGESTIONS_DB;
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function summary(db,project){
 const r=await db.prepare('SELECT stars, COUNT(*) AS n FROM project_ratings WHERE project=? GROUP BY stars').bind(project).all();
 const counts=[0,0,0,0,0];for(const v of r.results||[])counts[Number(v.stars)-1]=Number(v.n);
 const count=counts.reduce((a,b)=>a+b,0);const average=count>=3?Math.round(counts.reduce((a,n,i)=>a+n*(i+1),0)/count*10)/10:null;
 return {project,count,average,counts};
}
export async function onRequestGet({request,env}){
 const d=db(env);if(!d)return reply({error:'Ratings database is not configured'},503);
 try{
  const params=new URL(request.url).searchParams;
  const projects=(params.get('projects')||params.get('project')||'').split(',').filter(Boolean).slice(0,60);
  if(!projects.length||projects.some(x=>!validSlug(x)))return reply({error:'Invalid projects'},400);
  const data={};for(const project of projects){if(await eligible(request,env,project))data[project]=await summary(d,project);}
  return reply({ratings:data});
 }catch(e){console.error('ratings GET',e);return reply({error:'Ratings unavailable'},503)}
}
export async function onRequestPost({request,env}){
 const d=db(env);if(!d)return reply({error:'Ratings database is not configured'},503);
 try{
  const body=await request.json();const project=body.project,stars=body.stars;
  if(!Number.isInteger(stars)||stars<1||stars>5||!(await eligible(request,env,project)))return reply({error:'Invalid project or rating'},400);
  const cookie=request.headers.get('Cookie')||'';const found=cookie.match(/(?:^|;\s*)tge_rating_id=([a-f0-9]{64})(?:;|$)/);
  const token=found?.[1]||[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const voter=await hash(token);
  const ip=request.headers.get('CF-Connecting-IP')||'';
  const ipHash=await hash(ip+':tge-rating-ip-v1');
  const recent=await d.prepare("SELECT COUNT(*) AS n FROM project_rating_events WHERE ip_hash=? AND created_at >= datetime('now','-1 hour')").bind(ipHash).first();
  if(Number(recent?.n||0)>=20)return reply({error:'Too many ratings from this connection. Try again later.'},429);
  await d.batch([
    d.prepare("INSERT INTO project_ratings(project,voter_hash,stars,updated_at) VALUES(?,?,?,datetime('now')) ON CONFLICT(project,voter_hash) DO UPDATE SET stars=excluded.stars,updated_at=datetime('now')").bind(project,voter,stars),
    d.prepare('INSERT INTO project_rating_events(ip_hash) VALUES(?)').bind(ipHash)
  ]);
  return reply({ok:true,...await summary(d,project),yourRating:stars},200,{'Set-Cookie':`tge_rating_id=${token}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`});
 }catch(e){console.error('ratings POST',e);return reply({error:'Could not save rating'},503)}
}
