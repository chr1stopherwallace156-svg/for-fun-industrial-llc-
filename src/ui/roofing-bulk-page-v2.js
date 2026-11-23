// Full export research UI. Only explicit clicks trigger official downloads.
(()=>{'use strict';
const $=id=>document.getElementById(id);
let busy=false,overview=null;
function node(tag,value,cls){const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;return e}
function display(id,v){const e=$(id);if(e)e.textContent=String(v)}
function count(n){return Number.isSafeInteger(n)?n.toLocaleString():'—'}
async function request(path,init={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),22000);
 try{const res=await fetch(path,{credentials:'same-origin',cache:'no-store',
   headers:{accept:'application/json',...init.headers},...init,signal:ctrl.signal});
  const d=await res.json();
  if(!res.ok)throw Error(d.error||'HTTP '+res.status);
  return d;
 }finally{clearTimeout(timer)}
}
async function showOverview(){
 const info=await request('/api/fun/roofing/bulk/status');
 overview=info;
 display('total-properties',count(info.counts?.properties));
 display('total-permits',count(info.counts?.permits));
 display('total-candidates',count(info.counts?.candidates));
 display('data-completeness','Not proven countywide');
 const job=info.job;
 display('job-status',job?
  'Full data sync '+job.state.replace(/_/g,' ')+' · '+job.source+
    (job.pid?' · worker PID '+job.pid:'')+
    (job.exitCode!==undefined?' · exit '+job.exitCode:'')+
    '. Refresh manually to update status.' :
  'No full source download requested in this process. Existing disk imports are shown per source.');
 const container=$('source-list');container.replaceChildren();
 for(const item of info.sourceDirectory||[]){
  const card=node('article',undefined,'source-card');
  card.append(node('h3',item.title));
  card.append(node('div',item.mode.replace(/_/g,' '),'state'));
  card.append(node('p',item.coverage));
  const record=(info.source_runs||[]).find(r=>r.source_id===item.id);
  if(record){
    card.append(node('small','Source: '+record.state));
    card.append(node('small','Rows ingested: '+count(record.ingested)+' · skipped: '+count(record.skipped)));
    card.append(node('small','Updated: '+(record.updated||'unknown')+' · coverage: '+record.coverage));
  }else card.append(node('small','Not yet ingested on this PC.'));
  if(item.source){
    const link=node('a','Official dataset ↗');
    link.href=item.source;link.target='_blank';link.rel='noopener noreferrer';
    card.append(link);
  }
  if(item.mode==='FULL_EXPORT_SYNC'){
    const button=node('button','Download and index complete official export','btn secondary');
    button.type='button';button.dataset.source=item.id;
    button.disabled=busy||job?.state==='RUNNING';
    button.addEventListener('click',()=>sync(item.id));
    card.append(button);
  }
  container.append(card);
 }
 if(info.error)display('job-status','Local bulk worker unavailable: '+info.error);
}
function filters(){
 const county=$('filter-county').value;
 const city=$('filter-city').value.trim();
 const age=$('filter-age').value;
 const params=new URLSearchParams({county,minAge:age});
 if(city)params.set('city',city);
 if($('filter-permit').value==='none')params.set('onlyNoPermit','true');
 params.set('includeUnclassified',String($('include-unclassified').checked));
 return params;
}
async function renderMarkets(detail=false){
 const p=filters(),kind=detail?'candidates':'markets',id=detail?'parcel-body':'market-body';
 display('market-note','Reading actual local SQLite records. Missing permits do not prove no roof replacement.');
 const d=await request('/api/fun/roofing/bulk/'+kind+'?'+p.toString());
 const body=$(id);body.replaceChildren();
 const items=Array.isArray(d.rows)?d.rows:[];
 if(!items.length){
  const tr=node('tr'),td=node('td','No matching indexed data yet. Run an official full-property import and rebuild the index.');
  td.colSpan=detail?7:6;tr.append(td);body.append(tr);
 }else for(const v of items){
  const row=node('tr');
  const cells=detail?
   [v.county,v.city+' '+(v.zip||''),v.apn,v.address||'Address not available',v.year_built??'Unknown',
    v.last_roof_permit||'No match in imported sources',v.status]:
   [v.county,v.city+' '+(v.zip||''),v.candidates,v.no_permit_observed,v.old_roof_permit,v.mean_review_priority];
  for(const cell of cells)row.append(node('td',cell??'—'));
  body.append(row);
 }
 display('market-note',items.length+' '+(detail?'property':'market')+
  ' rows shown. All ranks refer only to imported records, not confirmed roofing demand.');
}
async function execute(button,callback){
 if(busy)return;busy=true;const all=[...document.querySelectorAll('button')];
 for(const b of all)b.disabled=true;
 const previous=button?.textContent;if(button)button.textContent='Working…';
 try{await callback()}catch(e){display('job-status','Action not completed: '+String(e.message||e).slice(0,230))}
 finally{busy=false;for(const b of all)b.disabled=false;if(button)button.textContent=previous;
  if(overview?.job?.state==='RUNNING'){
   for(const b of document.querySelectorAll('button[data-source]'))b.disabled=true;
  }
 }
}
async function sync(source){
 const sourceInfo=overview?.sourceDirectory?.find(x=>x.id===source);
 if(!sourceInfo||sourceInfo.mode!=='FULL_EXPORT_SYNC')return;
 const ok=confirm('Download and ingest the COMPLETE published source: '+sourceInfo.title+
  '\\n\\nThis may consume several gigabytes of disk space. Data is public, but no roofing need or commercial eligibility is inferred. Proceed?');
 if(!ok)return;
 const btn=document.querySelector('button[data-source="'+source+'"]');
 await execute(btn,async()=>{
  const result=await request('/api/fun/roofing/bulk/sync',{method:'POST',
    headers:{'content-type':'application/json','x-fi-roofing-bulk-click':'operator-sync-full-export'},
    body:JSON.stringify({source})});
  display('job-status',result.state.replace(/_/g,' ')+' · '+source+
    '. Full import proceeds locally. Use Check import status to review results.');
  await showOverview();
 });
}
$('load-markets').addEventListener('click',e=>execute(e.currentTarget,()=>renderMarkets(false)));
$('load-parcels').addEventListener('click',e=>execute(e.currentTarget,()=>renderMarkets(true)));
$('refresh-sources').addEventListener('click',e=>execute(e.currentTarget,()=>showOverview()));
showOverview().then(()=>renderMarkets(false)).catch(e=>
 display('job-status','Local bulk evidence unavailable: '+String(e.message||e).slice(0,220)));
})();