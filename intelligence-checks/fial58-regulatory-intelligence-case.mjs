import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RULES,SOURCES,BLS_SERIES,dueWatch,graphMilestones,classifyInstitutions} from '../src/regulatory/rule-catalog-v5-8.mjs';
import {runRegulatoryCycle,readRegulatoryStatus,parseEconomicResponse,parseFederalRegister,VERSION} from '../src/regulatory/intelligence-engine-v5-8.mjs';
const FIRST=new Date('2026-11-14T23:00:00.000Z');
const samples=(delta=0)=>({status:'REQUEST_SUCCEEDED',Results:{series:[
 {seriesID:'CUUR0000SA0',data:[
  {year:'2026',period:'M10',value:'337.511'},
  {year:'2026',period:'M09',value:'336.940'},
  {year:'2025',period:'M10',value:'326.5'},
  {year:'2025',period:'M09',value:'325.0'}]},
 {seriesID:'LNS14000000',data:[
  {year:'2026',period:'M10',value:String(4.1+delta)},
  {year:'2026',period:'M09',value:'4.3'},
  {year:'2025',period:'M10',value:'4.1'}]}]}});
function response(body,type){
 return new Response(body,{status:200,headers:{'content-type':type}})
}
function simulator({change=false,fail=null,oversized=false}={}){
 const calls=[];
 const fetcher=async(url,request)=>{
  calls.push({url,method:request.method});
  if(fail&&url.includes(fail))throw Error('SYNTHETIC_OFFLINE');
  if(request.method==='POST'){
   const body=JSON.parse(request.body);
   assert.deepEqual(body.seriesid,BLS_SERIES.map(x=>x.id));
   assert.equal(body.startyear,'2024');
   return response(JSON.stringify(samples(change?1:0)),'application/json');
  }
  if(url.includes('documents.json')){
   return response(JSON.stringify({results:[{title:'Proposed rule - synthetic',html_url:'https://www.federalregister.gov/documents/2026/11/10/synthetic',publication_date:'2026-11-10'},
    {title:'malicious synthetic',html_url:'https://evil.invalid/forged'}]}),'application/json');
  }
  return response(oversized?'X'.repeat(260000):'<h1>Public agency data '+(change?'changed':'first')+'</h1>','text/html');
 };
 return {fetcher,calls};
}
test('catalog has different truck, school, public, campus, off-road rules without invented 2037 mandate',()=>{
 assert.ok(RULES.length>=9);
 assert.equal(new Set(RULES.map(x=>x.id)).size,RULES.length);
 assert.equal(new Set(SOURCES.map(x=>x.id)).size,SOURCES.length);
 assert.ok(RULES.some(x=>x.id==='ctc-obd-quarterly'&&x.effective==='2027-10'&&x.date_type==='program_frequency_change_month'));
 assert.ok(RULES.some(x=>x.id==='school-bus-ab579'&&x.effective==='2035-01-01'));
 const uncertain=RULES.find(x=>x.id==='unknown-2037');
 assert.equal(uncertain.effective,null);assert.equal(uncertain.legal_status,'unverified_watch_only');
 assert.ok(RULES.some(x=>x.id==='ca-carbon-neutrality-2045'&&x.date_type==='statewide_policy_goal'));
 assert.ok(SOURCES.some(x=>x.kind==='economic_api'&&x.host==='api.bls.gov'));
});
test('milestone graph and deadline warnings do not fabricate exact vehicle due dates',()=>{
 const w=dueWatch({now:FIRST,limit:30});
 assert.ok(w.every(x=>x.certified_applicability===false&&x.person_or_vehicle_due_date_verified===false));
 const ctc=w.find(x=>x.id==='ctc-obd-quarterly');
 assert.ok(ctc.days_until_milestone>300);
 const future=graphMilestones();
 assert.ok(future.every(x=>x.is_legal_individual_deadline===false));
 assert.ok(!future.some(x=>x.year===2037));
 assert.throws(()=>dueWatch({now:new Date(NaN)}),/INVALID_CLOCK/);
});
test('schools and campuses are classified cautiously and do not create fake bid opportunities',()=>{
 const school=classifyInstitutions('school_district');
 assert.ok(school.coverage.includes('potential_ab579_school_bus'));
 const uc=classifyInstitutions('uc_campus');
 assert.equal(uc.bids_are_verified,false);
 assert.equal(uc.grant_eligibility_verified,false);
 assert.throws(()=>classifyInstitutions('fake university'),/INSTITUTION_TYPE_INVALID/);
});
test('BLS series use actual numeric government data, month validation, chronological graphs and YoY',()=>{
 const rows=parseEconomicResponse(samples(),{asOf:FIRST});
 assert.equal(rows.length,2);
 const cpi=rows.find(x=>x.id==='CUUR0000SA0');
 assert.equal(cpi.latest_month,'2026-10');
 assert.equal(cpi.latest_value,337.511);
 assert.ok(cpi.year_over_year_change_pct>3&&cpi.year_over_year_change_pct<4);
 assert.equal(cpi.context.includes('not a truck-fleet cost quote'),true);
 assert.equal(cpi.observations.at(-1).month,'2026-10');
 const u=rows.find(x=>x.id==='LNS14000000');
 assert.equal(u.unit,'percent');
 assert.equal(u.year_over_year_change_pct,null);
 assert.throws(()=>parseEconomicResponse({status:'FAILED',Results:{series:[]}}),/BLS_UNVERIFIED_RESPONSE/);
});
test('Federal Register notices remain unreviewed even when returned from official API',()=>{
 const x=parseFederalRegister({results:[{title:'New notice',
 html_url:'https://www.federalregister.gov/documents/2026/11/10/a-notice',publication_date:'2026-11-10'},
 {title:'Bad external',html_url:'https://evil.invalid/'}]});
 assert.equal(x.length,1);
 assert.equal(x[0].status,'UNREVIEWED_FEDERAL_NOTICE_NOT_CA_COMPLIANCE_CLAIM');
});
test('first cycle fetches configured sources, writes immutable evidence and never fabricates change',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fial58-'));
 try{
  const t=simulator();
  const r=await runRegulatoryCycle({root,now:FIRST,fetcher:t.fetcher});
  assert.equal(r.version,VERSION);
  assert.equal(r.counts.monitored,SOURCES.length);
  assert.equal(r.counts.refreshed,SOURCES.length);
  assert.equal(r.counts.source_changes,0);
  assert.equal(r.counts.source_holds,0);
  assert.equal(r.economic_series.length,2);
  assert.ok(r.sources.every(x=>x.change_state==='FIRST_BASELINE_NO_CHANGE_CLAIM'));
  assert.equal(r.boundaries.emails_sent,0);
  assert.equal(r.boundaries.verified_individual_due_dates,0);
  const loaded=await readRegulatoryStatus({root});
  assert.equal(loaded.sources.length,SOURCES.length);
  assert.ok(loaded.sources.every(x=>!('raw_evidence_file' in x)));
  const dir=await readdir(join(root,'RegulatoryEconomicV58'));
  assert.ok(dir.some(x=>x.startsWith('bls-inflation-')&&x.endsWith('.json')));
 }finally{await rm(root,{recursive:true,force:true})}
});
test('incremental source checks throttle and count true published changes only',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fial58-'));
 try{
  await runRegulatoryCycle({root,now:FIRST,fetcher:simulator().fetcher});
  const t=simulator({change:true});
  const shortly=await runRegulatoryCycle({root,now:new Date(+FIRST+3600000),fetcher:t.fetcher});
  assert.equal(shortly.counts.refreshed,0);assert.equal(shortly.counts.source_changes,0);
  assert.equal(t.calls.length,0);
  const later=await runRegulatoryCycle({root,now:new Date(+FIRST+49*3600000),fetcher:t.fetcher});
  assert.equal(later.counts.refreshed,SOURCES.length);
  assert.equal(later.counts.source_changes,SOURCES.length-1);// Federal Register synthetic unchanged
  assert.ok(later.published_changes.every(x=>x.human_verification_required));
  assert.equal(later.analysis.actual_revenue,0);
  assert.equal(later.analysis.confirmed_procurement_contracts,0);
  assert.equal(later.history.length,3);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('one unavailable official source cannot stop independent economic data or rules',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fial58-'));
 try{
  const t=simulator({fail:'procurement.ucop.edu'});
  const r=await runRegulatoryCycle({root,now:FIRST,fetcher:t.fetcher});
  assert.equal(r.counts.source_holds,1);
  assert.equal(r.economic_series.length,2);
  assert.equal(r.counts.source_changes,0);
  assert.equal(r.sources.find(x=>x.id==='uc-procurement').state,'SOURCE_UNAVAILABLE');
  assert.equal(r.analysis.confirmed_procurement_contracts,0);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('oversized sources are held without trusting text or corrupting previous ledger',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fial58-'));
 try{
  const r=await runRegulatoryCycle({root,now:FIRST,fetcher:simulator({oversized:true}).fetcher});
  assert.ok(r.counts.source_holds>=4);
  assert.equal(r.boundaries.automatic_filing,0);
  assert.equal(r.counts.source_changes,0);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('malformed legacy ledger fails closed and does not erase or rewrite source authority',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fial58-'));
 try{
  await runRegulatoryCycle({root,now:FIRST,fetcher:simulator().fetcher});
  const file=join(root,'RegulatoryEconomicV58','last-intelligence-v1.json');
  const prior=JSON.parse(await readFile(file,'utf8'));
  await writeFile(file,JSON.stringify({...prior,version:'FORGED_ELEVATED'}));
  await assert.rejects(runRegulatoryCycle({root,now:FIRST,fetcher:simulator().fetcher}),
   /PRIOR_LEDGER_VERSION/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('OAL approved 2026 amendment supersedes old 2027 100 percent ACF purchasing countdown',()=>{
 const acf=RULES.find(x=>x.id==='acf-state-local-purchasing');
 assert.equal(acf.effective,'2030-01-01');
 assert.equal(acf.amendment_approved,'2026-09-10');
 assert.equal(acf.supersedes,'2027-01-01');
 assert.match(acf.source,/\/rulemaking\/2025\/acfab1594$/);
 assert.ok(acf.caveat.includes('SUPERSEDED'));
 const now=dueWatch({now:FIRST,limit:30});
 assert.ok(!now.some(x=>x.id==='acf-state-local-purchasing'&&x.urgency==='UPCOMING_MILESTONE_REVIEW'));
 assert.ok(now.some(x=>x.id==='acf-annual-public-reporting'&&x.effective==='2027-04-01'));
});
test('discrepant raw October 2026 CPI 511 fails against dated official BLS 337.511 anchor',()=>{
 const forged=samples();
 forged.Results.series.find(x=>x.seriesID==='CUUR0000SA0').data[0].value='511';
 assert.throws(()=>parseEconomicResponse(forged,{asOf:FIRST}),/BLS_OCT2026_CPI_CROSS_SOURCE_MISMATCH/);
});
test('prior stale legal catalog and suspect economic graph cannot be served as current guidance',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fial58-stale-'));
 try{
  const first=await runRegulatoryCycle({root,now:FIRST,fetcher:simulator().fetcher});
  const file=join(root,'RegulatoryEconomicV58','last-intelligence-v1.json');
  const stale={...first,source_catalog_version:'fial5.8-regulatory-catalog-v1'};
  stale.economic_series[0].latest_value=511;
  stale.economic_series[0].observations.find(x=>x.month==='2026-10').value=511;
  await writeFile(file,JSON.stringify(stale));
  const status=await readRegulatoryStatus({root});
  assert.equal(status.state,'HOLD_STALE_OR_UNVERIFIED_INTELLIGENCE_REQUIRES_REFRESH');
  assert.equal(status.economic_series.length,0);
  assert.ok(!status.rule_watch.some(x=>x.id==='acf-state-local-purchasing'&&x.effective==='2027-01-01'));
  const next=await runRegulatoryCycle({root,now:new Date(+FIRST+60000),fetcher:simulator().fetcher});
  assert.equal(next.economic_series.find(x=>x.id==='CUUR0000SA0').latest_value,337.511);
  assert.equal(next.counts.refreshed,SOURCES.length);
  assert.equal((await readRegulatoryStatus({root})).state,'REAL_PUBLIC_DATA_CHECK_COMPLETED');
 }finally{await rm(root,{force:true,recursive:true})}
});
test('source URL rebasing is not incorrectly called a newly amended regulation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fial58-rebase-'));
 try{
  const first=await runRegulatoryCycle({root,now:FIRST,fetcher:simulator().fetcher});
  const file=join(root,'RegulatoryEconomicV58','last-intelligence-v1.json');
  const old={...first,source_catalog_version:'outdated-rule-catalog',sources:first.sources.map(x=>x.id==='carb-acf'?{...x,source_url:'https://ww2.arb.ca.gov/zero-emission-regulation-deadline-schedules-truckstop'}:x)};
  await writeFile(file,JSON.stringify(old));
  const next=await runRegulatoryCycle({root,now:new Date(+FIRST+1000),fetcher:simulator().fetcher});
  assert.equal(next.counts.source_changes,0);
  assert.ok(next.published_changes.some(x=>x.type==='SOURCE_URL_REBASED_TO_CURRENT_AUTHORITY'));
 }finally{await rm(root,{force:true,recursive:true})}
});
