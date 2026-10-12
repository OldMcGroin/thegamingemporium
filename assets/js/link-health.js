(()=>{
 const root=document.querySelector('[data-link-health]');if(!root)return;
 const output=root.querySelector('[data-link-health-results]'), summary=root.querySelector('[data-link-health-summary]');
 const search=root.querySelector('[data-link-health-search]');let entries=[],reviews={},filter='flagged';
 function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
 function render(){output.replaceChildren();const q=search.value.toLowerCase();const list=entries.filter(x=>(filter==='all'||(filter==='hidden'?x.hidden:filter==='reviewed'?!!reviews[String(x.id)]:x.status!=='working'&&!reviews[String(x.id)]))&&((x.title||'').toLowerCase().includes(q)||(x.url||'').toLowerCase().includes(q)));
  summary.textContent=`${entries.length} links checked · ${entries.filter(x=>x.status==='broken').length} repeatedly failed · ${entries.filter(x=>x.status==='suspect').length} need review · ${entries.filter(x=>x.hidden).length} hidden · ${Object.keys(reviews).length} checked & OK`;
  if(!list.length){output.append(node('p','No matching games.'));return;}
  for(const item of list.slice(0,1000)){
   const card=node('div','');card.style.cssText='border:1px solid #8886;border-radius:8px;padding:12px;margin:10px 0';
   const title=node('strong',`${item.title} — ${item.hidden?'Hidden':item.status} (${item.detail})`);card.append(title,node('br',''));if(reviews[String(item.id)])card.append(node('small',`✓ Checked & OK on ${new Date(reviews[String(item.id)].checked_at).toLocaleDateString()}`),node('br',''));
   const link=node('a',item.url);link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link,node('br',''));
   const action=(label,callback)=>{const b=node('button',label);b.type='button';b.style.cssText='margin:8px 8px 0 0;padding:7px 12px;cursor:pointer';b.addEventListener('click',callback);card.append(b);};
   action('Open / Check Link',()=>window.open(item.url,'_blank','noopener,noreferrer'));
   action('Change Link',async()=>{const url=prompt('Enter the replacement HTTP(S) URL:',item.url);if(url===null||url===item.url)return;await change(item,'link',url);});
   action(item.hidden?'Unhide Game':'Hide Game',async()=>{if(!confirm(`${item.hidden?'Restore':'Hide'} ${item.title}? This changes games.json and triggers a deployment.`))return;await change(item,'hidden',!item.hidden);});
   action(reviews[String(item.id)]?'Reopen Review':'✓ Checked & OK',async()=>{
    const value=reviews[String(item.id)]?'clear':'ok';
    if(value==='ok'&&!confirm(`Confirm you manually opened and verified ${item.title}?`))return;
    try{const response=await fetch('/admin/link-health/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,expected_link:item.url,field:'review',value,detail:item.detail})});const data=await response.json();if(!response.ok)throw Error(data.message||'Save failed');if(data.review)reviews[String(item.id)]=data.review;else delete reviews[String(item.id)];render();alert('Review saved to GitHub. The website may take a moment to update.');}catch(e){alert(e.message);}
   });
   output.append(card);
  }
 }
 async function change(item,field,value){try{const response=await fetch('/admin/link-health/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,expected_link:item.url,field,value})});const data=await response.json();if(!response.ok)throw Error(data.message||'Update failed');if(field==='hidden')item.hidden=value;else item.url=value;render();alert('Saved to GitHub. Allow time for Cloudflare to deploy.');}catch(e){alert(e.message);}}
 root.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;render();}));search.addEventListener('input',render);
 Promise.all([fetch('/link-health-report.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No scan report yet. Run the GitHub Actions workflow first.');return r.json();}),fetch('/link-health-reviews.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))]).then(([d,saved])=>{entries=d.results||[];reviews=saved||{};for(const item of entries){const review=reviews[String(item.id)];if(review&&(review.url!==item.url||review.detail!==item.detail))delete reviews[String(item.id)];}render();summary.textContent+=` · Last scan: ${new Date(d.checked_at).toLocaleString()}`;}).catch(e=>summary.textContent=e.message);
})();
