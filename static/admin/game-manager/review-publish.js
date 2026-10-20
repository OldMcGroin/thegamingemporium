/* The Gaming Emporium — draft review, stage 3 (read-only until verified). */
(() => {
  'use strict';
  const $id = id => document.getElementById(id);
  const el = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=String(text); if(cls)n.className=cls; return n; };
  const norm = v => v===undefined ? null : v;
  // Ignore only defaults introduced by the editor when a baseline field was absent.
  // Do not collapse meaningful changes (e.g. true -> false or a real value -> '').
  const defaultForMissing = {ai_usage:'', collection:'', platform:'', weight:'', hidden:false};
  const eqField = (key, before, after, original, current) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return true;
    if (original && !Object.prototype.hasOwnProperty.call(original,key)
        && Object.prototype.hasOwnProperty.call(defaultForMissing,key)
        && after === defaultForMissing[key]) return true;
    return false;
  };
  const changedFields = (a,b) => fields(a,b).filter(k => !eqField(k,a?.[k],b?.[k],a,b));
  const eq = (a,b) => changedFields(a,b).length === 0;
  const fields = (a,b) => [...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].sort();
  const panel=el('section',undefined,'tge-review-panel');
  panel.id='tgeReviewPanel';panel.hidden=true;
  panel.style.cssText='border:1px solid #415574;background:#142239;padding:16px;border-radius:12px;margin:12px 0;';
  const heading=el('h2','Review local changes');panel.append(heading);
  const note=el('p','Read-only review. Publishing is locked until Preview authentication and test-branch safeguards are verified.','muted');panel.append(note);
  const content=el('div');panel.append(content);
  const close=el('button','Close review');close.type='button';close.addEventListener('click',()=>{panel.hidden=true});panel.append(close);
  const toolbar=document.querySelector('main.wrap .tabs + .toolbar');
  if(!toolbar){console.error('TGE review: draft toolbar not found');return;}
  const button=el('button','🔎 Review & Publish');button.type='button';
  toolbar.append(button);toolbar.insertAdjacentElement('afterend',panel);
  const report=[];
  function renderValue(value){if(value===undefined)return '(not set)';if(typeof value==='object')return JSON.stringify(value);return String(value)}
  function row(type,key,original,current){
    const box=el('article');box.style.cssText='padding:12px;margin:10px 0;border:1px solid #314765;border-radius:9px;overflow-wrap:anywhere';
    box.append(el('h3',`${type}: ${current.title||current.name||key}`));
    box.append(el('p',`Identifier: ${key} · ${original?'Update existing':'New record'}`,'muted'));
    const changed=changedFields(original,current);
    for(const k of changed){
      const line=el('div');line.style.cssText='margin:7px 0;padding:6px 0;border-top:1px solid #314765';
      const label=el('strong',k);line.append(label);
      const before=el('div','Before: '+renderValue(original?.[k]),'muted');
      const after=el('div','After: '+renderValue(current?.[k]));
      line.append(before,after);box.append(line);
    }
    return box;
  }
  function preparePublishRequest(change){
    const type=change.type==='Game'?'game':'collection';
    const action=change.original?'update':'create';
    const record=change.original?{...change.original}:{...change.current};

    if(change.original){
      for(const key of changedFields(change.original,change.current)){
        if(Object.prototype.hasOwnProperty.call(change.current,key)){
          record[key]=change.current[key];
        }else{
          // Preserve existing fields omitted by the editor.
        }
      }
    }

    return {
      type,
      action,
      record,
      ...(change.original?{before:change.original}:{})
    };
  }

  function review(){
    content.replaceChildren();report.length=0;
    // Use numeric IDs, not title/link, to identify existing games.
    const originals=new Map(baseline.map(g=>[Number(g.id),g]));
    const originalCollections=new Map(baselineCollections.map(c=>[c.slug,c]));
    const seen=new Set();
    for(const g of games){
      const id=Number(g.id);
      if(!Number.isSafeInteger(id)||id<=0||seen.has(id)){
        report.push({error:`Invalid or duplicate game ID: ${g.id} (${g.title||'untitled'})`});continue;
      }
      seen.add(id);
      const original=originals.get(id);
      if(!original||!eq(original,g))report.push({type:'Game',key:id,original,current:g});
    }
    const slugs=new Set();
    for(const c of collections){
      if(!c.slug||slugs.has(c.slug)){report.push({error:`Invalid or duplicate collection slug: ${c.slug||'(blank)'}`});continue;}
      slugs.add(c.slug);
      const original=originalCollections.get(c.slug);
      if(!original||!eq(original,c))report.push({type:'Collection',key:c.slug,original,current:c});
    }
    const errors=report.filter(x=>x.error),changes=report.filter(x=>!x.error);
    content.append(el('p',`${changes.length} local changes found (${changes.filter(x=>x.type==='Game').length} games, ${changes.filter(x=>x.type==='Collection').length} collections).`));
    if(errors.length){const warning=el('p',errors.map(x=>x.error).join('\n'));warning.style.cssText='color:#ffcb8a;white-space:pre-wrap';content.append(warning)}
    if(!changes.length&&!errors.length)content.append(el('p','No differences from the embedded baseline were found.','muted'));
    for(const x of changes){
      const item=row(x.type,x.key,x.original,x.current);
      const publish=el('button','Publish this '+x.type.toLowerCase());
      publish.type='button';
      publish.disabled=true;
      publish.title='Publishing remains locked until the test workflow is verified';
      publish.style.marginTop='10px';
      item.append(publish);
      content.append(item);
    }
    const locked=el('button','🔒 Publishing disabled — Preview verification required');locked.disabled=true;locked.style.marginTop='12px';content.append(locked);
    panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  button.addEventListener('click',review);
})();
