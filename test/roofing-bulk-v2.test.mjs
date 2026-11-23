import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {ROOF_BULK_PAGE} from '../src/ui/roofing-bulk-page-v2.mjs';
import {BULK_VERSION,bulkCatalog,startBulkSync,bulkMarkets} from '../src/roofing/roofing-bulk-bridge-v2.mjs';
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
