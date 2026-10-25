/* Delete collections safely: server applies both JSON changes in one commit. */
(()=>{'use strict';
 const dialog=document.getElementById('collectionDialog');
 const actions=dialog?.querySelector('.actions');if(!actions)return;
 const button=document.createElement('button');button.type='button';button.textContent='🗑 Delete Collection';button.style.cssText='background:#732525;border-color:#b94b4b;display:none;margin-right:auto';actions.prepend(button);
 function update(){const c=collections[editingCollection];button.style.display=c?'inline-block':'none'}
 const oldOpen=window.openCollection;
 window.openCollection=function(...args){oldOpen(...args);update()};
 button.addEventListener('click',async()=>{
  const c=collections[editingCollection];if(!c)return;
  const original=baselineCollections.find(x=>x.slug===c.slug);
  const assigned=games.filter(g=>g.collection===c.slug);
  if(!original){
   if(!confirm('Delete NEW local collection draft "'+c.name+'" and clear collection from '+assigned.length+' local games? Nothing will be deleted on GitHub.'))return;
   for(const g of assigned)g.collection='';collections.splice(editingCollection,1);dialog.close();persistDrafts();refreshOptions();renderCollections();render();return;
  }
  if(!confirm('DELETE COLLECTION "'+c.name+'"?\n\n'+assigned.length+' game(s) will have their collection field cleared. Their projects, ratings and reviews are preserved.\n\nThis action publishes directly to GitHub and cannot be undone from the Game Manager.'))return;
  if(!confirm('Final confirmation: permanently delete collection "'+c.name+'" from the published catalogue?'))return;
  button.disabled=true;button.textContent='Deleting...';
  try{
   const statusResponse=await fetch('/admin/game-manager/publish',{credentials:'same-origin',cache:'no-store'});
   const status=await statusResponse.json();
   if(!statusResponse.ok||status.enabled!==true||!['main','game-manager-publishing-test','game-manager-safe-test-20261021'].includes(status.branch))throw Error('Publishing is not authorised or enabled.');
   // Prevent unrelated local game drafts from being silently changed by this operation.
   const changedMembers=assigned.filter(g=>{const base=baseline.find(x=>Number(x.id)===Number(g.id));return base&&JSON.stringify(base)!==JSON.stringify(g)});
   if(changedMembers.length)throw Error('One or more affected games have unsaved local changes. Export and publish/discard those drafts before deleting.');
   const request={type:'collection',action:'delete',before:original,expectedGameIds:assigned.map(g=>g.id)};
   const res=await fetch('/admin/game-manager/publish',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
   const result=await res.json();if(!res.ok||!result.ok)throw Error(result.message||'Deletion failed');
   // Reset only after successful atomic server commit. Reload once deployed to see fresh baseline.
   const drafts=JSON.parse(localStorage.getItem('tge_manager_stage1_drafts')||'{}');
   drafts.collections=(drafts.collections||[]).filter(x=>x.slug!==c.slug);
   localStorage.setItem('tge_manager_stage1_drafts',JSON.stringify(drafts));
   for(const g of assigned)g.collection='';collections.splice(editingCollection,1);
   dialog.close();refreshOptions();renderCollections();render();
   alert('Deleted on GitHub. Cleared collection field for '+result.unassigned+' games in the same commit. Wait for deployment and reload the Manager.');
  }catch(e){alert('Collection NOT deleted: '+e.message)}
  finally{button.disabled=false;button.textContent='🗑 Delete Collection'}
 });
})();
