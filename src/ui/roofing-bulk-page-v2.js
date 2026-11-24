// Full export research UI. Only explicit clicks trigger official downloads.
(()=>{'use strict';
const $=id=>document.getElementById(id);
let busy=false,overview=null,opportunitiesReady=false,opportunityFiltersInitialized=false;
function node(tag,value,cls){const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;return e}
function display(id,v){const e=$(id);if(e)e.textContent=String(v)}
function count(n){return Number.isSafeInteger(n)?n.toLocaleString():'—'}
async function request(path,init={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),path.startsWith('/api/fun/roofing/bulk/recalculate')?135000:
   path.startsWith('/api/fun/roofing/bulk/formulas')?95000:22000);
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
   c.unique_street_blocks_with_two_or_more_age_matched_recent_peer_permits??'Unverified',
   c.peer_activity_relative_to_zip_reference_ratio==null?'Insufficient evidence':
    c.peer_activity_relative_to_zip_reference_ratio+'×'];
  const row=node('tr');for(const value of cells)row.append(node('td',value));body.append(row);
 }
 if(!body.childElementCount){const row=node('tr'),cell=node('td','No verified matches');cell.colSpan=12;row.append(cell);body.append(row)}
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
 const blockBody=$('unique-block-body');blockBody.replaceChildren();
 for(const z of result.parameters?.zips||[]){
  for(const block of (result.distinct_block_research_examples?.[z]||[]).slice(0,5)){
   const row=node('tr');
   for(const value of [block.zip,block.street_number_block,
       block.distinct_selected_old_parcels_in_block,
       block.distinct_recent_exact_apn_permit_parcels_in_block,
       block.subjects_with_two_or_more_recent_peer_permits,
       block.construction_year_min+'–'+block.construction_year_max]){
    row.append(node('td',value));
   }
   blockBody.append(row);
  }
 }
 if(!blockBody.childElementCount){const row=node('tr'),cell=node('td','No distinct qualifying blocks for the chosen filters');cell.colSpan=6;row.append(cell);blockBody.append(row)}
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
function fillOpportunityTable(id,rows,fields,empty){
 const body=$(id);body.replaceChildren();
 if(!Array.isArray(rows)||!rows.length){
  const tr=node('tr'),td=node('td',empty);td.colSpan=fields.length;tr.append(td);body.append(tr);return;
 }
 for(const item of rows){
  const tr=node('tr');
  for(const key of fields)tr.append(node('td',item[key]??'—'));
  body.append(tr);
 }
}
const roofGeo={zip:'',pathway:'',offset:0,total:0,
 block:null,propertyOffset:0,propertyTotal:0,ready:false,initialized:false};
const SVG_NS='http://www.w3.org/2000/svg';
function roofSvg(tag,attrs={},label=null){
 const el=document.createElementNS(SVG_NS,tag);
 for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
 if(label!==null)el.textContent=String(label);
 return el;
}
function renderRoofZipReferences(points,unmapped=[]){
 const svg=$('roof-geo-svg');svg.replaceChildren();
 svg.append(roofSvg('rect',{x:0,y:0,width:700,height:390,rx:15,fill:'#0c1e2e'}));
 for(let i=0;i<=7;i++){
  const x=55+i*84;
  svg.append(roofSvg('line',{x1:x,y1:30,x2:x,y2:360,stroke:'#254053','stroke-width':1}));
 }
 for(let i=0;i<=5;i++){
  const y=40+i*62;
  svg.append(roofSvg('line',{x1:35,y1:y,x2:660,y2:y,stroke:'#254053','stroke-width':1}));
 }
 svg.append(roofSvg('text',{x:36,y:25,fill:'#9cbbcc','font-size':12},'NORTH ↑  ·  ZIP reference positions'));
 svg.append(roofSvg('text',{x:35,y:380,fill:'#7c9aaa','font-size':11},'WEST'));
 svg.append(roofSvg('text',{x:630,y:380,fill:'#7c9aaa','font-size':11},'EAST'));
 for(const p of points||[]){
  if(!Number.isFinite(p.lon)||!Number.isFinite(p.lat))continue;
  // Fixed LA postal-reference frame: no block, parcel or roof coordinates.
  const x=35+((p.lon+118.57)/0.37)*610;
  const y=40+((34.10-p.lat)/0.40)*312;
  if(x<30||x>665||y<30||y>360)continue;
  const g=roofSvg('g',{role:'button',tabindex:0,
   'aria-label':'Select ZIP '+p.zip+' (postal reference only)'});
  const selected=p.zip===roofGeo.zip;
  g.append(roofSvg('circle',{cx:x,cy:y,r:selected?20:16,
   fill:selected?'#44bfb0':'#276b7e',stroke:'#d9eff3','stroke-width':1.8}));
  g.append(roofSvg('text',{x,y:y+4,'text-anchor':'middle',
   fill:'#fff','font-size':10,'font-weight':'bold'},String(p.qualified_properties)));
  const shift=p.zip==='90037'?-50:0;
  g.append(roofSvg('text',{x:x+shift,y:y-24,'text-anchor':'middle',
   'font-size':14,'font-weight':'bold',fill:'#eef9fd'},p.zip));
  g.addEventListener('click',()=>selectRoofGeoZip(p.zip));
  g.addEventListener('keydown',ev=>{
   if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();selectRoofGeoZip(p.zip);}
  });
  svg.append(g);
 }
 display('roof-geo-caption','Postal ZIP reference locations only — '+(points||[]).length+
  ' ZIP dots with qualifying property counts. GeoNames US postal codes, CC BY 4.0. '+
  (unmapped.length?'No coordinates available for '+unmapped.join(', ')+'. ':'')+
  'Exact street and parcel coordinates are not provided.');
}
function selectRoofGeoZip(zip){
 roofGeo.zip=zip;roofGeo.offset=0;resetRoofPropertyView();
 $('roof-geo-zip').value=zip;
 loadRoofGeoBlocks().catch(e=>display('roof-geo-state','Location lookup unavailable: '+String(e.message||e).slice(0,160)));
}
function resetRoofPropertyView(){
 roofGeo.block=null;roofGeo.propertyOffset=0;roofGeo.propertyTotal=0;
 $('roof-geo-properties').replaceChildren();
 const tr=node('tr'),td=node('td','Select a street block to inspect recorded research locations.');
 td.colSpan=7;tr.append(td);$('roof-geo-properties').append(tr);
 $('roof-geo-property-prev').disabled=true;$('roof-geo-property-next').disabled=true;
 display('roof-geo-property-page','No block selected');
 display('roof-geo-block-selection','Select any block below. Map dots are ZIP references, not property pins.');
}
async function loadRoofGeoBlocks(){
 if(!opportunitiesReady){
  display('roof-geo-state','Local V9 research report is not ready.');return;
 }
 display('roof-geo-state','Reading local street block inventory (no network or model)…');
 const query=new URLSearchParams({mode:'blocks',offset:String(roofGeo.offset),limit:'25'});
 if(roofGeo.zip)query.set('zip',roofGeo.zip);
 if(roofGeo.pathway)query.set('pathway',roofGeo.pathway);
 const result=await request('/api/fun/roofing/bulk/geo?'+query);
 if(result.state!=='ZIP_STREET_RESEARCH_READY')throw Error('Geographic report not ready');
 roofGeo.total=result.total;roofGeo.ready=true;
 if(!roofGeo.initialized){
  const zipSelect=$('roof-geo-zip');
  for(const item of result.zip_reference_points||[]){
   if(![...zipSelect.options].some(x=>x.value===item.zip)){
    const option=document.createElement('option');option.value=item.zip;
    option.textContent=item.zip+' · '+count(item.qualified_properties)+' properties';
    zipSelect.append(option);
   }
  }
  for(const zip of result.unmapped_zips||[]){
   if(![...zipSelect.options].some(x=>x.value===zip)){
    const option=document.createElement('option');option.value=zip;
    option.textContent=zip+' · no reference point';zipSelect.append(option);
   }
  }
  roofGeo.initialized=true;
 }
 renderRoofZipReferences(result.zip_reference_points,result.unmapped_zips);
 const tbody=$('roof-geo-blocks');tbody.replaceChildren();
 for(const b of result.rows||[]){
  const tr=node('tr');
  for(const value of [b.zip,b.street_number_block,b.qualified_in_view,b.historical,
    b.no_match,b.recent_permit_parcels])tr.append(node('td',value));
  const action=node('td');const btn=node('button','Inspect properties','btn secondary');
  btn.type='button';btn.addEventListener('click',()=>{
   roofGeo.block={zip:b.zip,name:b.street_number_block};roofGeo.propertyOffset=0;
   loadRoofGeoProperties().catch(e=>display('roof-geo-block-selection','Property lookup unavailable: '+String(e.message||e).slice(0,160)));
  });action.append(btn);tr.append(action);tbody.append(tr);
 }
 if(!tbody.childElementCount){
  const tr=node('tr'),cell=node('td','No street blocks matched this ZIP and pathway.');
  cell.colSpan=7;tr.append(cell);tbody.append(tr);
 }
 $('roof-geo-prev').disabled=roofGeo.offset<=0;
 $('roof-geo-next').disabled=!result.has_more;
 display('roof-geo-page',result.total?String(roofGeo.offset+1)+'–'+
   String(Math.min(roofGeo.offset+25,result.total))+' of '+count(result.total)+' blocks':'0 blocks');
 display('roof-geo-state','Showing '+count(result.total)+' qualifying street blocks '+
  (roofGeo.zip?'in ZIP '+roofGeo.zip:'across report ZIPs')+
  (roofGeo.pathway?' · '+roofGeo.pathway:' · all pathways')+
  '. Select a row to see local recorded property addresses.');
}
async function loadRoofGeoProperties(){
 if(!roofGeo.block)return;
 const selected=roofGeo.block;
 display('roof-geo-block-selection','Reading '+selected.name+' · '+selected.zip+'…');
 const query=new URLSearchParams({mode:'properties',zip:selected.zip,block:selected.name,
  offset:String(roofGeo.propertyOffset),limit:'25'});
 if(roofGeo.pathway)query.set('pathway',roofGeo.pathway);
 const result=await request('/api/fun/roofing/bulk/geo?'+query);
 if(result.state!=='ZIP_STREET_RESEARCH_READY')throw Error('Property report unavailable');
 roofGeo.propertyTotal=result.total;
 const tbody=$('roof-geo-properties');tbody.replaceChildren();
 for(const p of result.rows||[]){
  const row=node('tr');
  for(const value of [p.address,p.construction_year,p.existing_formula_a_priority,
    p.last_recorded_exact_parcel_roof_permit||'No matching permit',
    p.recent_age_matched_peer_permit_parcels,p.pathway])row.append(node('td',value));
  const cell=node('td');const link=node('a','Search address ↗');
  // External map lookup occurs only after operator clicks a link.
  link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.address);
  link.target='_blank';link.rel='noopener noreferrer';
  cell.append(link);row.append(cell);tbody.append(row);
 }
 if(!tbody.childElementCount){
  const tr=node('tr'),td=node('td','No property records match this pathway and block.');
  td.colSpan=7;tr.append(td);tbody.append(tr);
 }
 display('roof-geo-block-selection',selected.name+' · '+selected.zip+
   ' · '+count(result.total)+' recorded property research candidates'+
   (roofGeo.pathway?' · '+roofGeo.pathway:''));
 $('roof-geo-property-prev').disabled=roofGeo.propertyOffset===0;
 $('roof-geo-property-next').disabled=!result.has_more;
 display('roof-geo-property-page',result.total?
  String(roofGeo.propertyOffset+1)+'–'+String(Math.min(roofGeo.propertyOffset+25,result.total))+
   ' of '+count(result.total)+' properties':'0 properties');
}
async function loadOpportunities(){
 display('roof-opportunity-status','Checking existing local V9 roofing reports (read-only)…');
 let d;
 try{d=await request('/api/fun/roofing/bulk/opportunities');}
 catch(error){
  opportunitiesReady=false;
  display('roof-opportunity-status','Local opportunity summary unavailable: '+String(error.message||error).slice(0,180));
  return;
 }
 const ready=d.state==='READY_FROM_RECONCILED_LOCAL_V9_REPORTS';
 opportunitiesReady=ready;
 for(const id of ['roof-opportunity-historical-button','roof-opportunity-no-match-button',
                   'roof-opportunity-other-button'])$(id).disabled=!ready;
 if(!ready){
  display('roof-opportunity-status',d.state==='AWAITING_LOCAL_V9_REPORTS'?
   'No completed local V9 report yet. Once available, this section will offer both pathways automatically.':
   'Latest V9 report set is incomplete; no stale reports have been substituted.');
  return;
 }
 const totals=d.totals||{};
 display('roof-opportunity-blocks',count(totals.qualified_street_blocks));
 display('roof-opportunity-properties',count(totals.qualified_properties));
 display('roof-opportunity-historical',count(totals.historical));
 display('roof-opportunity-no-match',count(totals.no_match));
 const f=d.filters||{};
 if(!opportunityFiltersInitialized){
  $('roof-refresh-zips').value=(d.zips||[]).map(row=>row.zip).join(',')||
   '90037,90049,90731,90011';
  for(const [id,value] of [
   ['roof-refresh-age',f.min_building_age],
   ['roof-refresh-years',f.historical_x_years],
   ['roof-refresh-recent',f.recent_years],
   ['roof-refresh-kind',f.permit_kind],
   ['roof-refresh-peer-years',f.age_cohort_tolerance],
   ['roof-refresh-min-peers',f.min_similar_age_neighbors]]){
   if(value!==undefined&&value!==null)$(id).value=String(value);
  }
  opportunityFiltersInitialized=true;
 }
 display('roof-opportunity-filters','Report '+(d.report_snapshot||'unknown')+
  ' · building age ≥ '+f.min_building_age+' years · historical permit ≥ '+
  f.historical_x_years+' years · recent window '+f.recent_years+' years · '+
  (f.permit_kind||'unknown')+' · same-street construction cohort ± '+
  f.age_cohort_tolerance+' years · at least '+f.min_similar_age_neighbors+' comparable neighbors');
 display('roof-opportunity-status',
  (d.local_import_db_newer_than_report?'Cached report may be outdated after a recent source import. Regenerate V9 to update; ':'Ready: ')+
  count(totals.qualified_properties)+' research properties across '+
  count(totals.qualified_street_blocks)+
  ' qualifying street blocks. Automatically loaded from existing local V9 files (not recomputed).');
 fillOpportunityTable('roof-opportunity-block-body',d.top_street_blocks,
  ['zip','street_number_block','qualified_properties','recent_permit_parcels',
   'historical_permit_properties','no_matching_permit_properties'],
   'No qualifying street-block evidence.');
 await loadOpportunityPathway('HISTORICAL');
 await loadRoofGeoBlocks().catch(error=>
  display('roof-geo-state','Location explorer unavailable: '+String(error.message||error).slice(0,160)));
}
function roofRefreshFilters(){
 const zips=$('roof-refresh-zips').value.trim();
 const years=Number($('roof-refresh-years').value);
 const recentYears=Number($('roof-refresh-recent').value);
 const minBuildingAge=Number($('roof-refresh-age').value);
 const permitKind=$('roof-refresh-kind').value;
 const peerYears=Number($('roof-refresh-peer-years').value);
 const minPeers=Number($('roof-refresh-min-peers').value);
 if(!/^\d{5}(,\d{5}){0,9}$/.test(zips)||
    new Set(zips.split(',')).size!==zips.split(',').length||
    !Number.isSafeInteger(years)||years<10||years>50||
    !Number.isSafeInteger(recentYears)||recentYears<1||recentYears>10||recentYears>=years||
    !Number.isSafeInteger(minBuildingAge)||minBuildingAge<20||minBuildingAge>100||
    !Number.isSafeInteger(peerYears)||peerYears<0||peerYears>15||
    !Number.isSafeInteger(minPeers)||minPeers<3||minPeers>30||
    !['roof_related','replacement_like'].includes(permitKind))
   throw Error('Check ZIPs (1–10 unique), building age (20–100), historical years (10–50), recent years (1–10, below historical years), and neighborhood settings.');
 return {zips,years,recentYears,minBuildingAge,permitKind,peerYears,minPeers};
}
async function recalculateRoofingOpportunities(){
 try{
  const selected=roofRefreshFilters();
  display('roof-opportunity-recalculate-status','Recalculating only the selected public-record roofing research. Existing formulas and database remain unchanged…');
  const res=await request('/api/fun/roofing/bulk/recalculate',{
   method:'POST',headers:{'content-type':'application/json',
     'x-fi-roofing-bulk-click':'operator-recalculate-location-v11'},
   body:JSON.stringify(selected)
  });
  if(res.state!=='OPERATOR_CLICK_LOCAL_V9_REPORT_REFRESHED')
   throw Error('Unexpected recalculation result');
  await loadOpportunities();
  display('roof-opportunity-recalculate-status',
   'Updated local research: '+count(res.totals?.qualified_street_blocks)+
   ' street blocks, '+count(res.totals?.qualified_properties)+
   ' qualifying property observations · new snapshot '+(res.report_snapshot||'unknown')+
   '. These are research locations, not confirmed roof conditions.');
 }catch(error){
  display('roof-opportunity-recalculate-status',
   'Recalculation not completed: '+String(error.message||error).slice(0,210)+
   '. Existing local reports remain available.');
 }
}
async function loadOpportunityPathway(pathway){
 if(!['HISTORICAL','NO_MATCH','OTHER'].includes(pathway))return;
 display('roof-opportunity-pathway-title',pathway==='HISTORICAL'?
   '— older recorded permit':pathway==='NO_MATCH'?
   '— no matching permit':'— intermediate or recent recorded permit');
 const res=await request('/api/fun/roofing/bulk/opportunities?pathway='+encodeURIComponent(pathway));
 if(res.state!=='READY_FROM_RECONCILED_LOCAL_V9_REPORTS')
  throw Error('LOCAL_OPPORTUNITY_REPORT_NOT_READY');
 const rows=(res.property_examples||[]).map(row=>({
  zip:row.zip,address:row.address,year_built:row.year_built,
  formula_a_existing_priority:row.formula_a_existing_priority,
  last_exact_apn_permit:row.last_exact_apn_permit||'No exact match in chosen records',
  recent_peer_permit_parcels:row.recent_peer_permit_parcels
 }));
 fillOpportunityTable('roof-opportunity-property-body',rows,
  ['zip','address','year_built','formula_a_existing_priority',
   'last_exact_apn_permit','recent_peer_permit_parcels'],
  'No research properties matched this pathway.');
}
async function execute(button,callback){
 if(busy)return;busy=true;const all=[...document.querySelectorAll('button')];
 for(const b of all)b.disabled=true;
 const previous=button?.textContent;if(button)button.textContent='Working…';
 try{await callback()}catch(e){display('job-status','Action not completed: '+String(e.message||e).slice(0,230))}
 finally{busy=false;for(const b of all)b.disabled=false;if(button)button.textContent=previous;
  if(!opportunitiesReady)for(const id of [
   'roof-opportunity-historical-button','roof-opportunity-no-match-button',
   'roof-opportunity-other-button'])$(id).disabled=true;
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
$('roof-opportunity-refresh').addEventListener('click',e=>execute(e.currentTarget,loadOpportunities));
$('roof-opportunity-recalculate-button').addEventListener('click',e=>execute(e.currentTarget,recalculateRoofingOpportunities));
$('roof-geo-filter').addEventListener('click',e=>execute(e.currentTarget,async()=>{
 roofGeo.zip=$('roof-geo-zip').value;roofGeo.pathway=$('roof-geo-pathway').value;
 roofGeo.offset=0;resetRoofPropertyView();await loadRoofGeoBlocks();
}));
$('roof-geo-clear').addEventListener('click',e=>execute(e.currentTarget,async()=>{
 roofGeo.zip='';roofGeo.pathway='';roofGeo.offset=0;
 $('roof-geo-zip').value='';$('roof-geo-pathway').value='';
 resetRoofPropertyView();await loadRoofGeoBlocks();
}));
$('roof-geo-prev').addEventListener('click',e=>execute(e.currentTarget,async()=>{
 roofGeo.offset=Math.max(0,roofGeo.offset-25);resetRoofPropertyView();await loadRoofGeoBlocks();
}));
$('roof-geo-next').addEventListener('click',e=>execute(e.currentTarget,async()=>{
 if(roofGeo.offset+25<roofGeo.total)roofGeo.offset+=25;
 resetRoofPropertyView();await loadRoofGeoBlocks();
}));
$('roof-geo-property-prev').addEventListener('click',e=>execute(e.currentTarget,async()=>{
 roofGeo.propertyOffset=Math.max(0,roofGeo.propertyOffset-25);await loadRoofGeoProperties();
}));
$('roof-geo-property-next').addEventListener('click',e=>execute(e.currentTarget,async()=>{
 if(roofGeo.propertyOffset+25<roofGeo.propertyTotal)roofGeo.propertyOffset+=25;
 await loadRoofGeoProperties();
}));
$('roof-opportunity-historical-button').addEventListener('click',e=>execute(e.currentTarget,()=>loadOpportunityPathway('HISTORICAL')));
$('roof-opportunity-no-match-button').addEventListener('click',e=>execute(e.currentTarget,()=>loadOpportunityPathway('NO_MATCH')));
$('roof-opportunity-other-button').addEventListener('click',e=>execute(e.currentTarget,()=>loadOpportunityPathway('OTHER')));
loadOpportunities().catch(error=>
 display('roof-opportunity-status','Local opportunity view unavailable: '+String(error.message||error).slice(0,180)));
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