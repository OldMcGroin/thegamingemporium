/* TGE reusable bulk importer. Browser-local drafts only; never publishes. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const key='tge_manager_stage1_drafts';
const norm=value=>{try{const u=new URL(value);return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/+$/,'').toLowerCase()}catch{return String(value||'').trim().toLowerCase()}};
// Read the latest published baseline from GitHub main, never from the potentially stale preview.
// Always read the authoritative published data; the static Manager's embedded baseline
// can lag behind data/games.json by hundreds of records.
const remoteURL='https://raw.githubusercontent.com/OldMcGroin/thegamingemporium/main/data/games.json';
async function latestPublished(){
 const response=await fetch(remoteURL+'?t='+Date.now(),{cache:'no-store'});
 if(!response.ok)throw Error('GitHub catalogue check failed (HTTP '+response.status+'). Import blocked.');
 const records=await response.json();
 if(!Array.isArray(records)||records.length<1000||
    records.some(g=>!g||!Number.isSafeInteger(g.id)||g.id<1||typeof g.link!=='string'))
   throw Error('Latest catalogue is invalid. Import blocked.');
 const ids=new Set(records.map(g=>g.id));
 if(ids.size!==records.length)throw Error('Published catalogue has duplicate IDs. Import blocked.');
 return records;
}
const bar=document.querySelector('main.wrap .tabs');
if(!bar)return;
const button=document.createElement('button');button.type='button';button.textContent='📥 Bulk Import Games';button.style.margin='10px 8px 10px 0';
bar.insertAdjacentElement('afterend',button);
const dlg=document.createElement('dialog');dlg.style.cssText='width:min(92vw,800px);max-height:85vh;overflow:auto;background:#162235;color:#fff;border:1px solid #64748b;border-radius:12px;padding:20px';
dlg.innerHTML=`<h2>Bulk Import Games</h2><p>Import a JSON batch, optionally attach artwork, and review before saving local drafts. Nothing is published.</p><p><label>Batch JSON <input id="tgeBulkJson" type="file" accept=".json,application/json"></label></p><p><label>Artwork files (optional) <input id="tgeBulkImages" type="file" accept="image/png,image/jpeg,image/webp" multiple></label></p><p style="font-size:13px">For automatic artwork matching, use an <code>image</code> filename in each JSON entry, or a filename containing the game title.</p><p><label style="display:flex;align-items:center;gap:8px"><input id="tgeBulkShowRecent" type="checkbox" style="width:auto"> Show imported games in Recent Additions</label><small>Off by default. Imported games will still appear in categories, search, and other applicable sections.</small></p><div id="tgeBulkStatus" role="status" style="white-space:pre-wrap;margin:12px 0"></div><div id="tgeBulkList" style="max-height:38vh;overflow:auto"></div><p><button id="tgeBulkStage" type="button" disabled>Save selected as local drafts</button> <button id="tgeBulkClose" type="button">Close</button></p>`;
document.body.append(dlg);
const status=$('tgeBulkStatus'),list=$('tgeBulkList'),stage=$('tgeBulkStage');let candidates=[],verifiedCatalogue=null;
const filekey=s=>String(s||'').toLowerCase().replace(/\.[^.]+$/,'').replace(/[^a-z0-9]/g,'');
function allRecords(){return [...baseline,...games]}
function chooseImage(e,files){const desired=String(e.image||'').split('/').pop();return files.find(f=>desired&&f.name.toLowerCase()===desired.toLowerCase())||files.find(f=>filekey(f.name)===filekey(e.title))||null}
async function validate(){
 stage.disabled=true;candidates=[];verifiedCatalogue=null;list.replaceChildren();
 const f=$('tgeBulkJson').files[0];if(!f){status.textContent='Select a batch JSON file to begin.';return}
 status.textContent='Checking latest published games on GitHub…';
 try{
  const latest=await latestPublished();
  const raw=await f.text();
  const payload=JSON.parse(raw);
  const entries=Array.isArray(payload.entries)?payload.entries:(payload.format==='tge-manager-drafts-v1'?payload.drafts?.games:null);
  if(!Array.isArray(entries)||!entries.length)throw Error('Expected an entries array or a TGE draft export with games');
  if(entries.length>250)throw Error('Maximum 250 entries per batch');
  verifiedCatalogue=latest;
  const files=[...$('tgeBulkImages').files],known=new Set([...latest,...allRecords()].map(g=>norm(g.link))),seen=new Set();
  for(const e of entries){
   const link=String(e?.link||'').trim(),url=norm(link),title=String(e?.title||'').trim();
   const duplicate=known.has(url)||seen.has(url);seen.add(url);
   const valid=Boolean(title&&e.category&&e.platform&&e.genre1&&/^https?:\/\//i.test(link)&&!duplicate);
   const file=chooseImage(e,files);candidates.push({e,file,valid});
   const row=document.createElement('div');row.style.cssText='padding:8px 0;border-bottom:1px solid #475569';
   const check=document.createElement('input');check.type='checkbox';check.checked=valid;check.disabled=!valid;check.dataset.index=String(candidates.length-1);
   const label=document.createTextNode(' '+(title||'(untitled)')+' — '+(duplicate?'DUPLICATE':valid?'ready':'INVALID FIELDS')+(file?' — artwork attached':' — no artwork'));
   row.append(check,label);list.append(row);
  }
  status.textContent=`Verified ${latest.length} published games from GitHub main. ${entries.length} entries; ${candidates.filter(c=>c.valid).length} eligible. Existing games and drafts will not be overwritten.`;
  stage.disabled=!candidates.some(c=>c.valid);
 }catch(e){verifiedCatalogue=null;stage.disabled=true;status.textContent='Validation failed: '+e.message}
}
button.onclick=()=>{dlg.showModal();validate()};$('tgeBulkClose').onclick=()=>dlg.close();$('tgeBulkJson').onchange=validate;$('tgeBulkImages').onchange=validate;
stage.onclick=async()=>{
 const selected=[...list.querySelectorAll('input:checked')].map(x=>candidates[Number(x.dataset.index)]);
 if(!verifiedCatalogue){status.textContent='Latest published catalogue not verified. Import blocked.';return}
 if(!selected.length)return;
 if(selected.some(x=>x.file)&&typeof window.tgeSaveBulkImageDraft!=='function'){status.textContent='Image draft storage unavailable. Reload and retry.';return}
 if(!confirm(`Save ${selected.length} NEW games as local drafts? Existing drafts will be preserved. Nothing will be published.`))return;
 stage.disabled=true;
 const added=[],images=[];
 let prior;
 try{
  // Recheck immediately before saving; never allocate IDs using a stale preview.
  const latest=await latestPublished();
  prior=localStorage.getItem(key);
  const parsed=JSON.parse(prior||'{}');if(parsed.games&&!Array.isArray(parsed.games))throw Error('Existing drafts have unexpected structure');
  const collision=games.find(g=>latest.some(pub=>Number(pub.id)===Number(g.id)&&norm(pub.link)!==norm(g.link)));
  if(collision)throw Error('Existing local draft ID '+collision.id+' conflicts with latest GitHub catalogue. Export and repair drafts before importing.');
  const existing=[...latest,...allRecords()],used=new Set(existing.map(g=>Number(g.id)).filter(Number.isSafeInteger)),links=new Set(existing.map(g=>norm(g.link)));
  let next=Math.max(0,...used)+1;
  for(const {e,file} of selected){
   if(links.has(norm(e.link)))throw Error('Duplicate found: '+e.title);
   while(used.has(next))next++;
   const id=next++;used.add(id);links.add(norm(e.link));
   const record={id,title:String(e.title).trim(),category:e.category,link:String(e.link).trim(),platform:e.platform,genre1:e.genre1,genre2:e.genre2||'',series:e.series||'',collection:e.collection||'',video_link:e.video_link||'',notes:e.notes||'',date_added:new Date().toISOString().slice(0,10),ai_usage:e.ai_usage||'',weight:'',hidden:false,show_in_recent:$('tgeBulkShowRecent').checked,image:''};
   if(file){record.image=await window.tgeSaveBulkImageDraft(file,id);images.push(record.image)}
   games.unshift(record);added.push(record);
  }
  persistDrafts();
  const saved=JSON.parse(localStorage.getItem(key)||'{}');
  if(added.some(g=>!(saved.games||[]).some(x=>Number(x.id)===g.id&&x.link===g.link&&x.image===g.image)))throw Error('Saved drafts could not be verified');
  refreshOptions();render();
  status.textContent=`Saved ${added.length} local game drafts. Open Review & Publish to inspect them. Nothing published. Reload the page to confirm persistence.`;
 }catch(e){
  for(const g of added){const i=games.indexOf(g);if(i>=0)games.splice(i,1)}
  try{if(prior===null)localStorage.removeItem(key);else if(prior!==undefined)localStorage.setItem(key,prior)}catch{}
  for(const path of images){try{await window.tgeClearPendingImage?.(path)}catch{}}
  refreshOptions();render();status.textContent='Import failed; attempted rollback: '+e.message;
 }
};
})();
