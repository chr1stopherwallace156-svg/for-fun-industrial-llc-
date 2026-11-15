import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FUNDING_PDF,SOURCES,PUBLISHED_RESERVATIONS,groupReservedApplicants,
 fleetQueue,ZESBI_PROGRAM,ranking,VERSION as CATALOG_VERSION,PROCUREMENT_WATCH} from '../src/fleet/fleet-sources-v5-9.mjs';
import {runFleetCycle,readFleetStatus,verifyPublicFleetReport,VERSION} from '../src/fleet/fleet-engine-v5-9.mjs';
const now=new Date('2026-11-14T20:00:00.000Z');
function fetchMock({change=false,fail='',redirect=false,large=false}={}){
 const calls=[];const fetcher=async(url,req)=>{
  calls.push({url,method:req.method});
  if(url.includes(fail)&&fail)throw Error('SYNTHETIC_SOURCE_UNAVAILABLE');
  if(redirect)return Response.redirect('https://example.invalid/',302);
  if(url.endsWith('.pdf')){
   return new Response(Buffer.from('%PDF-1.4\n'+(change?'Changed':'Original')+'\n'+'x'.repeat(130)),{
    status:200,headers:{'content-type':'application/pdf'}});
  }
  return new Response('<!doctype html><html><head><title>Official source '+(change?'Changed':'Original')+'</title></head></html>'+
    (large?'x'.repeat(250000):''),{status:200,headers:{'content-type':'text/html'}});
 };return {fetcher,calls}
}
test('curated official list has grounded 2026 date, numbered source pages and valid distinct rows',()=>{
 assert.ok(PUBLISHED_RESERVATIONS.length>=35);
 assert.equal(new Set(PUBLISHED_RESERVATIONS.map(x=>x.id)).size,PUBLISHED_RESERVATIONS.length);
 assert.equal(new Set(SOURCES.map(x=>x.id)).size,SOURCES.length);
 assert.ok(PUBLISHED_RESERVATIONS.every(x=>x.source_url===FUNDING_PDF&&
  x.pdf_page>=1&&x.pdf_page<=5&&x.current_bid_confirmed===false));
 assert.equal(CATALOG_VERSION,'fial5.9-fleet-opportunity-source-catalog-v1');
 assert.ok(ZESBI_PROGRAM.funding_floor_usd===55000000);
 assert.ok(ZESBI_PROGRAM.application_earliest.includes('2026-11-17T10:00'));
});
test('geographically important genuine districts retain published counts, not inferred replacement volume',()=>{
 const q=fleetQueue({limit:100});
 const one=name=>q.find(x=>x.name===name);
 assert.equal(one('Victor Valley Union High School District').listed_buses,6);
 assert.equal(one('Victor Valley Union High School District').listed_chargers,3);
 assert.deepEqual(one('Victor Valley Union High School District').pdf_pages,[5]);
 assert.equal(one('Palmdale Elementary School District').listed_buses,3);
 assert.equal(one('Kern County Office of Education').listed_buses,40);
 assert.equal(one('Kern County Office of Education').listed_chargers,28);
 assert.equal(one('Kern County Office of Education').application_rows,2);
 assert.equal(one('San Marcos Unified School District').listed_buses,24);
 assert.equal(one('San Marcos Unified School District').application_rows,2);
 assert.equal(one('Moreno Valley Unified School District').listed_buses,43);
 assert.equal(one('Bakersfield City School District').listed_buses,32);
});
test('transparent sorting does not calculate bid, eligibility, probability, margin, or fictitious revenue',()=>{
 const q=fleetQueue({limit:100});
 assert.ok(q.length>30);
 for(const r of q){
  assert.ok(r.research_priority_points<=85);
  assert.deepEqual(Object.values(r.components).reduce((a,b)=>a+b,0),r.research_priority_points);
  assert.equal(r.confirmed_bid,false);
  assert.equal(r.verified_contract_value_usd,0);
  assert.equal(r.verified_supplier_margin_usd,0);
  assert.equal(r.vendor_eligibility,'NOT_VERIFIED');
  assert.equal(r.current_bid_deadline,null);
  assert.equal(r.is_2026_second_solicitation_applicant,false);
  assert.equal(r.application_funding_status,'RESERVED_NOT_AWARD_PROVEN');
 }
 assert.deepEqual(q.map(x=>x.research_priority_points),
  [...q.map(x=>x.research_priority_points)].sort((a,b)=>b-a));
 assert.equal(PROCUREMENT_WATCH.filter(x=>x.confirmed_active_bid_count>0).length,0);
});
test('forged source URL, duplicate evidence row, changed claim and illegal counts are refused',()=>{
 const row=PUBLISHED_RESERVATIONS[0];
 for(const forged of [
  {...row,source_url:'https://attacker.invalid/lead'},
  {...row,source_claim:'AWARD_CONFIRMED'},
  {...row,buses:-1},{...row,pdf_page:99}
 ])assert.throws(()=>groupReservedApplicants([forged]),/SOURCE_RESERVATION_FORGED_OR_DUPLICATED/);
 assert.throws(()=>groupReservedApplicants([row,row]),/SOURCE_RESERVATION_FORGED_OR_DUPLICATED/);
 assert.throws(()=>fleetQueue({limit:999}),/QUEUE_LIMIT_INVALID/);
 assert.throws(()=>ranking({listed_buses:Infinity,listed_chargers:3}),/RANK_INPUT_INVALID/);
});
test('first cycle obtains bounded real-format source evidence, creates no fabricated new bid',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fi-fleet59-'));
 try{
  const mock=fetchMock();
  const r=await runFleetCycle({root,now,fetcher:mock.fetcher});
  assert.equal(r.version,VERSION);
  assert.equal(r.source_catalog_version,CATALOG_VERSION);
  assert.equal(r.counts.official_sources,SOURCES.length);
  assert.equal(r.counts.checked,SOURCES.length);
  assert.equal(r.counts.held,0);
  assert.equal(r.counts.published_changes,0);
  assert.equal(r.counts.verified_open_rfps,0);
  assert.equal(r.boundaries.rea_calls,0);
  assert.equal(r.boundaries.emails_sent,0);
  assert.equal(r.boundaries.model_calls,0);
  assert.ok(r.sources.every(x=>x.change_state==='FIRST_BASELINE_NO_CHANGE'));
  assert.ok(mock.calls.every(x=>x.method==='GET'));
  const files=await readdir(join(root,'FleetOpportunityV59'));
  assert.ok(files.some(x=>x.startsWith('zesbi-reserved-funding-pdf-')&&x.endsWith('.pdf')));
  const visible=await readFleetStatus({root});
  assert.equal(visible.state,r.state);
  assert.ok(visible.sources.every(x=>!('raw_evidence_file' in x)));
  assert.ok(verifyPublicFleetReport(visible));
 }finally{await rm(root,{recursive:true,force:true})}
});
test('source-specific time-to-live avoids continuous polling and false first-run change events',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fi-fleet59-'));
 try{
  await runFleetCycle({root,now,fetcher:fetchMock().fetcher});
  const m=fetchMock({change:true});
  const second=await runFleetCycle({root,now:new Date(+now+3600000),fetcher:m.fetcher});
  assert.equal(second.counts.checked,0);
  assert.equal(m.calls.length,0);
  assert.equal(second.counts.published_changes,0);
  const third=await runFleetCycle({root,now:new Date(+now+73*3600000),fetcher:m.fetcher});
  assert.equal(third.counts.checked,SOURCES.length);
  assert.equal(third.counts.published_changes,SOURCES.length);
  assert.ok(third.published_changes.every(x=>x.bids_auto_created===0&&
   x.legal_claims_auto_updated===false));
  assert.equal(third.counts.verified_open_rfps,0);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('a refused agency or fake redirect is a source hold, never a fabricated opportunity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fi-fleet59-'));
 try{
  const r=await runFleetCycle({root,now,fetcher:fetchMock({fail:'www.cde.ca.gov'}).fetcher});
  assert.equal(r.counts.held,1);
  assert.equal(r.sources.find(x=>x.id==='cde-public-districts').state,'SOURCE_UNAVAILABLE');
  assert.ok(r.prospects.length>25);
  assert.equal(r.counts.awarded_contracts,0);
 }finally{await rm(root,{recursive:true,force:true})}
 const root2=await mkdtemp(join(tmpdir(),'fi-fleet59-'));
 try{
  const r=await runFleetCycle({root:root2,now,fetcher:fetchMock({redirect:true}).fetcher});
  assert.equal(r.counts.held,SOURCES.length);
  assert.equal(r.counts.verified_open_rfps,0);
 }finally{await rm(root2,{recursive:true,force:true})}
});
test('oversized responses fail by source, do not erase safe historical reservations',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fi-fleet59-'));
 try{
  const x=await runFleetCycle({root,now,fetcher:fetchMock({large:true}).fetcher});
  assert.ok(x.counts.held>=3);
  assert.equal(x.boundaries.orders_placed,0);
  assert.equal(x.prospects.length,fleetQueue({limit:100}).length);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('tampered ledger does not elevate untrusted input into verified contracts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fi-fleet59-'));
 try{
  const r=await runFleetCycle({root,now,fetcher:fetchMock().fetcher});
  const file=join(root,'FleetOpportunityV59','last-fleet-cycle-v1.json');
  assert.equal(verifyPublicFleetReport({...r,boundaries:{...r.boundaries,rea_calls:1}}),false);
  assert.equal(verifyPublicFleetReport({...r,prospects:[{...r.prospects[0],confirmed_bid:true}]}),false);
  await writeFile(file,JSON.stringify({...r,counts:{...r.counts,awarded_contracts:1}}));
  await assert.rejects(readFleetStatus({root}),/INVALID_FLEET_STATUS_REFUSE_DISPLAY/);
 }finally{await rm(root,{recursive:true,force:true})}
});
