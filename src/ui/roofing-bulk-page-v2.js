// Full export research UI. Only explicit clicks trigger official downloads.
(()=>{'use strict';
const $=id=>document.getElementById(id);
let busy=false,overview=null;
function node(tag,value,cls){const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;return e}
function display(id,v){const e=$(id);if(e)e.textContent=String(v)}
function count(n){return Number.isSafeInteger(n)?n.toLocaleString():'—'}
async function request(path,init={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),path.startsWith('/api/fun/roofing/bulk/formulas')?95000:22000);
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
 const selection=info.selection||{};
 display('selection-selected',count(selection.selected));
 display('selection-held',count(selection.held));
 display('selection-excluded',count(selection.excluded));
 display('selection-state',selection.state==='READY'?'Filtered locally':
   selection.state==='NO_DATABASE'?'Awaiting data':
   selection.state==='NOT_RUN'?'Awaiting first import':'Needs review');
 display('selection-receipt',selection.state==='READY'?
   'Last validated: '+(selection.updated_utc||'unknown')+
   ' · '+(selection.mode||'')+' · analyzed '+count(selection.source_rows_examined)+
   ' parcel records. Permit coverage not proven countywide.':
   'Selective index: '+String(selection.state||'not started')+
   (selection.error?' · '+selection.error:'')+'. Imported source files remain available for audit.');
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
  ' rows shown from the filtered local index. Actual roof condition and complete permit history remain unverified.');
}
async function renderParallelFormulas(){
 const zips=$('formula-zips').value.trim();
 const years=Number($('formula-years').value);
 const recentYears=Number($('formula-recent').value);
 const minBuildingAge=Number($('formula-age').value);
 const permitKind=$('formula-kind').value;
 const peerYears=Number($('formula-peer-years').value);
 const minPeers=Number($('formula-min-peers').value);
 if(!/^\d{5}(,\d{5}){0,9}$/.test(zips)||
    new Set(zips.split(',')).size!==zips.split(',').length||
    !Number.isInteger(years)||years<10||years>50||
    !Number.isInteger(recentYears)||recentYears<1||recentYears>10||recentYears>=years||
    !Number.isInteger(minBuildingAge)||minBuildingAge<20||minBuildingAge>100||
    !Number.isInteger(peerYears)||peerYears<0||peerYears>15||
    !Number.isInteger(minPeers)||minPeers<3||minPeers>30||
    !['roof_related','replacement_like'].includes(permitKind)){
   display('formula-note','Invalid filters. Use 1–10 distinct five-digit ZIP codes, a 10–50 year interval, a shorter recent window and permitted description types.');
   return;
 }
 display('formula-note','Calculating three separate methods from local assessor and roof-permit records…');
 const query=new URLSearchParams({zips,years:String(years),recentYears:String(recentYears),
   minBuildingAge:String(minBuildingAge),permitKind,peerYears:String(peerYears),
   minPeers:String(minPeers)});
 const result=await request('/api/fun/roofing/bulk/formulas?'+query.toString());
 const body=$('formula-body');body.replaceChildren();
 for(const market of result.markets||[]){
  const a=market.formula_a_existing,b=market.formula_b_permit_cycle,
   c=market.formula_c_neighborhood||{};
  const cells=[market.zip,a.selected_older_residential_properties,
   a.mean_review_priority??'Unavailable',b.exact_apn_match_properties,
   b.last_roof_permit_at_least_x_years_ago,b.recent_permit_properties,
   b.recent_repeat_with_gap_at_least_x_years,
   b.recent_roof_permit_activity_per_1000??'Not enough data',
   c.candidates_with_enough_age_similar_street_block_peers??'Unverified',
   c.candidates_with_two_or_more_recent_peer_roof_permits??'Unverified',
   c.peer_activity_relative_to_zip_reference_ratio==null?'Insufficient evidence':
    c.peer_activity_relative_to_zip_reference_ratio+'×'];
  const row=node('tr');for(const value of cells)row.append(node('td',value));body.append(row);
 }
 if(!body.childElementCount){const row=node('tr'),cell=node('td','No verified matches');cell.colSpan=11;row.append(cell);body.append(row)}
 const sampleBody=$('formula-samples');sampleBody.replaceChildren();
 for(const item of result.public_parcel_id_examples||[]){
  const row=node('tr');
  for(const value of [item.zip,item.apn,item.formula_a_existing_priority??'Unknown',item.last_roof_related_permit,
       item.years_since_last_recorded_permit,
       item.recent_long_gap_repeat_observed?'Yes — permit records only':'No']){
    row.append(node('td',value));
  }
  sampleBody.append(row);
 }
 if(!sampleBody.childElementCount){const tr=node('tr'),td=node('td','No older permit examples found in the selected markets');td.colSpan=6;tr.append(td);sampleBody.append(tr)}
 const neighborhoodBody=$('neighbor-example-body');neighborhoodBody.replaceChildren();
 for(const item of (result.neighborhood_research_examples||[]).slice(0,25)){
  const row=node('tr');
  for(const value of [item.zip,item.apn,item.construction_year,
     item.similar_age_same_street_block_neighbors,item.other_parcels_with_recent_roof_permits,
     String(item.neighbor_recorded_permit_share_pct)+'%',
     item.roof_condition_and_replacement_need]){
   row.append(node('td',value));
  }
  neighborhoodBody.append(row);
 }
 if(!neighborhoodBody.childElementCount){const row=node('tr'),
   cell=node('td','No cohorts met the minimum comparable-peer and recent-permit requirements.');
   cell.colSpan=7;row.append(cell);neighborhoodBody.append(row)}
 display('formula-note','Three separate methods calculated from four imported sources. '
  +'Formula A remains unchanged; B uses same-parcel intervals of '+years
  +' years; C compares same-street 100-number blocks with construction years within ±'
  +peerYears+' and at least '+minPeers+' peers. This is a proxy, not measured '
  +'physical distance or evidence of roof damage.');
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
$('run-dual-formulas').addEventListener('click',e=>execute(e.currentTarget,
 async()=>{try{await renderParallelFormulas()}catch(error){
   display('formula-note','Formula comparison held: '+String(error.message||error).slice(0,230));
 }}));
$('load-parcels').addEventListener('click',e=>execute(e.currentTarget,()=>renderMarkets(true)));
$('refresh-sources').addEventListener('click',e=>execute(e.currentTarget,()=>showOverview()));
showOverview().then(()=>renderMarkets(false)).catch(e=>
 display('job-status','Local bulk evidence unavailable: '+String(e.message||e).slice(0,220)));
})();