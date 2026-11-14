/* FUN_INTEGRATED_CONTROL_CENTER_UI_V1 — presentation only, no privileged calls. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const shell=$('fi-ui-shell'),commerce=$('fi-commerce-panel'),ml=$('fi-ml-panel');
if(!shell||!commerce||!ml)return; // Preserve the original UI if integration is incomplete.
const unified=location.pathname==='/unified/';
const views=new Set(unified?['chat','tools']:['overview','commerce','ml','workspace']);
const nativeTop=[...document.body.children].filter(el=>el!==shell&&el!==commerce&&el!==ml&&
 !['SCRIPT','STYLE','LINK'].includes(el.tagName));
const nativeMain=[...nativeTop].find(el=>el.tagName==='MAIN')||null;
const togg=(el,hidden)=>{if(el)el.classList.toggle('fi-ui-hidden',hidden)};
const copy={
 overview:['Overview','A high-level view of running services and the next actions you can take.'],
 commerce:['Commerce Intelligence','Google search trends, Shopify evidence and product research — no automatic purchases.'],
 ml:['Machine Learning','Run bounded scikit-learn analysis with optional local Qwen explanation.'],
 chat:['Unified Qwen Chat','Talk to your local Qwen model, with any local execution subject to separate review.'],
 tools:['Tools & Review','Exact REA inspections, staged files and execution evidence. Approval is required.'],
 workspace:['Original Workspace','The original Fun Industrial control center, preserved with all of its controls.']
};
function desired(){
 const requested=new URLSearchParams(location.search).get('view');
 return views.has(requested)?requested:(unified?'chat':'overview');
}
function render(){
 const view=desired(),legacyVisible=view==='workspace'||(unified&&(view==='chat'||view==='tools'));
 $('fi-ui-title').textContent=copy[view][0];$('fi-ui-subtitle').textContent=copy[view][1];
 togg($('fi-ui-overview'),view!=='overview');
 togg(commerce,view!=='commerce');togg(ml,view!=='ml');
 for(const el of nativeTop)togg(el,el.id==='fi-hub-nav'||!legacyVisible);
 for(const nav of shell.querySelectorAll('a[data-fi-view]')){
  if(nav.dataset.fiView===view)nav.setAttribute('aria-current','page');
  else nav.removeAttribute('aria-current');
 }
 if(unified&&nativeMain){
  // The upstream 8798 page retains all event handlers and approval panels.
  const toolView=view==='tools',chatView=view==='chat';
  for(const id of ['v3-panel','v31-panel','v32-panel','v34-panel','v4-panel'])
   togg($(id),chatView);
  const history=$('history');
  if(history){
   const conversation=history.closest('section.panel');
   togg(conversation,toolView);
  }
  const request=$('task');
  if(request){
   togg(request,toolView);
   togg(nativeMain.querySelector('label[for="task"]'),toolView);
   const send=$('send');
   if(send)togg(send.closest('.actions'),toolView);
  }
  // Do not hide #action-review; explicit operator approval may be pending.
 }
 document.title='Fun Industrial · '+copy[view][0];
}
for(const a of shell.querySelectorAll('a[data-fi-view],a.fi-ui-feature')){
 a.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  const url=new URL(a.href,location.href);
  if(url.origin!==location.origin||url.pathname!==location.pathname)return;
  if(!views.has(url.searchParams.get('view')))return;
  event.preventDefault();
  history.pushState(null,'',url.pathname+url.search);
  render();window.scrollTo({top:0,behavior:'instant'});
 });
}
window.addEventListener('popstate',render);
let checking=false;
const card=(id,label,state='unknown')=>{
 const el=$(id);if(!el)return;
 el.textContent=label;el.dataset.fiState=state;
};
async function readOnly(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
 try{
  const response=await fetch(path,{method:'GET',cache:'no-store',signal:controller.signal,
   credentials:'same-origin',headers:{accept:'application/json'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(timer)}
}
async function check(){
 if(checking)return;checking=true;
 const button=$('fi-ui-refresh');if(button)button.disabled=true;
 const names=['/api/unified/status','/api/ml/dashboard/status','/api/commerce/status','/api/commerce/opportunities'];
 try{
  const results=await Promise.allSettled(names.map(path=>readOnly(path)));
  const val=i=>results[i].status==='fulfilled'?results[i].value:null;
  const chat=val(0),learn=val(1),store=val(2),queue=val(3);
  card('fi-ui-ai',chat?.ai?.ready===true?'Ready':'Unavailable',chat?.ai?.ready===true?'good':'hold');
  card('fi-ui-local',chat?.local?.ready===true?String(chat.local.count||0)+' available':'Unavailable',chat?.local?.ready===true?'good':'hold');
  card('fi-ui-rea',chat?.rea?.ready===true?String(chat.rea.count||0)+' cataloged':'Unavailable',chat?.rea?.ready===true?'good':'hold');
  card('fi-ui-ml',learn?.state==='ready'?'Ready':'Unavailable',learn?.state==='ready'?'good':'hold');
  card('fi-ui-trends',store?.googleTrends?
   String(store.googleTrends.count||0)+' topics saved':'Unavailable',store?.googleTrends?'good':'hold');
  const configured=store?.shopify?.configured===true;
  card('fi-ui-shop',!store?'Unavailable':configured?'API configured':'Setup required',
   !store||!configured?'hold':'good');
  const checked=$('fi-ui-last-checked');
  if(checked){
   const matches=Array.isArray(queue?.matches)?queue.matches.length:0;
   checked.textContent='Checked '+new Date().toLocaleTimeString()+
    ' · '+matches+' catalog research matches · status reads only, no automatic polling';
  }
 }catch(error){
  const checked=$('fi-ui-last-checked');if(checked)checked.textContent='Health check held: '+String(error.message||error).slice(0,120);
 }finally{checking=false;if(button)button.disabled=false}
}
const refresh=$('fi-ui-refresh');if(refresh)refresh.addEventListener('click',check);
render();
document.body.classList.add('fi-ui-ready');
check(); // One bounded read-only check on page load, never a timer or background worker.
})();
