export async function onRequestPost({request,env,waitUntil}) {
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  if(!env.SUGGESTIONS_DB)return json({message:'Reports database not configured'},503);
  try{
    const b=await request.json(),title=String(b.game_title||'').trim(),link=String(b.game_link||'').trim(),evidence=String(b.evidence_url||'').trim(),details=String(b.details||'').trim(),classification=String(b.classification||'');
    if(b.website)return json({ok:true});
    const validUrl=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)}catch{return false}};
    if(title.length<2||title.length>120||!validUrl(link)||link.length>500||(evidence&&!validUrl(evidence))||evidence.length>1000||details.length>2000||!['none','light','heavy'].includes(classification))return json({message:'Please provide a valid project and classification.'},400);
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+':tge-ai-reports-v1'));const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    const recent=await env.SUGGESTIONS_DB.prepare("SELECT COUNT(*) n FROM ai_reports WHERE ip_hash=? AND submitted_at>=datetime('now','-1 hour')").bind(hash).first();
    if(recent?.n>=5)return json({message:'Too many reports. Please try later.'},429);
    await env.SUGGESTIONS_DB.prepare("INSERT INTO ai_reports(game_title,game_link,classification,evidence_url,details,ip_hash) VALUES(?,?,?,?,?,?)").bind(title,link,classification,evidence,details,hash).run();
    if(env.RESEND_API_KEY&&env.SUGGESTION_NOTIFY_FROM&&env.SUGGESTION_NOTIFY_TO){waitUntil(fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.SUGGESTION_NOTIFY_FROM,to:[env.SUGGESTION_NOTIFY_TO],subject:'AI usage report: '+title,text:`Project: ${title}\nLink: ${link}\nSuggested: ${classification}\nAdditional Details/Evidence: ${details}\nReview: https://thegamingemporium.com/admin/ai-reports/`})}).catch(console.error));}
    return json({ok:true},201);
  }catch(e){console.error(e);return json({message:'Could not save report.'},500)}
}
