/* Fun Industrial organized UI preview: only explicit chat and user-click actions.
   No local persistence, remote assets, automatic polling, tools, or process controls. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const ROUTES=Object.freeze({
 home:'Home',chat:'AI Chat',research:'Research',operations:'Operations',
 commerce:'Commerce',tools:'Tools & ML',system:'System'
});
const NAV=Array.from(document.querySelectorAll('[data-route]'));
let chatBusy=false,refreshBusy=false;
let searchResults=[],searchIndex=0;
let refreshedResearch=false,refreshedHealth=false;
function parseRoute(){
 const raw=location.hash.replace(/^#/,'')||'home';
 const [key,qs='']=raw.split('?');
 return {name:Object.hasOwn(ROUTES,key)?key:'home',
         area:new URLSearchParams(qs).get('area')||'overview'};
}
function closeMenu(){
 document.body.classList.remove('nav-open');
 $('sidebar-backdrop').hidden=true;
 $('menu-button').setAttribute('aria-expanded','false');
 $('menu-button').setAttribute('aria-label','Open menu');
}
function openMenu(){
 document.body.classList.add('nav-open');
 $('sidebar-backdrop').hidden=false;
 $('menu-button').setAttribute('aria-expanded','true');
 $('menu-button').setAttribute('aria-label','Close menu');
}
function route(){
 const {name,area}=parseRoute();
 document.title='Fun Industrial · '+ROUTES[name]+' · Preview';
 $('breadcrumb-current').textContent=ROUTES[name];
 for(const node of document.querySelectorAll('[data-view]'))node.hidden=node.dataset.view!==name;
 for(const node of NAV){
  if(node.dataset.route===name)node.setAttribute('aria-current','page');
  else node.removeAttribute('aria-current');
 }
 for(const node of document.querySelectorAll('[data-mobile-route]')){
  if(node.dataset.mobileRoute===name)node.setAttribute('aria-current','page');
  else node.removeAttribute('aria-current');
 }
 if(name==='operations')setOps(area);
 if(name==='research'&&!refreshedResearch){refreshedResearch=true;void research()}
 if((name==='home'||name==='system')&&!refreshedHealth){refreshedHealth=true;void health()}
 closeMenu();window.scrollTo({top:0,behavior:'instant'});
}
$('menu-button').addEventListener('click',()=>document.body.classList.contains('nav-open')?closeMenu():openMenu());
$('sidebar-backdrop').addEventListener('click',closeMenu);
for(const nav of NAV)nav.addEventListener('click',closeMenu);
for(const btn of document.querySelectorAll('[data-mobile-route]')){
 btn.addEventListener('click',()=>{location.hash=btn.dataset.mobileRoute;closeMenu()});
}
window.addEventListener('hashchange',route);
async function getJson(path,timeout=9000){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const r=await fetch(path,{method:'GET',credentials:'same-origin',cache:'no-store',
   headers:{accept:'application/json'},signal:ctrl.signal});
  if(!r.ok)throw Error('HTTP '+r.status);
  return await r.json();
 }finally{clearTimeout(timer)}
}
function status(name,label,ready=false){
 for(const el of document.querySelectorAll('[data-status="'+name+'"]')){
  el.textContent=label;el.dataset.state=ready?'ready':'hold';
 }
}
function pretty(x){return typeof x==='number'&&Number.isFinite(x)?x.toLocaleString():'—'}
function logLine(id,value){const el=$(id);if(el)el.textContent=value}
async function health(){
 if(refreshBusy)return;refreshBusy=true;
 const buttons=Array.from(document.querySelectorAll('[data-action="refresh"]'));
 for(const b of buttons)b.disabled=true;
 logLine('last-refreshed','Checking services on demand…');
 const endpoints=['/api/fun/ui-preview/health','/api/fun/math/v3/status',
   '/api/operator/demand/status','/api/ml/dashboard/status'];
 try{
  const outcomes=await Promise.allSettled(endpoints.map(e=>getJson(e)));
  const d=i=>outcomes[i].status==='fulfilled'?outcomes[i].value:null;
  const qwen=d(0),math=d(1),ops=d(2),ml=d(3);
  status('qwen',qwen?.state==='READY'?'Healthy':'Not verified',qwen?.state==='READY');
  status('math',math?.ready===true?'Verified':'Not verified',math?.ready===true);
  status('ops',ops?.version==='fial5.14-real-purchase-demand-v1'?'Available':'Not verified',ops?.version==='fial5.14-real-purchase-demand-v1');
  status('ml',ml?.state==='ready'?'Available':'Not verified',ml?.state==='ready');
  const t='Checked '+new Date().toLocaleTimeString()+' · read-only, no background polling';
  logLine('last-refreshed',t);logLine('system-checked',t);
 }catch{
  logLine('last-refreshed','Some local services could not be reached');
 }finally{refreshBusy=false;for(const b of buttons)b.disabled=false}
}
for(const btn of document.querySelectorAll('[data-action="refresh"]'))btn.addEventListener('click',health);
async function research(){
 logLine('research-status','Loading verified V3 evidence…');
 try{
  const d=await getJson('/api/fun/math/v3/status');
  if(d?.ready!==true||d.version!=='fun-math-v3-readonly-8802')
   throw Error('V3 report not verified');
  $('research-draws').textContent=pretty(d.draws);
  $('research-last').textContent=d.lastDraw||'—';
  $('research-future').textContent=pretty(d.prospective?.futureScored);
  $('research-evalue').textContent=pretty(d.prospective?.eValue);
  logLine('research-status',(d.stale?'Stale source; ': 'Verified local report · ')+
    String(d.prospective?.state||'Future status unavailable').replace(/_/g,' ').toLowerCase()+
    ' · no verified predictive edge');
 }catch(e){logLine('research-status','Research report unavailable: '+String(e.message).slice(0,130))}
}
function message(who,text,kind){
 const host=$('chat-history');const welcome=host.querySelector('.chat-welcome');
 if(welcome)welcome.remove();
 const item=document.createElement('article');item.className='message '+kind;
 const heading=document.createElement('strong');heading.className='who';heading.textContent=who;
 const body=document.createElement('div');body.textContent=text;
 item.append(heading,body);host.append(item);host.scrollTop=host.scrollHeight;
 return body;
}
$('chat-form').addEventListener('submit',async event=>{
 event.preventDefault();if(chatBusy)return;
 const input=$('chat-input'),q=input.value.trim();
 if(q.length<4||q.length>1200){input.setCustomValidity('Use 4–1200 characters');input.reportValidity();input.setCustomValidity('');return}
 const request={question:q};
 if($('chat-v3').checked)request.useMathV3Evidence=true;
 if($('chat-v2').checked)request.useMathEvidence=true;
 input.value='';message('You',q,'user');const answer=message('Qwen','Requesting a local response…','assistant');
 chatBusy=true;$('chat-send').disabled=true;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),185000);
 try{
  const res=await fetch('/api/fial/grounded/chat',{method:'POST',credentials:'same-origin',
   headers:{'content-type':'application/json','x-fi-chat-click':'one-local-model-response'},
   body:JSON.stringify(request),signal:ctrl.signal});
  let d;try{d=await res.json()}catch{throw Error('Invalid response from local chat')}
  if(!res.ok)throw Error('Chat HTTP '+res.status+': '+String(d.error||'request held').slice(0,150));
  if(d.state==='ANSWERED_BY_QWEN'&&typeof d.answer==='string'&&d.answer.trim()){
   answer.textContent=d.answer;
  }else{
   answer.textContent='No verified Qwen answer. '+String(d.reason||d.warning||d.state||'unknown').slice(0,350);
  }
 }catch(e){
  answer.parentElement.classList.add('error');
  answer.textContent='Connection or model request failed: '+String(e.message||e).slice(0,240)+
   '. Check System for service status. No automatic retry.';
 }finally{clearTimeout(timer);chatBusy=false;$('chat-send').disabled=false;input.focus()}
});
const AREAS=Object.freeze({
 overview:{
  title:'Review before you act.',
  desc:'Choose a category and work with verified evidence. Research is not a completed action.',
  primary:'Full operations workspace',href:'/operations/',secondary:'Recent research and qualifications'
 },
 buyers:{
  title:'Fleet Buyers',
  desc:'Fleet operators, district transportation, public agencies and verifiable buyer requirements.',
  primary:'Open buyer evidence',href:'/operations/#fi-fleet-buyer',secondary:'Source evidence is not a confirmed order'
 },
 procurement:{
  title:'Procurement',
  desc:'Official opportunity research, qualification gates, and upcoming bids where independently verified.',
  primary:'Open procurement research',href:'/operations/#fi-purchase-demand',secondary:'Bid readiness must be independently verified'
 },
 compliance:{
  title:'Regulatory & compliance',
  desc:'Government rules, procurement requirements, dated source records and qualification gaps.',
  primary:'Open regulatory evidence',href:'/operations/#fi-regulatory-intelligence',secondary:'Research is not legal approval or filing'
 }
});
function setOps(area){
 if(!Object.hasOwn(AREAS,area))area='overview';
 for(const b of document.querySelectorAll('[data-ops]'))b.setAttribute('aria-selected',String(b.dataset.ops===area));
 const d=AREAS[area],host=$('ops-content');host.replaceChildren();
 const wrap=document.createElement('div');wrap.className='ops-overview';
 const a=document.createElement('article');a.className='ops-feature';
 const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='VERIFIED EVIDENCE';
 const heading=document.createElement('h2');heading.textContent=d.title;
 const p=document.createElement('p');p.textContent=d.desc;
 const link=document.createElement('a');link.className='btn btn-primary';link.href=d.href;link.textContent=d.primary+' ↗';
 a.append(eyebrow,heading,p,link);
 const b=document.createElement('article');b.className='ops-feature ops-feature-soft';
 const bEyebrow=document.createElement('span');bEyebrow.className='eyebrow';bEyebrow.textContent='SOURCE-AWARE WORKFLOW';
 const bHeading=document.createElement('h3');bHeading.textContent=d.secondary;
 const bText=document.createElement('p');bText.textContent='Access the existing operations module. Reviews and approvals remain in their original workflow.';
 b.append(bEyebrow,bHeading,bText);wrap.append(a,b);host.append(wrap);
}
for(const tab of document.querySelectorAll('[data-ops]'))tab.addEventListener('click',()=>{
 const area=tab.dataset.ops;location.hash='operations?area='+area;
 if(parseRoute().area===area)setOps(area);
});
for(const button of document.querySelectorAll('[data-open-frame]')){
 button.addEventListener('click',()=>{
  const type=button.dataset.openFrame;
  const dst=$(type==='ml'?'ml-frame':'commerce-frame');
  if(!dst)return;
  if(!dst.querySelector('iframe')){
   const frame=document.createElement('iframe');
   frame.src='/workspace/?view='+encodeURIComponent(type)+'&embedded=1';
   frame.title='Existing Fun Industrial '+type+' module';frame.loading='lazy';
   frame.referrerPolicy='no-referrer';frame.className='embedded-frame';
   dst.append(frame);
  }
  dst.hidden=false;button.disabled=true;button.textContent=type==='ml'?'ML module opened below':'Commerce module opened below';
 });
}
const SEARCH=[
 ['Home','System overview and quick links','#home'],
 ['AI Chat','Direct local Qwen conversation','#chat'],
 ['Research','Mathematical studies and evidence','#research'],
 ['Operations','Government and business operations','#operations'],
 ['Commerce','Shopify and market trends','#commerce'],
 ['Tools & ML','REA and local analytics','#tools'],
 ['System','Health status and advanced workspace','#system'],
 ['Fleet buyers','Buyer evidence and demand','#operations?area=buyers'],
 ['Roofing opportunities','Countywide permit evidence and NWS forecast','/roofing/'],
 ['Procurement','Source-linked bid research','#operations?area=procurement'],
 ['Compliance','Regulatory status and evidence','#operations?area=compliance'],
 ['V3 mathematical lab','All candidate equation scores','/math/v3/'],
 ['Advanced Qwen Chat','Existing tools and model context','/chat/'],
 ['Original Dashboard','Unmodified previous workspace','/']
];
const modal=$('search-dialog'),search=$('search-input'),results=$('search-results');
function openSearch(){if(typeof modal.showModal==='function'){modal.showModal();search.value='';searchIndex=0;updateSearch();search.focus()}}
function closeSearch(){if(modal.open)modal.close()}
function updateSearch(){
 const term=search.value.trim().toLowerCase();
 searchResults=SEARCH.filter(x=>(x[0]+' '+x[1]).toLowerCase().includes(term)).slice(0,9);
 searchIndex=Math.min(searchIndex,Math.max(searchResults.length-1,0));
 results.replaceChildren();
 if(!searchResults.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='No matching workspace.';results.append(empty);return}
 searchResults.forEach(([name,detail,dest],i)=>{
  const button=document.createElement('button');button.type='button';button.className='search-result';
  button.setAttribute('role','option');button.setAttribute('aria-selected',String(i===searchIndex));
  const info=document.createElement('span'),title=document.createElement('strong'),small=document.createElement('small'),icon=document.createElement('span');
  title.textContent=name;small.textContent=detail;info.append(title,small);icon.textContent='↗';
  button.append(info,icon);button.addEventListener('click',()=>choose(i));results.append(button);
 });
}
function choose(index){
 const d=searchResults[index]?.[2];if(!d)return;closeSearch();
 if(d.startsWith('#'))location.hash=d.slice(1);else location.assign(d);
}
$('global-search').addEventListener('click',openSearch);
$('close-search').addEventListener('click',closeSearch);
search.addEventListener('input',()=>{searchIndex=0;updateSearch()});
search.addEventListener('keydown',event=>{
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){
  event.preventDefault();if(searchResults.length)searchIndex=(searchIndex+(event.key==='ArrowDown'?1:-1)+searchResults.length)%searchResults.length;
  updateSearch();
 }else if(event.key==='Enter'){event.preventDefault();choose(searchIndex)}
});
document.addEventListener('keydown',event=>{
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch()}
 if(event.key==='Escape')closeMenu();
});
route();
})();