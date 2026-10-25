/* Delete published games from inside Edit Game, without deleting shared image files. */
(()=>{'use strict';
 const dialog=document.getElementById('gameDialog');
 const actions=dialog?.querySelector('.actions');if(!actions)return;
 const button=document.createElement('button');button.type='button';button.textContent='🗑 Delete Game';
 button.style.cssText='background:#732525;border-color:#b94b4b;display:none;margin-right:auto';actions.prepend(button);
 const originalOpen=window.openGame;
 window.openGame=function(...args){originalOpen(...args);const current=games.find(g=>Number(g.id)===Number(editing));button.style.display=current?'inline-block':'none'};
 button.addEventListener('click',async()=>{
  const current=games.find(g=>Number(g.id)===Number(editing));if(!current)return;
  const before=baseline.find(g=>Number(g.id)===Number(current.id));
  if(!before){
   if(!confirm('Delete the LOCAL draft "'+current.title+'"? No published game will be deleted.'))return;
   games=games.filter(g=>Number(g.id)!==Number(current.id));dialog.close();persistDrafts();refreshOptions();render();return;
  }
  if(!confirm('PERMANENTLY DELETE this published game?\n\n'+before.title+'\nGame ID: '+before.id+'\n\nThis removes its listing from The Gaming Emporium, including its collection and series listings. It will not delete its image file or other games.'))return;
  if(!confirm('Final confirmation: delete "'+before.title+'" (ID '+before.id+') from the published website? This cannot be undone in the Game Manager.'))return;
  button.disabled=true;button.textContent='Deleting...';
  try{
   // Confirm that publishing is enabled before requesting any destructive change.
   const sr=await fetch('/admin/game-manager/publish',{credentials:'same-origin',cache:'no-store'});
   const status=await sr.json();
   if(!sr.ok||status.enabled!==true||!['main','game-manager-publishing-test','game-manager-safe-test-20261021'].includes(status.branch))throw Error('Publishing is not authorised or enabled.');
   const res=await fetch('/admin/game-manager/publish',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'game',action:'delete',before})});
   const result=await res.json();if(!res.ok||!result.ok)throw Error(result.message||'Deletion failed');
   // Purge this game from local drafts so it cannot be reinstated on a later edit.
   let drafts={};try{drafts=JSON.parse(localStorage.getItem('tge_manager_stage1_drafts')||'{}')||{}}catch{}
   drafts.games=(drafts.games||[]).filter(g=>Number(g.id)!==Number(before.id));
   localStorage.setItem('tge_manager_stage1_drafts',JSON.stringify(drafts));
   games=games.filter(g=>Number(g.id)!==Number(before.id));
   dialog.close();refreshOptions();render();renderCollections();
   alert('Game deleted from GitHub. Wait for the Cloudflare deployment, then refresh the Game Manager. The image file was retained.');
  }catch(e){alert('Game NOT deleted: '+e.message)}
  finally{button.disabled=false;button.textContent='🗑 Delete Game'}
 });
})();
