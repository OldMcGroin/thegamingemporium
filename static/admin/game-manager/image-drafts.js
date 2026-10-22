/* Game Manager image drafts: browser-local image bytes; never stored in localStorage. */
(()=>{'use strict';
const DB='tge-manager-image-drafts-v1';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function put(key,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(value,key);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function get(key){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('images','readonly');const r=tx.objectStore('images').get(key);r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>{db.close();reject(r.error)}})}
const id=()=>Number.isSafeInteger(editing)&&editing>0?editing:(Number.isSafeInteger(tgeEditingIndex)&&tgeEditingIndex>=0?Number(games[tgeEditingIndex]?.id)||null:null);
function validate(file){
 if(!['image/png','image/jpeg','image/webp','image/avif'].includes(file.type))throw Error('Select a PNG, JPEG, WebP or AVIF image.');
 if(file.size>20*1024*1024)throw Error('Image exceeds 20 MB.');
}
function loadImage(file){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  let settled=false;
  function done(err){if(settled)return;settled=true;URL.revokeObjectURL(url);err?reject(err):resolve(img)}
  img.onload=()=>done(null);
  img.onerror=()=>done(Error('Unable to decode this image on your device. Try exporting it as JPEG or PNG.'));
  img.src=url;
 });
}
async function convertBlob(file){
 validate(file);
 let source,close=()=>{};
 // The selected Google Photos image can already be decoded in the Original Image box,
 // even when Android's transient file provider fails on a second read.
 // Reuse that exact loaded HTMLImageElement before attempting to reopen the file.
 const selected=document.getElementById('f_image')?.files?.[0];
 const shown=document.querySelector('#imagePreview img');
 if(selected===file&&shown?.complete&&shown.naturalWidth>0&&shown.naturalHeight>0){
  source=shown;
 }else{
  try{
   source=await loadImage(file);
  }catch(e){
   if(typeof createImageBitmap!=='function')throw e;
   source=await createImageBitmap(file);
   close=()=>source.close();
  }
 }
 try{
  const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
  if(!width||!height)throw Error('The selected image has invalid dimensions.');
  const scale=Math.min(1,1400/Math.max(width,height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image conversion is unavailable in this browser.');
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
  if(!blob||blob.type!=='image/webp'||blob.size>900000)throw Error('Image could not be compressed below 900 KB. Try a smaller image.');
  return blob;
 }finally{close()}
}
function blobDataURL(blob){
 return new Promise((resolve,reject)=>{
  const r=new FileReader();r.onload=()=>resolve(String(r.result));
  r.onerror=()=>reject(Error('Could not read the converted image.'));
  r.readAsDataURL(blob);
 });
}
async function convert(file){
 const dataURL=await blobDataURL(await convertBlob(file));
 return dataURL.split(',')[1];
}
window.tgeImageDrafts={previewDataURL:async file=>blobDataURL(await convertBlob(file))};
function random(){return [...crypto.getRandomValues(new Uint8Array(8))].map(x=>x.toString(16).padStart(2,'0')).join('')}
const originalSave=window.saveGame;
window.saveGame=async function(){
 const file=document.getElementById('f_image').files?.[0];
 if(!file){originalSave();return;}
 const title=document.getElementById('f_title').value.trim(),link=document.getElementById('f_link').value.trim(),cat=document.getElementById('f_category').value;
 if(!title||!cat||!/^https?:\/\//i.test(link)){originalSave();return;}
 try{
  const base64=await convert(file);
  const gameId=id()||nextUniqueGameId();
  const path='/Images/Games/manager-'+gameId+'-'+random()+'.webp';
  await put(path,base64);
  originalSave();
  const g=games.find(g=>Number(g.id)===gameId);
  if(!g)throw Error('Saved game was not found');
  g.image=path;persistDrafts();render();
  alert('Artwork saved as a LOCAL draft. It will be uploaded only when you publish this game.');
 }catch(e){alert('Image was not saved: '+e.message)}
};
const originalSaveCollection=window.saveCollection;
window.saveCollection=async function(){
 const file=document.getElementById('c_image')?.files?.[0];
 if(!file){originalSaveCollection();return;}
 const name=document.getElementById('c_name').value.trim();
 const collectionSlug=document.getElementById('c_slug').value||name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 if(!name||!collectionSlug||collections.some((c,i)=>i!==editingCollection&&c.slug===collectionSlug)){originalSaveCollection();return;}
 try{
  const base64=await convert(file);
  const path='/Images/Games/'+collectionSlug+'-collection.webp';
  await put(path,base64);
  originalSaveCollection();
  const c=collections.find(c=>c.slug===collectionSlug);
  if(!c)throw Error('Collection draft was not found');
  c.image=path;persistDrafts();renderCollections();
  alert('Collection artwork saved locally. Publish the collection in Review & Publish to upload it.');
 }catch(e){alert('Collection image was not saved: '+e.message)}
};
window.tgeGetImageUpload=async path=>{
 if(!path||!(/^\/Images\/Games\/manager-[0-9]+-[a-f0-9]{16}\.webp$/.test(path)||/^\/Images\/Games\/[a-z0-9]+(?:-[a-z0-9]+)*-collection\.webp$/.test(path)))return null;
 const base64=await get(path);
 return base64?{mime:'image/webp',base64}:null;
};
})();
