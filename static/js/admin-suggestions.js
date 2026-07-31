(function(){
  'use strict';
  var root=document.querySelector('[data-suggestions-admin]'); if(!root)return;
  var list=root.querySelector('[data-suggestions-list]'), msg=root.querySelector('[data-admin-message]'), count=root.querySelector('[data-suggestion-count]');
  var status='new';
  function esc(v){var d=document.createElement('div');d.textContent=v==null?'':String(v);return d.innerHTML}
  function category(v){var labels={'abandonware':'Abandonware','android-ports':'Android Ports','console-ports':'Console To Console Ports','console-to-pc-port':'Console To PC Ports','decompilations-recompilations':'Decompilations & Recompilations','english-translation-patches':'English Translation Patches','fan-games':'Fan Games & Homebrew','guides':'Guides','in-the-works':'In The Works','mods':'Mods','open-source':'Open Source','preserved-games':'Preserved Games','rom-hacks':'ROM Hacks','texture-packs':'Texture Packs','utility':'Utilities'};return labels[v]||v||'No category';}
  function date(v){try{return new Date(String(v).replace(' ','T')+'Z').toLocaleString()}catch(e){return v}}
  async function load(){msg.textContent='Loading suggestions…';list.innerHTML='';
    try{var r=await fetch('/admin/suggestions/api?status='+encodeURIComponent(status),{headers:{Accept:'application/json'}});var d=await r.json();if(!r.ok)throw new Error(d.message||'Could not load suggestions.');
      var items=d.suggestions||[];count.textContent=items.length+' '+(items.length===1?'suggestion':'suggestions');msg.textContent=items.length?'':'No suggestions here.';
      items.forEach(function(x){var el=document.createElement('article');el.className='suggestion-card';el.innerHTML='<h3>'+esc(x.game_title)+'</h3><div class="suggestion-card__category">'+esc(category(x.category))+'</div><a href="'+esc(x.game_link)+'" target="_blank" rel="noopener noreferrer">'+esc(x.game_link)+'</a><div class="suggestion-card__meta">Submitted '+esc(date(x.submitted_at))+' · '+esc(x.status)+'</div><div class="suggestion-card__actions"><a class="suggestion-card__open" href="'+esc(x.game_link)+'" target="_blank" rel="noopener noreferrer">Open Link</a><button type="button" data-review="'+x.id+'">'+(x.status==='reviewed'?'Mark New':'Mark Reviewed')+'</button><button class="suggestion-card__delete" type="button" data-delete="'+x.id+'">Delete</button></div>';list.appendChild(el)});
    }catch(e){msg.textContent=e.message||'Could not load suggestions.'}}
  root.querySelectorAll('[data-status]').forEach(function(b){b.addEventListener('click',function(){root.querySelectorAll('[data-status]').forEach(function(x){x.classList.remove('is-active')});b.classList.add('is-active');status=b.dataset.status;load()})});
  list.addEventListener('click',async function(e){var review=e.target.closest('[data-review]'),del=e.target.closest('[data-delete]');
    if(review){var card=review.closest('.suggestion-card');var next=review.textContent.indexOf('Reviewed')>=0?'reviewed':'new';review.disabled=true;await fetch('/admin/suggestions/api',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(review.dataset.review),status:next})});card.remove();load()}
    if(del&&confirm('Delete this suggestion permanently?')){del.disabled=true;await fetch('/admin/suggestions/api?id='+encodeURIComponent(del.dataset.delete),{method:'DELETE'});del.closest('.suggestion-card').remove();load()}
  });
  load();
})();
