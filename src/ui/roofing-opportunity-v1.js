// Roofing Opportunity V1. All source updates and imports require operator clicks.
// No automatic outreach, owner data enrichment, inference of roof condition, or HTML injection.
(()=>{'use strict';
const el=id=>document.getElementById(id);
const LIMIT=1000,MAX_SIZE=700000;
let busy=false,latestStatus=null;
function node(tag,text,cls){const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x}
function replaceText(id,text){const x=el(id);if(x)x.textContent=String(text)}
const stamp=x=>x?new Date(x).toLocaleString():'Not yet updated';
async function jsonGet(path){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(path,{method:'GET',credentials:'same-origin',cache:'no-store',
   headers:{accept:'application/json'},signal:ctrl.signal});
  const data=await r.json();
  if(!r.ok)throw Error(String(data.error||'HTTP '+r.status).slice(0,180));
  return data;
 }finally{clearTimeout(timer)}
}
async function action(name,payload={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),40000);
 try{
  const r=await fetch('/api/fun/roofing/'+name,{method:'POST',
   credentials:'same-origin',cache:'no-store',
   headers:{'content-type':'application/json','x-fi-roofing-click':'operator-'+name},
   body:JSON.stringify(payload),signal:ctrl.signal});
  let data;try{data=await r.json()}catch{throw Error('Malformed local API response')}
  if(!r.ok)throw Error(String(data.error||'HTTP '+r.status).slice(0,210));
  return data;
 }finally{clearTimeout(timer)}
}
async function withBusy(button,fn,target='roof-import-status'){
 if(busy)return;
 busy=true;
 const buttons=document.querySelectorAll('button');for(const b of buttons)b.disabled=true;
 const old=button.textContent;button.textContent='Working…';
 try{const s=await fn();replaceText(target,s||'Completed')}catch(e){replaceText(target,'Not completed: '+String(e.message||e).slice(0,210))}
 finally{for(const b of buttons)b.disabled=false;button.textContent=old;busy=false}
}
async function status(){
 const data=await jsonGet('/api/fun/roofing/status');
 latestStatus=data;
 replaceText('roof-property-count',Number(data.propertyCount||0).toLocaleString());
 replaceText('roof-permits',Number(data.roofPermitRecords||0).toLocaleString());
 replaceText('roof-leads',Number(data.leadSummary?.candidateCount||0).toLocaleString());
 replaceText('roof-updated',data.updated?new Date(data.updated).toLocaleDateString():'Not yet');
 const list=el('roof-source-list');list.replaceChildren();
 for(const src of data.sourceDirectory||[]){
  const card=node('article',undefined,'source');
  card.append(node('strong',src.name));
  card.append(node('span',src.status.replace(/_/g,' '),'status'));
  card.append(node('small','Coverage: '+String(src.coverage)));
  if(src.run){
   card.append(node('small','Last local refresh: '+stamp(src.run.last)));
   card.append(node('small','Ingested: '+(src.run.recordsImported??'—')+' · '+(src.run.completeness||'coverage unverified')));
  }
  if(src.url&&/^https:\/\//.test(src.url)){
   const link=node('a','Official source ↗');link.href=src.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
  }
  list.append(card);
 }
 const weather=el('roof-weather-list');weather.replaceChildren();
 if(!(data.forecastAreas||[]).length){weather.append(node('p','No saved NWS forecasts. Refresh on demand.','help'))}
 for(const area of data.forecastAreas||[]){
  const card=node('article',undefined,'weather');
  card.append(node('strong',area.place+' · '+area.county));
  card.append(node('small','NWS updated: '+stamp(area.issued)));
  const periods=area.periods||[];
  const rain=periods.filter(p=>Number.isFinite(p.precipitationProbability)&&p.precipitationProbability>=20).slice(0,4);
  const summary=rain.length?rain.map(p=>p.name+': '+p.precipitationProbability+'% chance · '+p.summary).join(' | '):
    'No periods at or above 20% precipitation probability in the returned forecast (unknown values excluded).';
  card.append(node('p',summary));weather.append(card);
 }
}
function params(){
 const p=new URLSearchParams();
 const county=el('roof-county').value;
 if(county!=='all')p.set('county',county);
 p.set('minAge',el('roof-age').value);
 p.set('category',el('roof-category').value);
 const city=el('roof-city').value.trim();
 if(city)p.set('city',city);
 return p;
}
async function leads(){
 const p=params();
 const d=await jsonGet('/api/fun/roofing/leads?'+p.toString());
 const table=el('roof-lead-table');table.replaceChildren();
 replaceText('roof-lead-status',
   d.total+' eligible property records in the imported inventory. '+(d.limited?'Showing first 300.':'Showing all.')+
   ' These are review candidates, not confirmed roof repairs.');
 if(!d.rows?.length){
  const tr=node('tr'),td=node('td',latestStatus?.propertyCount?
   'No records match these filters. Adjust age, county, or category.':
   'No property inventory imported. Use the property CSV form below to create a review pool.');
  td.colSpan=6;tr.append(td);table.append(tr);return;
 }
 for(const row of d.rows){
  const tr=node('tr');
  const values=[row.city+', '+row.county,row.address+(row.zip?' · '+row.zip:''),
   row.yearBuilt,row.lastRecordedPermit||'None in ingested records',
   String(row.category||'').replace(/_/g,' '),row.reviewPriority];
  for(const value of values)tr.append(node('td',value));
  tr.title=row.evidenceStatus||'Record completeness not established';
  table.append(tr);
 }
}
async function reload(){await Promise.all([status(),leads()])}
function parseCSV(text){
 const rows=[];let fields=[],field='',quote=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quote){
   if(ch==='"'&&text[i+1]==='"'){field+='"';i++}
   else if(ch==='"')quote=false;
   else field+=ch;
  }else{
   if(ch==='"'){if(field.length)throw Error('Invalid CSV quote placement');quote=true}
   else if(ch===','){fields.push(field);field=''}
   else if(ch==='\n'||ch==='\r'){
    if(ch==='\r'&&text[i+1]==='\n')i++;
    fields.push(field);field='';
    if(fields.some(x=>x.trim()))rows.push(fields);
    fields=[];
   }else field+=ch;
  }
  if(rows.length>LIMIT+1)throw Error('Maximum '+LIMIT+' data rows per import');
 }
 if(quote)throw Error('CSV has unclosed quotation marks');
 fields.push(field);if(fields.some(x=>x.trim()))rows.push(fields);
 if(rows.length<2)throw Error('CSV needs a header and at least one row');
 const names=rows[0].map(v=>v.trim().replace(/^\uFEFF/,'').toLowerCase().replace(/[\s-]+/g,'_'));
 if(new Set(names).size!==names.length)throw Error('Duplicate CSV headings');
 const allowed=new Set(['county','city','address','year_built','zip','property_type','issue_date','work_description','permit_id','description']);
 const select=names.map((v,i)=>allowed.has(v)?[v,i]:null).filter(Boolean);
 if(!select.length)throw Error('No supported data columns found');
 const data=rows.slice(1).map((row,i)=>{
  if(row.length!==names.length)throw Error('Column count mismatch at row '+(i+2));
  return Object.fromEntries(select.map(([name,j])=>[name,row[j].trim()]));
 });
 return data;
}
async function importCsv(kind,id){
 const input=el(id),file=input.files?.[0];
 if(!file)throw Error('Select a CSV file first');
 if(file.size>MAX_SIZE)throw Error('CSV file exceeds 700 KB; split into batches');
 const rows=parseCSV(await file.text());
 if(rows.length>LIMIT)throw Error('Only '+LIMIT+' data rows per import');
 const req={kind,sourceId:'operator_csv_'+kind,rows,
  explicitlyRoofPermits:kind==='roof_permits'&&el('roof-explicit-permits').checked};
 const result=await action('import',req);input.value='';
 await reload();
 return 'Accepted '+result.accepted+' '+kind.replace('_',' ')+' records · '+result.totalStored+' now stored · source completeness unverified.';
}
el('roof-filter').addEventListener('click',()=>withBusy(el('roof-filter'),async()=>{await leads();return 'Filters applied.'},'roof-lead-status'));
el('roof-la-refresh').addEventListener('click',()=>withBusy(el('roof-la-refresh'),async()=>{
 const result=await action('refresh-la');await reload();
 return 'LA City sampled '+result.samples.reduce((a,s)=>a+s.raw,0)+' official permit records. Not a complete survey of either county.';
}));
el('roof-weather-refresh').addEventListener('click',()=>withBusy(el('roof-weather-refresh'),async()=>{
 const result=await action('refresh-weather');await status();
 return 'NWS forecasts refreshed for '+result.forecastAreas+' representative cities; verify weather before scheduling inspections.';
},'roof-weather-status'));
el('roof-property-upload').addEventListener('click',()=>withBusy(el('roof-property-upload'),()=>importCsv('properties','roof-property-file')));
el('roof-permit-upload').addEventListener('click',()=>withBusy(el('roof-permit-upload'),()=>importCsv('roof_permits','roof-permit-file')));
reload().catch(e=>replaceText('roof-lead-status','Local data unavailable: '+String(e.message).slice(0,120)));
})();