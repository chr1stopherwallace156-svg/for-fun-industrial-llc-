// FIAL5.4 local executive console, read-only and inert without a human viewing it.
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const state=$('fi-exec-state'),queue=$('fi-exec-queue'),filter=$('fi-exec-filter');
 const refresh=$('fi-exec-refresh');if(!state||!queue||!filter||!refresh)return;
 let tasks=[];
 function line(parent,label,value){
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=label+': ';p.append(b,document.createTextNode(String(value??'Unknown')));
  parent.append(p);
 }
 function show(){
  const chosen=filter.value;
  const visible=tasks.filter(t=>chosen==='all'||t.kind===chosen);
  queue.replaceChildren();
  if(!visible.length){const p=document.createElement('p');p.textContent='No work items in this category.';queue.append(p)}
  for(const t of visible.slice(0,120)){
   const card=document.createElement('article');card.className='item';
   const title=document.createElement('strong');title.textContent=t.title||'Unnamed item';card.append(title);
   const tags=document.createElement('div');for(const item of [t.company,t.kind,t.phase,'Priority '+t.priority]){
    const tag=document.createElement('span');tag.className='chip';tag.textContent=String(item||'unknown');tags.append(tag)}
   card.append(tags);
   line(card,'Due date',t.due||'Unverified');
   line(card,'Next evidence',Array.isArray(t.required)?t.required.join(' · '):'Unknown');
   line(card,'Source',t.source||'Unknown');
   queue.append(card);
  }
 }
 async function load(){
  refresh.disabled=true;state.textContent='Reading saved operations status…';
  try{
   const controller=new AbortController();
   const r=await fetch('/api/operator/status',{method:'GET',cache:'no-store',signal:controller.signal,credentials:'same-origin'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   if(data.version!=='fial5.4-executive-operator-v1'||!Array.isArray(data.items))throw Error('STATUS_IDENTITY_NOT_VERIFIED');
   $('fi-exec-items').textContent=String(data.active_items||0);
   $('fi-exec-updates').textContent=String(data.new_or_changed||0);
   $('fi-exec-review').textContent=String(data.review_required||0);
   $('fi-exec-time').textContent=String(data.cycle_utc||'Not activated');
   const company=Array.isArray(data.companies)?data.companies.map(x=>x.name).join(' and '):'Pending setup';
   $('fi-exec-connections').textContent='Companies: '+company+' · Gmail: '+String(data.mail_state||'not connected')+
    ' · Grants: '+String(data.grants?.state||'no snapshot')+
    (data.grants?.issue?' · Grant source HOLD: '+String(data.grants.issue):'');
   state.textContent=data.state==='not_activated'?
    'Not activated. Run the guarded executive-operator installation command first.':
    'Last completed local cycle: '+String(data.cycle_utc||'unknown')+
    ' · External execution authority: NONE';
   tasks=data.items;
   const current=filter.value;
   filter.replaceChildren();
   for(const value of ['all',...(Array.isArray(data.domains)?data.domains:[])]){
    const opt=document.createElement('option');opt.value=value;opt.textContent=value==='all'?'All workstreams':value;
    filter.append(opt)
   }
   filter.value=Array.from(filter.options).some(o=>o.value===current)?current:'all';
   show();
  }catch(e){state.textContent='Read-only status HOLD: '+String(e.message||e).slice(0,200)}
  finally{refresh.disabled=false}
 }
 filter.addEventListener('change',show);refresh.addEventListener('click',load);
 void load();
})();
