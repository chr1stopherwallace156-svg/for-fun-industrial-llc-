// Fun Industrial Control Deck: browser-only UI state, explicitly clicked reads.
// Never discovers devices, executes tools, or sends commands to LAN hardware.
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const states=Object.freeze({
  ps5:{name:'PlayStation 5',instructions:'Enable PS Remote Play and its Rest Mode network-wake settings on the PS5. Pair with the official Windows Remote Play client using your own PSN account. Verify a successful session on the PC before enabling a reviewed Fun Industrial adapter. A fully powered-off PS5 cannot be awakened by ordinary Remote Play.'},
  roku:{name:'Roku',instructions:'Connect the Roku and your Windows PC to a network where local device communication is allowed. Check Roku platform settings for local network control permissions. Add a reviewed Roku adapter only after ownership, discovery scope, pairing policy, and permitted commands are verified. The remote protocol does not itself provide screen video.'},
  macbook:{name:'MacBook',instructions:'Enable macOS Screen Sharing or Remote Management on the Mac with an authorized user account. Use an authenticated remote desktop client from Windows and review its access scope. A screen connection is not yet linked into Fun Industrial.'},
  ipad:{name:'iPad',instructions:'To view the iPad display, configure an Apple-supported screen-mirroring path with compatible hardware (for example iPad to Mac). Windows control of iPadOS is limited; full desktop-style remote control must not be assumed.'}
 });
 const storagePrefix='fi-control-deck-v1-alias-';
 const panel=$('inspector'),title=$('device-title'),alias=$('device-alias'),
  status=$('save-status'),steps=$('next-text'),nextTitle=$('next-title');
 let current=null;
 const safeAlias=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,56):'';
 function readAlias(id){
  try{return safeAlias(localStorage.getItem(storagePrefix+id))}catch{return ''}
 }
 function label(id){return readAlias(id)||states[id].name}
 function reflectAliases(){
  Object.keys(states).forEach(id=>{const e=$('name-'+id);if(e)e.textContent=label(id)});
 }
 function showDevice(id){
  if(!Object.prototype.hasOwnProperty.call(states,id))return;
  current=id;
  Object.keys(states).forEach(x=>{
   const b=document.querySelector('[data-device="'+x+'"]');
   if(b)b.setAttribute('aria-pressed',String(x===id));
  });
  title.textContent=label(id);
  alias.value=readAlias(id);
  nextTitle.textContent='Prepare '+states[id].name;
  steps.textContent=states[id].instructions;
  status.textContent='Device controls are not installed. This is a local setup profile.';
  panel.hidden=false;
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 document.querySelectorAll('[data-device]').forEach(b=>b.addEventListener('click',()=>showDevice(b.dataset.device)));
 $('close')?.addEventListener('click',()=>{
  panel.hidden=true;current=null;
  document.querySelectorAll('[data-device]').forEach(b=>b.setAttribute('aria-pressed','false'));
 });
 $('save-alias')?.addEventListener('click',()=>{
  if(!current)return;
  const name=safeAlias(alias.value);
  try{
   if(name)localStorage.setItem(storagePrefix+current,name);
   else localStorage.removeItem(storagePrefix+current);
   reflectAliases();title.textContent=label(current);
   status.textContent='Nickname saved in this browser only. No device was contacted.';
  }catch{status.textContent='Browser storage unavailable. No device was contacted.'}
 });
 $('clear-alias')?.addEventListener('click',()=>{
  if(!current)return;
  alias.value='';
  try{localStorage.removeItem(storagePrefix+current);status.textContent='Nickname reset in this browser.'}
  catch{status.textContent='Browser storage unavailable.'}
  reflectAliases();title.textContent=label(current);
 });
 $('copy-steps')?.addEventListener('click',async()=>{
  if(!current)return;
  const text=states[current].name+'\n'+states[current].instructions;
  try{await navigator.clipboard.writeText(text);status.textContent='Setup guidance copied to clipboard.'}
  catch{status.textContent='Clipboard unavailable. The guidance is visible above.'}
 });
 let busy=false;
 function mark(id,state){
  const el=$(id+'-state'),light=$(id+'-light');
  const good=state==='ready';
  if(el){el.textContent=good?'Ready':state==='not_checked'?'Not checked':'Not verified';
   el.classList.toggle('good',good);el.classList.toggle('bad',!good&&state!=='not_checked')}
  if(light){light.classList.toggle('good',good);light.classList.toggle('bad',!good&&state!=='not_checked')}
 }
 $('refresh')?.addEventListener('click',async()=>{
  if(busy)return;busy=true;
  const button=$('refresh');button.disabled=true;
  $('checked').textContent='Reading fixed local service statuses…';
  try{
   const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),6500);
   let response;
   try{response=await fetch('/api/fun/control/status',{method:'GET',cache:'no-store',signal:ctl.signal,credentials:'same-origin'})}
   finally{clearTimeout(timeout)}
   if(!response.ok)throw Error('HTTP '+response.status);
   const value=await response.json();
   if(value.version!=='fun-control-deck-v1'||value.state!=='read_only_observation'||
      value.deviceControlEnabled!==false||value.externalActions!==0)
     throw Error('Unverified control status');
   mark('qwen',value.qwen?.state);
   mark('ml',value.scikit?.state);
   mark('rea',value.rea?.state);
   $('checked').textContent='Observed '+new Date(value.observedAt).toLocaleString()+' · No device discovery, control or restarts.';
  }catch(e){
   for(const id of ['qwen','ml','rea'])mark(id,'unverified');
   $('checked').textContent='Service check unavailable ('+String(e.message||e).slice(0,120)+'). No service was restarted.';
  }finally{busy=false;button.disabled=false}
 });
 reflectAliases();
})();