// FIAL5.9.0 safe, zero-side-effect dashboard. No HTML from source APIs.
(()=>{'use strict';const root=document.getElementById('fi-fleet-opportunities');if(!root)return;
 const $=id=>document.getElementById(id);
 const summary=$('fi-fleet-summary'),queue=$('fi-fleet-queue'),
  sources=$('fi-fleet-sources'),signal=$('fi-fleet-current-signals'),
  filter=$('fi-fleet-filter');
 let data=null;
 function para(parent,label,val){
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=String(label)+': ';p.append(b,document.createTextNode(String(val??'unknown')));parent.append(p);
 }
 function safeLink(parent,label,url){
  if(typeof url!=='string')return;
  const allowed=['https://californiazesbi.org/','https://www.energy.ca.gov/',
   'https://www.cde.ca.gov/','https://procurement.ucop.edu/',
   'https://www.calstate.edu/'];
  if(!allowed.some(prefix=>url.startsWith(prefix)))return;
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
  a.textContent=label;parent.append(a);
 }
 const clean=x=>{x.replaceChildren()};
 function renderGraph(){
  const holder=$('fi-fleet-graph');
  if(!holder||!data)return;
  holder.replaceChildren();
  const selected=(data.prospects||[]).slice(0,9);
  const max=Math.max(1,...selected.map(x=>Number(x.listed_buses)||0));
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs={},value)=>{
   const n=document.createElementNS(ns,tag);
   for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
   if(value!==undefined)n.textContent=String(value);return n
  };
  const height=selected.length*38+45;
  const svg=make('svg',{viewBox:'0 0 760 '+height,role:'img',
   'aria-label':'Historical ZESBI funding reservation list bus quantities; not current purchase orders',
   style:'width:100%;max-width:760px;display:block;background:#112538;border-radius:7px'});
  selected.forEach((p,i)=>{
   const y=i*38+12;
   const label=String(p.name).slice(0,32);
   svg.append(make('text',{x:7,y:y+13,fill:'#c5deeb','font-size':11},label));
   const width=Math.max(1,360*Number(p.listed_buses)/max);
   svg.append(make('rect',{x:300,y,width,height:17,rx:3,fill:'#76c9bc'}));
   svg.append(make('text',{x:308+width,y:y+13,fill:'#e4f0f8','font-size':12},p.listed_buses+' buses'));
  });
  svg.append(make('text',{x:8,y:height-11,fill:'#bdd0df','font-size':11},
   'Published September 2026 application quantities · Not a current RFP'));
  holder.append(svg);
 }
 function render(){
  if(!data)return;clean(queue);
  const raw=filter.value.trim().toLowerCase();
  const matches=(data.prospects||[]).filter(p=>
   !raw||String(p.name+' '+p.city).toLowerCase().includes(raw)).slice(0,35);
  if(!matches.length){para(queue,'Filter','No matching published LEA');return}
  for(const p of matches){
   const div=document.createElement('div');div.className='item';
   const h=document.createElement('h3');h.textContent=p.name;div.append(h);
   para(div,'City',p.city);
   para(div,'Historical reserved list','Buses: '+p.listed_buses+
    ' · Chargers: '+p.listed_chargers+' · Application rows: '+p.application_rows);
   para(div,'Research priority',p.research_priority_points+'/85 points — NOT sales probability');
   para(div,'Source','September 9, 2026 funding reservation list, page(s) '+p.pdf_pages.join(', '));
   para(div,'Confirmed current buyer RFP','None verified');
   para(div,'Next step','Verify actual district procurement notice, fleet ownership and vendor eligibility');
   safeLink(div,'Open original funding list',p.source_pdf);
   queue.append(div)
  }
 }
 (async()=>{
  try{
   const r=await fetch('/api/operator/fleet/status',{method:'GET',cache:'no-store',
    credentials:'same-origin'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const x=await r.json();
   if(x.version!=='fial5.9-fleet-opportunity-evidence-v1')throw Error('WRONG_FLEET_VERSION');
   data=x;clean(summary);clean(sources);clean(signal);
   para(summary,'Status',x.state);
   para(summary,'Most recent cycle',x.last_cycle_utc||'not yet refreshed');
   para(summary,'Listed LEAs',(x.counts||{}).named_prospects||0);
   para(summary,'Historical listed application rows',(x.counts||{}).listed_application_rows||0);
   para(summary,'Source holds',(x.counts||{}).held||0);
   para(summary,'Verified open RFPs',0);
   para(summary,'Confirmed contracts',0);
   para(summary,'Verified revenue','$0');
   para(signal,'ZESBI second solicitation','At least $55M announced · first-come, first-served');
   para(signal,'Opening schedule','November 17, 2026 at 10 AM Pacific — source status must be reverified');
   para(signal,'Potential work categories','Qualified zero-emission bus repairs, charger repairs, training, technical assistance, shop equipment, yard improvements');
   para(signal,'Contract caution','Potential vendor role only; no verified ELEKTRON eligibility or direct revenue');
   safeLink(signal,'CEC official second solicitation',(x.program||{}).status_source);
   for(const p of x.procurement_watch||[]){
    const div=document.createElement('p');
    div.textContent=p.name+' — official portal watched; zero confirmed active fleet bids. ';
    safeLink(div,'Official procurement resource',p.source);signal.append(div);
   }
   for(const s of x.sources||[]){
    const div=document.createElement('p');
    div.textContent=s.id+' · '+s.state+' · '+s.change_state+
     (s.reason?' · '+s.reason:'')+
     (s.sha256?' · hash '+s.sha256.slice(0,16):'');
    sources.append(div)
   }
   renderGraph();render();filter.addEventListener('input',render);
  }catch(e){summary.textContent='FLEET_INTELLIGENCE_HOLD: '+String(e.message||e).slice(0,140)}
 })();
})();
