// TGE Game Manager: authenticated, single-record GitHub publisher.
// Required environment: ACCESS_TEAM_DOMAIN, ACCESS_AUD, GAME_MANAGER_ADMIN_EMAIL, GITHUB_TOKEN.
// One record per request avoids partial multi-file transactions.
const OWNER='OldMcGroin', REPO='thegamingemporium';
const BRANCH = env => String(env.GAME_MANAGER_GITHUB_BRANCH || '').trim();
const PATHS={game:'data/games.json',collection:'data/collections.json'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const from64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const to64=s=>{const bytes=new TextEncoder().encode(s);let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const canonical=x=>JSON.stringify(sortObject(x));
function sortObject(x){if(Array.isArray(x))return x.map(sortObject);if(obj(x))return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sortObject(x[k])]));return x}
function equal(a,b){return canonical(a)===canonical(b)}
async function identity(request,env){
 // Return only coarse, non-sensitive failure codes; never echo JWTs or identity claims.
 const fail=reason=>({ok:false,reason});
 const domain=String(env.ACCESS_TEAM_DOMAIN||'').trim().replace(/^https?:\/\//,'').replace(/\/$/,'');
 const aud=String(env.ACCESS_AUD||'').trim(), admin=String(env.GAME_MANAGER_ADMIN_EMAIL||'').trim().toLowerCase();
 if(!domain||!aud||!admin||!/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(domain))return fail('configuration_incomplete');
 const headerJwt=request.headers.get('Cf-Access-Jwt-Assertion');
 const cookieHeader=request.headers.get('Cookie')||'';
 const cookieJwt=cookieHeader.split(';').map(part=>part.trim()).find(part=>part.startsWith('CF_Authorization='))?.slice('CF_Authorization='.length);
 const jwt=headerJwt||cookieJwt;
 if(!jwt)return fail('access_token_missing');
 const p=jwt.split('.');if(p.length!==3)return fail('access_token_malformed');
 try{
  const h=JSON.parse(new TextDecoder().decode(from64(p[0]))),v=JSON.parse(new TextDecoder().decode(from64(p[1]))),now=Math.floor(Date.now()/1000);
  if(h.alg!=='RS256'||typeof h.kid!=='string')return fail('access_token_format');
  if(v.iss!==`https://${domain}`)return fail('access_token_issuer');
  if(!(Array.isArray(v.aud)?v.aud.includes(aud):v.aud===aud))return fail('access_token_audience');
  if(!Number.isFinite(v.exp)||v.exp<=now||!Number.isFinite(v.iat)||v.iat>now+60)return fail('access_token_time');
  if(String(v.email||'').trim().toLowerCase()!==admin)return fail('administrator_email_mismatch');
  const certs=await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if(!certs.ok)return fail('access_certs_unavailable');
  const keys=await certs.json(),jwk=keys.keys?.find(k=>k.kid===h.kid&&k.kty==='RSA');
  if(!jwk)return fail('access_signing_key_missing');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,from64(p[2]),new TextEncoder().encode(`${p[0]}.${p[1]}`))))return fail('access_signature_invalid');
  return {ok:true};
 }catch{return fail('access_token_verification_error')}
}
async function github(env,path,options={}){
 const url=`https://api.github.com/repos/${OWNER}/${REPO}/${path.startsWith('git/')?path:'contents/'+path}`;
 const r=await fetch(url,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'thegamingemporium-game-manager',...(options.headers||{})}});
 const data=await r.json().catch(()=>({}));if(!r.ok){const e=new Error('GitHub request failed');e.status=r.status;throw e}return data;
}
async function readFile(env,path){
 const meta=await github(env,path+'?ref='+encodeURIComponent(BRANCH(env)));
 if(!/^[a-f0-9]{40}$/i.test(meta.sha||''))throw Error('Invalid file SHA');
 let encoded=meta.encoding==='base64'?meta.content:null;
 if(!encoded){const blob=await github(env,'git/blobs/'+meta.sha);if(blob.encoding!=='base64')throw Error('Unsupported blob');encoded=blob.content}
 if(!encoded)throw Error('Missing file content');
 const list=JSON.parse(new TextDecoder().decode(from64(encoded.replace(/\s/g,''))));if(!Array.isArray(list))throw Error('Unexpected JSON format');
 return {sha:meta.sha,list};
}
const validUrl=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)}catch{return false}};
function validate(type,r){
 if(!obj(r))return 'Record must be an object';
 if(type==='game'){
  if(!Number.isSafeInteger(r.id)||r.id<1)return 'Invalid game ID';
  if(typeof r.title!=='string'||!r.title.trim()||r.title.length>250)return 'Invalid game title';
  if(typeof r.category!=='string'||!r.category.trim()||r.category.length>100)return 'Invalid category';
  if(typeof r.link!=='string'||r.link.length>2048||!validUrl(r.link))return 'Invalid project URL';
  if(r.video_link&&(!validUrl(r.video_link)||r.video_link.length>2048))return 'Invalid video URL';
  if(r.ai_usage&&!['none','light','heavy','unknown'].includes(r.ai_usage))return 'Invalid AI usage';
  if(r.weight!==undefined&&r.weight!==''&&r.weight!==0&&r.weight!=='top'&&!(Number.isSafeInteger(r.weight)&&r.weight>=0))return 'Invalid weight';
  if(r.hidden!==undefined&&typeof r.hidden!=='boolean')return 'Invalid hidden flag';
 }else{
  if(typeof r.name!=='string'||!r.name.trim()||r.name.length>250)return 'Invalid collection name';
  if(typeof r.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||r.slug.length>150)return 'Invalid collection slug';
  if(typeof r.enabled!=='boolean')return 'Invalid enabled flag';
  if(r.weight!==0&&r.weight!=='top'&&!(Number.isSafeInteger(r.weight)&&r.weight>=0))return 'Invalid collection weight';
 }
 if(JSON.stringify(r).length>25000)return 'Record is too large';
 return null;
}
// Read-only authenticated Preview publishing status. Does not access GitHub or drafts.
// Both switches must be explicitly enabled for live publishing. Defaults are fail-closed.
// Production deployment is separate from permission to write to the main branch.
function publishGate(env){
 const branch=BRANCH(env);
 if(branch==='game-manager-publishing-test')return {branch,enabled:env.GAME_MANAGER_PUBLISH_ENABLED==='true'};
 if(branch==='main')return {branch,enabled:env.GAME_MANAGER_PUBLISH_ENABLED==='true'&&env.GAME_MANAGER_PRODUCTION_APPROVED==='true'};
 return {branch,enabled:false};
}
export async function onRequestGet({request,env}){
 const auth=await identity(request,env);
 if(!auth.ok)return reply({ok:false,message:'Administrator authentication required.',diagnostic:auth.reason},403);
 const gate=publishGate(env);
 if(!['game-manager-publishing-test','main'].includes(gate.branch))return reply({ok:false,message:'Publishing branch is not approved.'},403);
 return reply({ok:true,enabled:gate.enabled,branch:gate.branch});
}
export async function onRequestPost({request,env}){
 const auth=await identity(request,env);
 if(!auth.ok)return reply({ok:false,message:'Administrator authentication required or configuration incomplete.',diagnostic:auth.reason},403);
 const gate=publishGate(env);
 if(!['game-manager-publishing-test','main'].includes(gate.branch))
  return reply({ok:false,message:'Publishing branch is not approved.'},403);
 if(!gate.enabled)
  return reply({ok:false,message:'Game Manager publishing is disabled.'},503);
 if(!env.GITHUB_TOKEN)return reply({ok:false,message:'GitHub publishing is not configured.'},503);
 const length=Number(request.headers.get('content-length')||0);if(length>1800000)return reply({ok:false,message:'Request too large.'},413);
 let body;try{body=await request.json()}catch{return reply({ok:false,message:'Invalid JSON.'},400)}
 if(!obj(body)||!['game','collection'].includes(body.type)||!['create','update'].includes(body.action)||!obj(body.record))return reply({ok:false,message:'Invalid publish request.'},400);
 const {type,action,record,before}=body,err=validate(type,record);if(err)return reply({ok:false,message:err},400);
 const imageUpload=body.imageUpload;
 if(imageUpload!==undefined){
  if(type!=='game'||!obj(imageUpload)||imageUpload.mime!=='image/webp'||typeof imageUpload.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(imageUpload.base64)||imageUpload.base64.length>1400000||imageUpload.base64.length<40)return reply({ok:false,message:'Invalid or oversized WebP upload.'},400);
  if(!/^\/Images\/Games\/manager-[1-9][0-9]*-[a-f0-9]{16}\.webp$/.test(record.image||''))return reply({ok:false,message:'Invalid image destination.'},400);
  if(!record.image.startsWith('/Images/Games/manager-'+record.id+'-'))return reply({ok:false,message:'Image must belong to this game ID.'},400);
  const head=atob(imageUpload.base64.slice(0,32));
  if(!head.startsWith('RIFF')||head.slice(8,12)!=='WEBP')return reply({ok:false,message:'Uploaded data is not a WebP image.'},400);
 }

 if(action==='update'&&(!obj(before)||(type==='game'?!Number.isSafeInteger(before.id):typeof before.slug!=='string')))return reply({ok:false,message:'An original record is required to safely update.'},400);
 if(action==='create'&&before!==undefined&&before!==null)return reply({ok:false,message:'Create requests must not include an original record.'},400);
 if(action==='update'&&(type==='game'?record.id!==before.id:record.slug!==before.slug))return reply({ok:false,message:'Changing an existing record identifier is not supported.'},400);
 const path=PATHS[type];
 try{
  const file=await readFile(env,path),list=file.list;
  const key=type==='game'?'id':'slug',id=record[key];
  const found=list.filter(x=>x?.[key]===id);
  if(found.length>1)return reply({ok:false,message:'Duplicate identifiers already exist in GitHub. No changes made.'},409);
  if(action==='create'){
   if(found.length)return reply({ok:false,message:'This ID or slug is already in use. Refresh your drafts before publishing.'},409);
   list.push(record);
  }else{
   if(found.length!==1||!equal(found[0],before))return reply({ok:false,message:'This record changed on GitHub since your draft was created. Refresh and review before publishing.'},409);
   const idx=list.findIndex(x=>x?.[key]===id);
   // Keep unedited properties supplied in the original record; reject stale changes.
   list[idx]={...found[0],...record};
  }
  const ids=new Set();for(const item of list){const k=item?.[key];if(ids.has(k))return reply({ok:false,message:'Duplicate identifiers detected. No changes made.'},409);ids.add(k)}
  // Create ONE Git commit containing both the updated JSON and the artwork.
  // Neither file becomes visible on the branch unless the final ref update succeeds.
  const branch=BRANCH(env);
  const refPath='git/ref/heads/'+encodeURIComponent(branch);
  const ref=await github(env,refPath);
  const head=ref.object?.sha;
  if(!/^[a-f0-9]{40}$/i.test(head||''))throw Error('Invalid branch head');
  const parent=await github(env,'git/commits/'+head);
  const baseTree=parent.tree?.sha;
  if(!/^[a-f0-9]{40}$/i.test(baseTree||''))throw Error('Invalid base tree');
  // The data file must still be the version checked for record conflicts.
  const headFile=await github(env,path+'?ref='+encodeURIComponent(head));
  if(headFile.sha!==file.sha)return reply({ok:false,message:'Game data changed during publishing. Refresh and try again.'},409);
  const entries=[];
  const jsonBlob=await github(env,'git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:JSON.stringify(list,null,2)+'\n',encoding:'utf-8'})});
  entries.push({path,mode:'100644',type:'blob',sha:jsonBlob.sha});
  if(imageUpload){
   const imgPath='static'+record.image;
   // Reject any filename already present at the branch head, even if a
   // concurrent editor supplied a colliding name.
   try{await github(env,imgPath+'?ref='+encodeURIComponent(head));return reply({ok:false,message:'Image filename already exists; choose the image again.'},409)}catch(e){if(e.status!==404)throw e}
   const imageBlob=await github(env,'git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:imageUpload.base64,encoding:'base64'})});
   entries.push({path:imgPath,mode:'100644',type:'blob',sha:imageBlob.sha});
  }
  const tree=await github(env,'git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:baseTree,tree:entries})});
  const commit=await github(env,'git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Game Manager: ${action} ${type} ${String(type==='game'?record.title:record.name).slice(0,100)}`,tree:tree.sha,parents:[head]})});
  // force:false prevents overwriting concurrent pushes. If this fails, the
  // branch remains unchanged: no orphan artwork file and no partial update.
  await github(env,'git/refs/heads/'+encodeURIComponent(branch),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:commit.sha,force:false})});
  return reply({ok:true,message:'Published to GitHub. Deployment may take a few minutes.',type,action,id});
 }catch(e){console.error('Game Manager publish failed',e);return reply({ok:false,message:[409,422].includes(e.status)?'GitHub changed during publishing. Refresh and try again.':'Publishing failed. Check Cloudflare function logs and GitHub permissions.'},[409,422].includes(e.status)?409:502)}
}
