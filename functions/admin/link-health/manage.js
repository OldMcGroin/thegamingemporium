const OWNER='OldMcGroin', REPO='thegamingemporium', BRANCH='main', FILE='data/games.json';
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
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
async function github(env, path, options = {}) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path.startsWith("git/blobs/") ? path : "contents/" + path}`, {
    ...options, headers: {'Accept':'application/vnd.github+json','Authorization':`Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version':'2022-11-28','User-Agent':'thegamingemporium-link-health', ...(options.headers || {})}
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(`GitHub ${r.status}: ${json.message || 'Request failed'}`);
  return json;
}
export async function onRequestPost({request,env}) {
 if(!(await authorized(request,env)))return respond({message:'Cloudflare Access administrator authentication required.'},403);
 if(!env.GITHUB_TOKEN)return respond({message:'GITHUB_TOKEN not configured.'},503);
 let body;try{body=await request.json();}catch{return respond({message:'Invalid JSON.'},400);}
 const {id,expected_link,field,value}=body||{};
 if(field==='review'){
  if(typeof expected_link!=='string'||!['ok','clear'].includes(value))return respond({message:'Invalid review.'},400);
  try{
   const gamefile=await github(env,FILE+'?ref='+BRANCH);
   let raw=gamefile.content;
   if(!raw||gamefile.encoding!=='base64')raw=(await github(env,'git/blobs/'+gamefile.sha)).content;
   const games=JSON.parse(new TextDecoder().decode(bytes(raw.replace(/\s/g,''))));
   if(!games.some(g=>String(g.id)===String(id)&&g.link===expected_link))return respond({message:'Game link has changed. Refresh first.'},409);
   const path='static/link-health-reviews.json';let existing=null,reviews={};
   try{existing=await github(env,path+'?ref='+BRANCH);let content=existing.content;if(!content||existing.encoding!=='base64')content=(await github(env,'git/blobs/'+existing.sha)).content;reviews=JSON.parse(new TextDecoder().decode(bytes(content.replace(/\s/g,''))));}catch(e){if(!String(e).includes('GitHub 404'))throw e;}
   if(value==='ok')reviews[String(id)]={url:expected_link,detail:String(body.detail||'').slice(0,200),checked_at:new Date().toISOString()};else delete reviews[String(id)];
   const encoded=btoa(Array.from(new TextEncoder().encode(JSON.stringify(reviews,null,2)+'\n'),c=>String.fromCharCode(c)).join(''));
   await github(env,path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Link health: review ${value} game ${id}`,content:encoded,...(existing?{sha:existing.sha}:{}),branch:BRANCH})});
   return respond({ok:true,review:reviews[String(id)]||null});
  }catch(e){console.error('Link health review:',e);return respond({message:'Unable to save review to GitHub. Check permissions.'},502);}
 }

 if(!Number.isSafeInteger(Number(id))||!['hidden','link'].includes(field))return respond({message:'Invalid game or field.'},400);
 if(field==='hidden'&&typeof value!=='boolean')return respond({message:'Invalid visibility value.'},400);
 if(field==='link'){
  try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||String(value).length>2048)throw Error();}
  catch{return respond({message:'A valid HTTP(S) URL is required.'},400);}
 }
 try{
  const file=await github(env,FILE+'?ref='+BRANCH);let content=file.content;
  if(!content||file.encoding!=='base64'){
   if(!/^[0-9a-f]{40}$/i.test(file.sha||''))throw Error('Missing GitHub SHA');
   const blob=await github(env,'git/blobs/'+file.sha);content=blob.content;
  }
  if(!content)throw Error('Missing GitHub content');
  const games=JSON.parse(new TextDecoder().decode(bytes(content.replace(/\s/g,''))));
  const matches=games.filter(x=>String(x.id)===String(id));
  if(matches.length!==1)return respond({message:'Game ID is missing or duplicated. No changes made.'},409);
  const game=matches[0];
  if(game.link!==expected_link)return respond({message:'This link has changed since the report was generated. Refresh before editing.'},409);
  if(field==='hidden')game.hidden=value;else game.link=value;
  const updated=JSON.stringify(games,null,2)+'\n';
  const binary=Array.from(new TextEncoder().encode(updated),c=>String.fromCharCode(c)).join('');
  await github(env,FILE,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Link health: ${field} for game ${id}`,content:btoa(binary),sha:file.sha,branch:BRANCH})});
  return respond({ok:true});
 }catch(e){console.error('Link health manage:',e);return respond({message:'GitHub update failed. Check token, permissions and repository state.'},502);}
}
