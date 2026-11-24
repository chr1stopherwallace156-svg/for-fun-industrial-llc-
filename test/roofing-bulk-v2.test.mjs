import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {ROOF_BULK_PAGE} from '../src/ui/roofing-bulk-page-v2.mjs';
import {BULK_VERSION,bulkCatalog,startBulkSync,bulkMarkets,
 validateRoofingRecalculation} from '../src/roofing/roofing-bulk-bridge-v2.mjs';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {DASHBOARD_HTML} from '../src/ui/oneport-dashboard-v1.mjs';
const css=new URL('../src/ui/roofing-bulk-page-v2.css',import.meta.url);
const client=new URL('../src/ui/roofing-bulk-page-v2.js',import.meta.url);

test('bulk system recognizes real full official exports without keys',()=>{
 const c=bulkCatalog();
 assert.equal(c.version,BULK_VERSION);
 assert.equal(c.sources.filter(s=>s.mode==='FULL_EXPORT_SYNC').length,5);
 assert.ok(c.sources.some(s=>s.id==='sb_assessor_characteristics'&&
   s.mode==='MANUAL_CSV_OR_FIXED_WIDTH_HOLD'));
 assert.equal(c.configuredSocrataToken,Boolean(process.env.SOCRATA_APP_TOKEN));
 assert.equal(c.modelExecutions,0);
 assert.equal(c.automatedOutreach,0);
 assert.equal(c.elektronTouched,false);
 assert.throws(()=>startBulkSync('arbitrary-url'),/NOT_AUTOMATABLE/);
});
test('bulk UI links only real local endpoints and has no automated actions',async()=>{
 const js=await readFile(client,'utf8'),style=await readFile(css,'utf8');
 assert.match(ROOF_BULK_PAGE,/Roofing Opportunity Intelligence/);
 assert.match(ROOF_BULK_PAGE,/id="market-body"/);
 assert.match(ROOF_BULK_PAGE,/id="source-list"/);
 assert.match(ROOF_BULK_PAGE,/No permit sample caps/);
 assert.match(js,/operator-sync-full-export/);
 assert.match(js,/confirm\(/);
 assert.match(js,/onlyNoPermit/);
 assert.doesNotMatch(js,/setInterval|localStorage|WebSocket|new WebSocket|eval\(/);
 assert.doesNotMatch(ROOF_BULK_PAGE,/<script(?![^>]*src)[^>]*>/i);
 assert.match(style,/@media\(max-width:750px\)/);
});
test('bulk UI is on separate route; original production homepage is preserved',async()=>{
 const server=createUnifiedMlHub({ml:{},commerce:{},
   grounded:{status:()=>({})},reviewedDispatch:{},reviewedCompute:{}});
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 function req(path,method='GET',body='',headers={}){
  return new Promise((resolve,reject)=>{
   const request=http.request({host:'127.0.0.1',port,path,method,
    headers:{host:'127.0.0.1:8802',...headers}},res=>{
    let content='';res.setEncoding('utf8');res.on('data',c=>content+=c);
    res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:content}));
   });
   request.on('error',reject);
   request.end(body);
  });
 }
 try{
  const home=await req('/');
  assert.equal(home.status,200);
  assert.equal(home.body,DASHBOARD_HTML);
  const ui=await req('/roofing/bulk/');
  assert.equal(ui.status,200);
  assert.equal(ui.headers['x-fi-roofing-version'],BULK_VERSION);
  const css=await req('/api/fun/roofing/bulk/style.css');
  assert.equal(css.status,200);
  const js=await req('/api/fun/roofing/bulk/client.js');
  assert.equal(js.status,200);
  const status=await req('/api/fun/roofing/bulk/status');
  assert.equal(status.status,200);
  assert.equal(JSON.parse(status.body).automatedOutreach,0);
  const unapproved=await req('/api/fun/roofing/bulk/sync','POST',
    '{"source":"la_permits_pre2010"}',{'content-type':'application/json'});
  assert.equal(unapproved.status,403);
  const unsupported=await req('/api/fun/roofing/bulk/sync','POST',
    '{"source":"sb_assessor_characteristics"}',{'content-type':'application/json',
    'origin':'http://127.0.0.1:8802',
    'x-fi-roofing-bulk-click':'operator-sync-full-export'});
  assert.equal(unsupported.status,422);
  const invalid=await req('/api/fun/roofing/bulk/markets?county=Other');
  assert.equal(invalid.status,422);
  const cycleBad=await req('/api/fun/roofing/bulk/formulas?years=5');
  assert.equal(cycleBad.status,422);
  const cycleUnknown=await req('/api/fun/roofing/bulk/formulas?random=1');
  assert.equal(cycleUnknown.status,422);
  const cycleDuplicateZip=await req('/api/fun/roofing/bulk/formulas?zips=90011,90011');
  assert.equal(cycleDuplicateZip.status,422);
  const badPeerYear=await req('/api/fun/roofing/bulk/formulas?peerYears=22');
  assert.equal(badPeerYear.status,422);
  const badPeerSample=await req('/api/fun/roofing/bulk/formulas?minPeers=2');
  assert.equal(badPeerSample.status,422);
  const badPeerUnknown=await req('/api/fun/roofing/bulk/formulas?neighborDistanceKm=2');
  assert.equal(badPeerUnknown.status,422);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('parallel rooftop formulas preserve existing V3 equation and use distinct read-only current-vs-historical permit model',async()=>{
 const clientSrc=await readFile(client,'utf8');
 const bridge=await readFile(new URL('../src/roofing/roofing-bulk-bridge-v2.mjs',import.meta.url),'utf8');
 const python=await readFile(new URL('../src/roofing/roofing_dual_formulas_v4.py',import.meta.url),'utf8');
 assert.match(ROOF_BULK_PAGE,/id="parallel-roof-formulas"/);
 assert.match(ROOF_BULK_PAGE,/S = clip/);
 assert.match(ROOF_BULK_PAGE,/Formula B — Observed permit cycle by ZIP/);
 for(const id of ['formula-zips','formula-years','formula-recent','formula-age',
                   'formula-peer-years','formula-min-peers',
                   'formula-kind','run-dual-formulas','formula-body','formula-samples']){
  assert.ok(ROOF_BULK_PAGE.includes('id="'+id+'"'),id);
 }
 assert.match(clientSrc,/renderParallelFormulas/);
 assert.match(clientSrc,/\/api\/fun\/roofing\/bulk\/formulas/);
 assert.match(bridge,/export async function bulkDualFormulas/);
 assert.match(python,/PRAGMA query_only=ON/);
 assert.match(python,/mode=ro/);
 assert.match(python,/last_roof_permit_at_least_x_years_ago/);
 assert.match(python,/recent_repeat_with_gap_at_least_x_years/);
 assert.match(python,/REPLACEMENT_LIKE/);
 assert.match(ROOF_BULK_PAGE,/Formula C — Similar-age neighbors/);
 assert.match(ROOF_BULK_PAGE,/id="neighbor-example-body"/);
 assert.match(ROOF_BULK_PAGE,/id="unique-block-body"/);
 assert.match(ROOF_BULK_PAGE,/C: unique qualifying street blocks/);
 assert.match(ROOF_BULK_PAGE,/C: 2\+ recent peer permits/);
 assert.match(clientSrc,/peerYears:String\(peerYears\)/);
 assert.match(clientSrc,/candidates_with_two_or_more_recent_peer_roof_permits/);
 assert.match(clientSrc,/neighborhood_research_examples/);
 assert.match(clientSrc,/distinct_block_research_examples/);
 assert.match(clientSrc,/unique_street_blocks_with_two_or_more_age_matched_recent_peer_permits/);
 assert.match(bridge,/--min-peers/);
 assert.match(python,/neighbor_context\(conn/);
 const street=await readFile(new URL('../src/roofing/roofing_neighbor_context_v5.py',import.meta.url),'utf8');
 assert.match(street,/PRAGMA query_only|same_100_number_street_block_and_build_year_cohort_proxy|JOIN permits/);
 assert.doesNotMatch(street,/requests\.|urllib\.|INSERT INTO|UPDATE properties|DELETE FROM/);
 assert.doesNotMatch(clientSrc,/setInterval|localStorage|WebSocket|eval\(/);
});

test('automatic roofing opportunity cards load on the separate page from read-only validated local reports',async()=>{
 const clientSource=await readFile(client,'utf8');
 const pySource=await readFile(new URL('../src/roofing/roofing_opportunities_v10.py',import.meta.url),'utf8');
 const bridge=await readFile(new URL('../src/roofing/roofing-bulk-bridge-v2.mjs',import.meta.url),'utf8');
 for(const id of ['roof-opportunities','roof-opportunity-block-body','roof-opportunity-property-body',
                  'roof-opportunity-historical-button','roof-opportunity-no-match-button',
                  'roof-opportunity-other-button','roof-opportunity-status']){
  assert.ok(ROOF_BULK_PAGE.includes('id="'+id+'"'),id);
 }
 assert.match(clientSource,/loadOpportunities\(\)\.catch/);
 assert.match(clientSource,/\/api\/fun\/roofing\/bulk\/opportunities/);
 assert.match(clientSource,/loadOpportunityPathway\('HISTORICAL'\)/);
 assert.doesNotMatch(clientSource,/setInterval|localStorage|WebSocket|eval\(/);
 assert.match(bridge,/export async function roofingOpportunities/);
 // V10 reads completed CSV snapshots only; SQLite PRAGMA belongs to V9.
 assert.match(pySource,/def read_offers\(/);
 assert.match(pySource,/research_exports/);
 assert.match(pySource,/csv\.DictReader/);
 assert.match(pySource,/LOCAL_V9_REPORT_INCOMPLETE_HOLD/);
 assert.match(pySource,/NO_MATCH/);
 // A read-only stat of roofing.sqlite3 is allowed for staleness detection.
 assert.doesNotMatch(pySource,/import sqlite3|sqlite3\.connect|PRAGMA|urllib|requests\.|INSERT INTO|DELETE FROM|UPDATE roofing|open\("w"/);
 const requested=[];
 const stub=async({pathway=null}={})=>{
  requested.push(pathway);
  return {version:'fun-roofing-opportunity-offers-v10',
          state:'READY_FROM_RECONCILED_LOCAL_V9_REPORTS',
          pathway,totals:{historical:338,no_match:2500,other:501},
          no_outreach_or_model_execution:true};
 };
 const server=createUnifiedMlHub({
  ml:{},commerce:{},grounded:{status:()=>({})},reviewedDispatch:{},reviewedCompute:{},
  roofingOpportunityReader:stub
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const call=(path,method='GET')=>new Promise((resolve,reject)=>{
  const request=http.request({host:'127.0.0.1',port,path,method,
    headers:{host:'127.0.0.1:8802'}},res=>{
      let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);
      res.on('end',()=>resolve({status:res.statusCode,body}));
  });
  request.on('error',reject);request.end();
 });
 try{
  const home=await call('/');
  assert.equal(home.body,DASHBOARD_HTML);
  const valid=await call('/api/fun/roofing/bulk/opportunities');
  assert.equal(valid.status,200);
  assert.equal(JSON.parse(valid.body).totals.historical,338);
  const hist=await call('/api/fun/roofing/bulk/opportunities?pathway=HISTORICAL');
  assert.equal(hist.status,200);
  assert.equal(JSON.parse(hist.body).pathway,'HISTORICAL');
  for(const path of [
   '/api/fun/roofing/bulk/opportunities?pathway=FORGED',
   '/api/fun/roofing/bulk/opportunities?random=1',
   '/api/fun/roofing/bulk/opportunities?pathway=HISTORICAL&pathway=NO_MATCH'
  ]){
   assert.equal((await call(path)).status,422,path);
  }
  assert.equal((await call('/api/fun/roofing/bulk/opportunities','POST')).status,404);
  assert.deepEqual(requested,[null,'HISTORICAL']);
 }finally{await new Promise(resolve=>server.close(resolve))}
});


test('V11 explicit-click roofing research refresh validates independent filters and never changes the original homepage',async()=>{
 const html=ROOF_BULK_PAGE;
 const clientSrc=await readFile(client,'utf8');
 const previewSrc=await readFile(new URL('../src/ui/organized-preview-v1.mjs',import.meta.url),'utf8');
 for(const id of ['roof-refresh-zips','roof-refresh-years','roof-refresh-age',
   'roof-refresh-recent','roof-refresh-kind','roof-refresh-peer-years',
   'roof-refresh-min-peers','roof-opportunity-recalculate-button']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/href="#roof-opportunities"/);
 assert.match(previewSrc,/href="\/roofing\/bulk\/#roof-opportunities"/);
 assert.match(clientSrc,/recalculateRoofingOpportunities/);
 assert.match(clientSrc,/operator-recalculate-location-v11/);
 assert.doesNotMatch(clientSrc,/setInterval|localStorage|WebSocket|eval\(/);
 const f={zips:'90037,90049,90731,90011',years:20,recentYears:5,
  minBuildingAge:25,permitKind:'replacement_like',peerYears:5,minPeers:5};
 assert.deepEqual(validateRoofingRecalculation(f),f);
 for(const bad of [{...f,years:5},{...f,zips:'90037,90037'},
  {...f,permitKind:'INVALID'}, {...f,unexpected:true}]){
  assert.throws(()=>validateRoofingRecalculation(bad),/ROOF_LOCATION_REFRESH_FILTER_/);
 }
 const calls=[];
 const server=createUnifiedMlHub({
  ml:{},commerce:{},grounded:{status:()=>({})},reviewedDispatch:{},reviewedCompute:{},
  roofingRecalculationRunner:async opts=>{
   calls.push(opts);
   return {version:'fun-roofing-local-refresh-v11',
    state:'OPERATOR_CLICK_LOCAL_V9_REPORT_REFRESHED',totals:{qualified_properties:3339},
    noAutomaticImportOrOutreach:true};
  }
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const sendReq=(path,body,headers={},method='POST')=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,path,method,
   headers:{host:'127.0.0.1:8802','content-type':'application/json',...headers}},
   res=>{let result='';res.setEncoding('utf8');res.on('data',x=>result+=x);
    res.on('end',()=>resolve({status:res.statusCode,body:result}));});
  req.on('error',reject);req.end(body);
 });
 const authorized={'origin':'http://127.0.0.1:8802',
  'x-fi-roofing-bulk-click':'operator-recalculate-location-v11'};
 try{
  assert.equal((await sendReq('/api/fun/roofing/bulk/recalculate',JSON.stringify(f))).status,403);
  assert.equal((await sendReq('/api/fun/roofing/bulk/recalculate',
   JSON.stringify(f),{'x-fi-roofing-bulk-click':'operator-recalculate-location-v11',
    origin:'https://untrusted.example'})).status,403);
  assert.equal((await sendReq('/api/fun/roofing/bulk/recalculate',
    JSON.stringify({...f,minBuildingAge:5}),authorized)).status,422);
  assert.equal((await sendReq('/api/fun/roofing/bulk/recalculate?extra=true',
    JSON.stringify(f),authorized)).status,422);
  const ok=await sendReq('/api/fun/roofing/bulk/recalculate',JSON.stringify(f),authorized);
  assert.equal(ok.status,200);
  assert.equal(JSON.parse(ok.body).state,'OPERATOR_CLICK_LOCAL_V9_REPORT_REFRESHED');
  assert.deepEqual(calls,[f]);
  assert.equal((await sendReq('/api/fun/roofing/bulk/recalculate','','', 'GET')).status,404);
  const original=await sendReq('/',undefined,{},'GET');
  assert.equal(original.status,200);
  assert.equal(original.body,DASHBOARD_HTML);
 }finally{await new Promise(resolve=>server.close(resolve))}
});


test('V12 offline ZIP reference map and paginated, exact-scope property drilldown remain read-only',async()=>{
 const clientSource=await readFile(client,'utf8');
 const geoSource=await readFile(new URL('../src/roofing/roofing_geo_explorer_v12.py',import.meta.url),'utf8');
 const bridge=await readFile(new URL('../src/roofing/roofing-bulk-bridge-v2.mjs',import.meta.url),'utf8');
 for(const id of ['roof-geo-svg','roof-geo-zip','roof-geo-pathway',
   'roof-geo-blocks','roof-geo-properties','roof-geo-next','roof-geo-property-next']){
  assert.ok(ROOF_BULK_PAGE.includes('id="'+id+'"'),id);
 }
 assert.match(clientSource,/function renderRoofZipReferences/);
 assert.match(clientSource,/\/api\/fun\/roofing\/bulk\/geo/);
 assert.match(clientSource,/external map links|Google Maps|www\.google\.com\/maps\/search/);
 assert.match(geoSource,/ZIP_POSTAL_REFERENCE_ONLY_NOT_STREET_OR_PARCEL/);
 assert.match(geoSource,/GeoNames US postal codes, CC BY 4\.0/);
 assert.match(bridge,/export async function roofingZipExplorer/);
 assert.doesNotMatch(geoSource,/sqlite3\.connect|urllib|requests\.|INSERT INTO|DELETE FROM/);
 const captured=[];
 const server=createUnifiedMlHub({
  ml:{},commerce:{},grounded:{status:()=>({})},reviewedDispatch:{},reviewedCompute:{},
  roofingZipExplorerReader:async opts=>{
   captured.push(opts);
   return {version:'fun-roofing-zip-street-explorer-v12',
     state:'ZIP_STREET_RESEARCH_READY',read_only:true,no_outreach:true,
     total:1,rows:[],coordinate_meaning:'ZIP_POSTAL_REFERENCE_ONLY_NOT_STREET_OR_PARCEL'};
  }
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const call=(path,method='GET')=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,path,method,
   headers:{host:'127.0.0.1:8802'}},res=>{
    let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);
    res.on('end',()=>resolve({status:res.statusCode,body}));});
  req.on('error',reject);req.end();
 });
 try{
  const a=await call('/api/fun/roofing/bulk/geo?mode=blocks&zip=90037&pathway=HISTORICAL&offset=0&limit=25');
  assert.equal(a.status,200);
  assert.equal(JSON.parse(a.body).coordinate_meaning,'ZIP_POSTAL_REFERENCE_ONLY_NOT_STREET_OR_PARCEL');
  const b=await call('/api/fun/roofing/bulk/geo?mode=properties&zip=90037&block=100-199%20OAK%20ST&pathway=NO_MATCH');
  assert.equal(b.status,200);
  assert.equal(captured.length,2);
  assert.equal(captured[0].zip,'90037');
  assert.equal(captured[1].mode,'properties');
  assert.equal(captured[1].block,'100-199 OAK ST');
  for(const path of [
   '/api/fun/roofing/bulk/geo?mode=properties&zip=90037',
   '/api/fun/roofing/bulk/geo?pathway=FORGED',
   '/api/fun/roofing/bulk/geo?zip=90037&zip=90049',
   '/api/fun/roofing/bulk/geo?limit=999',
   '/api/fun/roofing/bulk/geo?unknown=x',
  ]){
    assert.equal((await call(path)).status,422,path);
  }
  assert.equal((await call('/api/fun/roofing/bulk/geo','POST')).status,404);
  assert.equal((await call('/')).body,DASHBOARD_HTML);
  assert.equal(captured.length,2);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
