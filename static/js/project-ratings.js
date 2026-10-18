(()=>{
 const nodes=[...document.querySelectorAll('[data-rating-project]')];if(!nodes.length)return;
 const byProject=new Map();for(const node of nodes){const key=node.dataset.ratingProject;if(!byProject.has(key))byProject.set(key,[]);byProject.get(key).push(node)}
 const cache=new Map();
  const reportCounts=new Map();
  const reportPending=new Map();
  function paintReportCount(key,total){for(const node of byProject.get(key)||[]){const el=node.querySelector('[data-playability-count]');if(el)el.textContent=String(total)}}
  async function loadReportCount(key,force=false){
    if(!key)return;
    if(!force&&reportCounts.has(key)){paintReportCount(key,reportCounts.get(key));return}
    if(reportPending.has(key))return reportPending.get(key);
    const task=(async()=>{try{const r=await fetch('/api/playability?project='+encodeURIComponent(key));if(!r.ok)return;const d=await r.json();const total=(d.counts||[]).reduce((n,x)=>n+Number(x.n||0),0);reportCounts.set(key,total);paintReportCount(key,total)}catch(e){console.warn('Playability count unavailable',e)}finally{reportPending.delete(key)}})();
    reportPending.set(key,task);return task;
  }
  // Fetch counts for visible cards only, keeping large category pages responsive.
  const observer=('IntersectionObserver' in window)?new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);loadReportCount(entry.target.dataset.ratingProject)}},{rootMargin:'200px'}):null;
  for(const [key,items] of byProject){if(!key)continue;if(observer){for(const item of items)observer.observe(item)}else loadReportCount(key)}

 function paint(key){const v=cache.get(key);if(!v)return;for(const node of byProject.get(key)||[]){const b=node.querySelector('.tge-rating-trigger');if(!b)continue;b.replaceChildren();const star=document.createElement('span');star.className='tge-rating-star';star.setAttribute('aria-hidden','true');star.textContent='★';b.append(star,document.createTextNode(v.count>=3?` ${v.average.toFixed(1)}/5 (${v.count} ratings)`:' Rate this project'));b.setAttribute('aria-label',v.count>=3?`Rated ${v.average} out of 5 from ${v.count} votes. Rate this project`:'Rate & Review');let note=node.querySelector('.tge-rating-note');if(!note){note=document.createElement('span');note.className='tge-rating-note';node.append(note)}note.textContent=v.count<3&&v.count>0?`${v.count}/3 ratings`:''}}
 async function load(){const keys=[...byProject.keys()];for(let i=0;i<keys.length;i+=40){try{const res=await fetch('/api/ratings?projects='+encodeURIComponent(keys.slice(i,i+40).join(',')));if(!res.ok)continue;const body=await res.json();for(const [k,v] of Object.entries(body.ratings||{})){cache.set(k,v);paint(k)}}catch(e){console.warn('Ratings unavailable',e)}}}
 function open(key,initialTab="ratings"){const data=cache.get(key)||{count:0,counts:[0,0,0,0,0],average:null};const dialog=document.createElement('dialog');dialog.className='tge-rating-dialog';
 const close=document.createElement('button');close.className='tge-rating-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Close');close.onclick=()=>dialog.close();dialog.append(close);
 const title=document.createElement('h2');title.textContent='Project Ratings & Playability';dialog.append(title);
 const help=document.createElement('p');help.textContent='Rate the decompilation or recompilation itself — its stability, performance, improvements and polish — not the original game.';dialog.append(help);
 const stars=document.createElement('div');stars.className='tge-rating-stars';stars.setAttribute('aria-label','Select one to five stars');dialog.append(stars);
 const status=document.createElement('p');status.className='tge-rating-message';status.setAttribute('aria-live','polite');dialog.append(status);
 const breakdown=document.createElement('div');breakdown.className='tge-rating-breakdown';dialog.append(breakdown);
 function renderBreakdown(v){breakdown.replaceChildren();const heading=document.createElement('strong');heading.textContent=v.count>=3?`Average ${v.average.toFixed(1)}/5 (${v.count} ratings)`:`${v.count}/3 ratings received — average appears after 3`;breakdown.append(heading);if(v.count>=3){for(let i=5;i>=1;i--){const line=document.createElement('div');line.textContent=`${'★'.repeat(i)}: ${v.counts[i-1]||0}`;breakdown.append(line)}}}
 renderBreakdown(data);
 for(let i=1;i<=5;i++){const b=document.createElement('button');b.type='button';b.textContent='★';b.title=`${i} star${i===1?'':'s'}`;b.setAttribute('aria-label',`${i} out of 5 stars`);b.setAttribute('aria-pressed','false');b.onclick=async()=>{for(const btn of stars.children)btn.disabled=true;status.textContent='Saving your rating…';try{const r=await fetch('/api/ratings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:key,stars:i})});const result=await r.json();if(!r.ok)throw Error(result.error||'Unable to save rating');cache.set(key,result);paint(key);renderBreakdown(result);status.textContent=`Thank you! Your ${i}-star rating was saved. You can change it any time.`;for(let n=0;n<stars.children.length;n++)stars.children[n].setAttribute('aria-pressed',String(n===i-1))}catch(e){status.textContent=e.message}finally{for(const btn of stars.children)btn.disabled=false}};stars.append(b)}
 const tabs=document.createElement('div');tabs.className='tge-rating-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Project feedback');
 const ratingPanel=document.createElement('section');ratingPanel.className='tge-rating-panel';ratingPanel.setAttribute('role','tabpanel');
 for(const el of [help,stars,status,breakdown])ratingPanel.append(el);
 const ratingTab=document.createElement('button'),playTab=document.createElement('button');
 for(const [button,label] of [[ratingTab,'★ Ratings & Reviews'],[playTab,'💬 Playability Reports']]){button.type='button';button.textContent=label;button.setAttribute('role','tab');tabs.append(button)}
 const uid='tge-feedback-'+Math.random().toString(36).slice(2);
 ratingTab.id=uid+'-rating-tab';playTab.id=uid+'-play-tab';ratingPanel.id=uid+'-rating-panel';ratingPanel.setAttribute('aria-labelledby',ratingTab.id);ratingTab.setAttribute('aria-controls',ratingPanel.id);
 title.after(tabs,ratingPanel);
 // Community playability reports are separate from star ratings.
 const section=document.createElement('section');section.className='tge-playability-section';section.style.cssText='margin-top:1rem;border-top:1px solid #777;padding-top:1rem;max-width:100%;overflow-wrap:anywhere';
 const heading=document.createElement('h3');heading.textContent='Community Playability Reports';section.append(heading);
 const form=document.createElement('form');form.style.cssText='display:grid;gap:.6rem;margin-bottom:1rem';
 const statusLabel=document.createElement('label');statusLabel.textContent='How far did you get?';const select=document.createElement('select');
 const options=[['','Select playability'],['completed','Completed Successfully'],['issues','Playable With Issues'],['partial','Partially Playable'],['broken','Broken / Unplayable'],['untested','Not Fully Tested']];for(const [v,t] of options){const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o)}statusLabel.append(select);form.append(statusLabel);
 const platformLabel=document.createElement('label');platformLabel.textContent='Platform';const platform=document.createElement('select');for(const p of ['Windows','Linux','Steam Deck','Android','Other']){const o=document.createElement('option');o.value=p;o.textContent=p;platform.append(o)}platformLabel.append(platform);form.append(platformLabel);
 const version=document.createElement('input');version.placeholder='Build/version (optional)';version.maxLength=100;form.append(version);
 const details=document.createElement('textarea');details.placeholder='Describe your experience (optional)';details.maxLength=1500;details.rows=3;form.append(details);
 const submit=document.createElement('button');submit.type='submit';submit.textContent='Submit Playability Report';form.append(submit);
 const msg=document.createElement('p');msg.setAttribute('aria-live','polite');form.append(msg);section.append(form);
 const summary=document.createElement('div');section.append(summary);const reports=document.createElement('div');section.append(reports);
 async function refreshReports(){try{const r=await fetch('/api/playability?project='+encodeURIComponent(key));const d=await r.json();if(!r.ok)throw Error(d.error||'Unavailable');summary.replaceChildren();reports.replaceChildren();const names={completed:'Completed Successfully',issues:'Playable With Issues',partial:'Partially Playable',broken:'Broken / Unplayable',untested:'Not Fully Tested'};const total=(d.counts||[]).reduce((n,x)=>n+Number(x.n),0);reportCounts.set(key,total);paintReportCount(key,total);const count=document.createElement('p');count.textContent=`${total} community report${total===1?'':'s'} (self-reported, not independently verified)`;summary.append(count);for(const c of d.counts||[]){const p=document.createElement('p');p.textContent=`${names[c.status]}: ${c.n}`;summary.append(p)}for(const x of d.reports||[]){const item=document.createElement('div');item.style.cssText='padding:.6rem 0;border-top:1px solid #777';const t=document.createElement('strong');t.textContent=`${names[x.status]} — ${x.platform}`;item.append(t);const date=document.createElement('small');date.textContent=' · '+x.updated_at;item.append(date);if(x.build_version){const v=document.createElement('p');v.textContent='Build: '+x.build_version;item.append(v)}if(x.details){const p=document.createElement('p');p.textContent=x.details;item.append(p)}reports.append(item)}}catch(e){summary.textContent='Playability reports unavailable: '+e.message}}
 form.onsubmit=async e=>{e.preventDefault();if(!select.value){msg.textContent='Please select a playability status.';return}submit.disabled=true;msg.textContent='Saving…';try{const r=await fetch('/api/playability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:key,status:select.value,platform:platform.value,build_version:version.value,details:details.value})});const d=await r.json();if(!r.ok)throw Error(d.error||'Submission failed');msg.textContent='Report saved. You can update it later from this browser.';await refreshReports()}catch(e){msg.textContent=e.message}finally{submit.disabled=false}};
 section.setAttribute('role','tabpanel');section.id=uid+'-play-panel';section.setAttribute('aria-labelledby',playTab.id);playTab.setAttribute('aria-controls',section.id);dialog.append(section);
 let reportsLoaded=false;
 function selectTab(which){const rating=which==='ratings';ratingPanel.hidden=!rating;section.hidden=rating;ratingTab.setAttribute('aria-selected',String(rating));playTab.setAttribute('aria-selected',String(!rating));ratingTab.tabIndex=rating?0:-1;playTab.tabIndex=rating?-1:0;if(!rating&&!reportsLoaded){reportsLoaded=true;refreshReports()}dialog.scrollTop=0}
 ratingTab.onclick=()=>selectTab('ratings');playTab.onclick=()=>selectTab('playability');
 tabs.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'ratings':e.key==='End'?'playability':ratingTab.getAttribute('aria-selected')==='true'?'playability':'ratings';selectTab(next);(next==='ratings'?ratingTab:playTab).focus()});
 selectTab(initialTab);

 dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}
 document.addEventListener('click',e=>{const b=e.target.closest('.tge-rating-trigger, .tge-playability-counter');if(!b)return;const node=b.closest('[data-rating-project]');if(node)open(node.dataset.ratingProject,b.classList.contains("tge-playability-counter")?"playability":"ratings")});
 const style=document.createElement('style');style.textContent=`
 .tge-rating-dialog{box-sizing:border-box;width:100%;max-width:min(94vw,560px);max-height:85dvh;overflow-y:auto;overscroll-behavior:contain}
 .tge-rating-panel .tge-rating-stars{margin-top:.5rem!important;margin-bottom:.25rem!important}
 .tge-rating-panel .tge-rating-message{margin-top:.35rem!important;margin-bottom:.35rem!important;min-height:0!important}
 .tge-rating-panel .tge-rating-breakdown{margin-top:.5rem!important;padding-top:.35rem!important}
 .tge-playability-section h3{margin:.5rem 0 .75rem}
 .tge-playability-section form{gap:.45rem!important;margin-bottom:.5rem!important}
 .tge-playability-section form p{margin:.35rem 0!important}
 .tge-playability-section > div p{margin:.5rem 0}
 .tge-rating-tabs{display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin:1rem 0;border-bottom:1px solid #555;padding-bottom:.5rem}
 .tge-rating-tabs button{min-width:0;white-space:normal;line-height:1.25;min-height:44px;padding:.65rem .35rem;border:1px solid #555;border-radius:.5rem;background:#17191f;color:#eee;cursor:pointer;font:inherit;font-weight:600}
 .tge-rating-tabs button[aria-selected="true"]{background:#3a3217;border-color:#e9b62b;color:#fff;box-shadow:inset 0 -3px #e9b62b}
 .tge-rating-panel[hidden],.tge-playability-section[hidden]{display:none!important}
 .tge-playability-section{margin-top:0!important;border-top:0!important;padding-top:0!important}
 .tge-playability-section label{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem}
 .tge-playability-section input,.tge-playability-section textarea,.tge-playability-section select{box-sizing:border-box;max-width:100%;min-width:0;font:inherit}
 .tge-playability-section input,.tge-playability-section textarea{width:100%;padding:.55rem;border-radius:.35rem}
 .tge-playability-section button[type="submit"]{min-height:44px;border-radius:.4rem;cursor:pointer}
 @media(max-width:480px){.tge-rating-dialog{max-width:calc(100vw - 24px);padding:1rem}.tge-rating-tabs button{font-size:.85rem}}
 `;document.head.append(style);
 load();
})();
