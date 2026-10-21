/* Game Manager image drafts: browser-local image bytes; never stored in localStorage. */
(()=>{'use strict';
const DB='tge-manager-image-drafts-v1';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function put(key,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(value,key);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function get(key){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('images','readonly');const r=tx.objectStore('images').get(key);r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>{db.close();reject(r.error)}})}
const id=()=>Number.isSafeInteger(editing)&&editing>0?editing:(Number.isSafeInteger(tgeEditingIndex)&&tgeEditingIndex>=0?Number(games[tgeEditingIndex]?.id)||null:null);
async function convert(file){
 if(!['image/png','image/jpeg','image/webp','image/avif'].includes(file.type))throw Error('Select a PNG, JPEG, WebP or AVIF image.');
 if(file.size>20*1024*1024)throw Error('Image exceeds 20 MB.');
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
 if(!blob||blob.type!=='image/webp'||blob.size>900000)throw Error('Image could not be compressed below 900 KB. Try a smaller image.');
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)});
}
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
window.tgeGetImageUpload=async path=>{
 if(!path||!/^\/Images\/Games\/manager-[0-9]+-[a-f0-9]{16}\.webp$/.test(path))return null;
 const base64=await get(path);
 return base64?{mime:'image/webp',base64}:null;
};
})();
