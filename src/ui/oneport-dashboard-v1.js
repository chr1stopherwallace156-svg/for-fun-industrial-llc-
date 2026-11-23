/* Fun Industrial V1: one dashboard URL, lazy local iframes; no external links,
   no start/stop/process actions, no periodic polling, no cross-origin iframe. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const root=$('fi-app');if(!root)return;
const VIEWS=Object.freeze({
 overview:{name:'Overview',type:'overview',description:''},
 chat:{name:'Local AI Chat',type:'chat',description:'Qwen and relevant Cognee memory. Each response is an explicit local action; no tools execute automatically.'},
 tools:{name:'Tools & REA review',type:'tools',description:'Inspect tools and review execution proposals. Tool execution requires separate operator approval.'},
 operations:{name:'Operations',type:'ops',anchor:'',description:'Business work queue, verified results and local operational controls.'},
 buyers:{name:'Fleet Buyers',type:'ops',anchor:'fi-fleet-buyer',description:'Source-linked buyer research, fleet evidence and unmet qualification gates.'},
 procurement:{name:'Procurement',type:'procurement',description:'Published notice research and source verification, not assumed sales or active contracts.'},
 commercial:{name:'Commercial Fit',type:'ops',anchor:'fi-commercial-fit',description:'Independent contractor credentials, official opportunities and partnership eligibility.'},
 regulatory:{name:'Regulatory & Evidence',type:'ops',anchor:'fi-regulatory-intelligence',description:'Regulatory monitoring, dated source records and economic indicators.'},
 commerce:{name:'Commerce',type:'legacy',mode:'commerce',description:'Search trends and Shopify research with explicit refresh controls.'},
 ml:{name:'Machine Learning',type:'legacy',mode:'ml',description:'Bounded local analytics and operator-approved model training.'},
 reasoning:{name:'Semantic Reasoning',type:'reasoning',description:'Analyze Python source, prove bounded mathematical properties, replay source and create unverified cognitive evidence.'},
 workspace:{name:'Original Workspace',type:'legacy',mode:'workspace',description:'Existing dashboard interface preserved for advanced and legacy workflows.'}
});
const keys=Object.keys(VIEWS);
const frames=new Map();
const mount=$('fi-module-container');
let current='overview';
const NAV=[...document.querySelectorAll('[data-section]')];
function route(){
 const key=window.location.hash.replace(/^#/,'').toLowerCase();
 return Object.hasOwn(VIEWS,key)?key:'overview'
}
function safeFrame(type,url,title){
 let f=frames.get(type);
 if(!f){
  f=document.createElement('iframe');
  f.className='fi-frame';
  f.setAttribute('title',title+' · Fun Industrial local module');
  f.setAttribute('loading','lazy');
  f.setAttribute('referrerpolicy','no-referrer');
  f.setAttribute('allow','clipboard-write');
  f.hidden=true;
  frames.set(type,f);
  mount.append(f)
 }
 if(f.getAttribute('src')!==url){f.setAttribute('src',url)}
 return f
}
const OPS='/operations/?embedded=1';
function show(){
 const chosen=route(),view=VIEWS[chosen];
 current=chosen;
 $('fi-crumb-current').textContent=view.name;
 document.title='Fun Industrial · '+view.name;
 const overview=chosen==='overview';
 $('fi-overview').hidden=!overview;
 $('fi-module').hidden=overview;
 for(const a of NAV){
  if(a.dataset.section===chosen)a.setAttribute('aria-current','page');
  else a.removeAttribute('aria-current')
 }
 for(const frame of frames.values())frame.hidden=true;
 if(!overview){
  $('fi-module-name').textContent=view.name;
  $('fi-module-description').textContent=view.description;
  $('fi-module-eyebrow').textContent=(view.type==='ops'||view.type==='procurement')?'BUSINESS INTELLIGENCE':
   view.type==='legacy'?'LOCAL CAPABILITIES':'LOCAL WORKSPACE';
  let frame;
  if(view.type==='ops'){
   // Keep one Operations iframe so switching its panels doesn't repeat
   // expensive status reads or discard operators' draft inputs.
   frame=safeFrame('ops',OPS,'Operations');
   if(view.anchor){
    const go=()=>{try{frame.contentWindow?.location.replace('#'+view.anchor)}catch{}};
    if(frame.dataset.loaded==='true')go();
    else frame.addEventListener('load',go,{once:true})
   }else if(frame.dataset.loaded==='true'){
    try{frame.contentWindow?.location.replace('#')}catch{}
   }
  }else if(view.type==='procurement'){
   frame=safeFrame('procurement','/procurement/','Procurement Evidence');
  }else if(view.type==='chat')frame=safeFrame('chat','/chat/?embedded=1','Local AI Chat · Qwen + FISRE');
  else if(view.type==='tools')frame=safeFrame('tools','/unified/?view=tools&embedded=1','Tools & REA review');
  else if(view.type==='reasoning')frame=safeFrame('reasoning','/fisre/?embedded=1','Semantic Reasoning');
  else frame=safeFrame('legacy','/workspace/?view='+view.mode+'&embedded=1','Original workspace');
  frame.hidden=false;
  frame.addEventListener('load',()=>{frame.dataset.loaded='true'},{once:true});
  mount.setAttribute('aria-label','Showing '+view.name+' from localhost')
 }
 closeMenu();
 window.scrollTo({top:0,behavior:'instant'});
}
function closeMenu(){
 document.body.classList.remove('fi-nav-open');
 $('fi-menu').setAttribute('aria-expanded','false');
 $('fi-menu').setAttribute('aria-label','Open navigation');
 $('fi-shade').hidden=true
}
function openMenu(){
 document.body.classList.add('fi-nav-open');
 $('fi-menu').setAttribute('aria-expanded','true');
 $('fi-menu').setAttribute('aria-label','Close navigation');
 $('fi-shade').hidden=false
}
$('fi-menu').addEventListener('click',()=>document.body.classList.contains('fi-nav-open')?closeMenu():openMenu());
$('fi-shade').addEventListener('click',closeMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
for(const a of NAV){
 a.addEventListener('click',event=>{
  const view=a.dataset.section;
  if(!Object.hasOwn(VIEWS,view))return;
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  if(route()!==view)window.location.hash=view;
  else show()
 })
}
window.addEventListener('hashchange',show);
let checking=false;
function metric(id,value,state){
 const el=$(id);if(!el)return;
 el.textContent=value;el.dataset.state=state
}
async function read(path){
 const ctl=new AbortController();
 const timer=setTimeout(()=>ctl.abort(),7000);
 try{
  const res=await fetch(path,{method:'GET',credentials:'same-origin',cache:'no-store',
   headers:{accept:'application/json'},signal:ctl.signal});
  if(!res.ok)throw Error('status '+res.status);
  return await res.json()
 }finally{clearTimeout(timer)}
}
async function health(){
 if(checking)return;checking=true;
 const btn=$('fi-health-refresh');btn.disabled=true;
 $('fi-last-check').textContent='Checking local services with read-only requests…';
 const paths=['/api/unified/status','/api/fial/grounded/status',
  '/api/ml/dashboard/status','/api/operator/demand/status'];
 const r=await Promise.allSettled(paths.map(read));
 const get=i=>r[i].status==='fulfilled'?r[i].value:null;
 const ai=get(0),grounded=get(1),ml=get(2),demand=get(3);
 const aiReady=ai?.ai?.ready===true&&grounded?.state==='ready';
 metric('fi-ai-state',aiReady?'Ready':'Not verified',aiReady?'ready':'hold');
 const toolsReady=ai?.rea?.ready===true;
 const count=Number(ai?.rea?.count);
 metric('fi-tools-state',toolsReady&&Number.isSafeInteger(count)?count+' catalogued':
   toolsReady?'Available':'Not verified',toolsReady?'ready':'hold');
 const mlReady=ml?.state==='ready';
 metric('fi-ml-state',mlReady?'Ready':'Not verified',mlReady?'ready':'hold');
 const contracts=demand?.counts?.buyer_orders,verified=demand?.version==='fial5.14-real-purchase-demand-v1';
 const safeOrders=verified&&Number.isSafeInteger(contracts)&&contracts>=0;
 metric('fi-demand-state',safeOrders?String(contracts)+' orders':'Not verified',safeOrders?'ready':'hold');
 $('fi-ai-note').textContent=ai?.ai?.ready===true?'One model on your PC':'Health verification required';
 const countGood=[aiReady,toolsReady,mlReady,verified].filter(Boolean).length;
 $('fi-top-health').textContent=countGood===4?'Core services verified':countGood+' / 4 statuses verified';
 $('fi-top-health').dataset.status=countGood===4?'ready':'hold';
 $('fi-last-check').textContent='Read-only status check · '+new Date().toLocaleTimeString()+
   ' · no background polling or extra models';
 checking=false;btn.disabled=false
}
$('fi-health-refresh').addEventListener('click',health);

// Keyboard-first local command palette: navigation only, never submits data.
const command=$('fi-command-dialog'),search=$('fi-command-input'),results=$('fi-command-results');
const commandButton=$('fi-command-open');
const NAV_LABELS=Object.entries(VIEWS).map(([id,v])=>({id,name:v.name,description:v.description}));
let matching=[];
let selected=0;
function commandResults(){
 const phrase=search.value.trim().toLocaleLowerCase().slice(0,80);
 matching=NAV_LABELS.filter(v=>(v.name+' '+v.description+' '+v.id).toLocaleLowerCase().includes(phrase)).slice(0,11);
 if(selected>=matching.length)selected=0;
 results.replaceChildren();
 if(!matching.length){
  const empty=document.createElement('p');
  empty.className='fi-command-empty';empty.textContent='No matching local workspace.';
  results.append(empty);return
 }
 for(const [i,v] of matching.entries()){
  const button=document.createElement('button');
  button.type='button';button.className='fi-command-item';
  button.setAttribute('role','option');button.setAttribute('aria-selected',String(selected===i));
  if(selected===i)button.dataset.highlight='true';
  const block=document.createElement('span');
  const name=document.createElement('strong');name.textContent=v.name;
  const hint=document.createElement('small');hint.textContent=v.description.slice(0,88)||'Open the overview';
  block.append(name,hint);
  const indicator=document.createElement('span');indicator.textContent='Open ↗';
  button.append(block,indicator);
  button.addEventListener('mousemove',()=>{if(selected!==i){selected=i;commandResults()}});
  button.addEventListener('click',()=>pickCommand(i));
  results.append(button)
 }
}
function pickCommand(i){
 const target=matching[i];if(!target)return;
 command.close();
 if(route()!==target.id)window.location.hash=target.id;
 else show()
}
function openCommand(){
 if(!command.open){
  search.value='';selected=0;commandResults();command.showModal();
  search.focus();
 }
}
commandButton.addEventListener('click',openCommand);
$('fi-command-close').addEventListener('click',()=>command.close());
search.addEventListener('input',()=>{selected=0;commandResults()});
search.addEventListener('keydown',e=>{
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){
  e.preventDefault();
  if(matching.length)selected=(selected+(e.key==='ArrowDown'?1:-1)+matching.length)%matching.length;
  commandResults()
 }
 if(e.key==='Enter'){e.preventDefault();pickCommand(selected)}
});
document.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
  e.preventDefault();openCommand()
 }
});
// Clicks outside the modal body close search without navigation side effects.
command.addEventListener('click',e=>{
 if(e.target!==command)return;
 const box=command.getBoundingClientRect();
 if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)command.close()
});

// Vendored MIT VanillaTilt. Pointer-capable, no external assets, memory-conscious.
function enableSpatialDepth(){
 const noMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pointer=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
 if(noMotion||!pointer||typeof VanillaTilt==='undefined')return;
 const stage=$('fi-spatial-stage');
 if(stage)VanillaTilt.init(stage,{max:10,speed:480,perspective:950,
  scale:1,glare:false,reset:true,gyroscope:false,
  'full-page-listening':false});
 for(const card of document.querySelectorAll('[data-spatial-card="true"]')){
  VanillaTilt.init(card,{max:3,speed:560,perspective:1250,
   scale:1.008,glare:false,reset:true,gyroscope:false,
   'full-page-listening':false})
 }
}
enableSpatialDepth();
show();
health();
})();
