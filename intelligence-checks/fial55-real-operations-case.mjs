import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {initializeIdentity,storeIdentity,validateIdentity,seedWorkRegister,runRealOperationsCycle,runUnifiedCycle,readRealStatus,VERSION} from '../src/operator/real-operations-v5-5.mjs';
import {SOURCES,monitorOfficialSites} from '../src/operator/official-source-watch-v5-5.mjs';
const C={owner:'Test Operator',email:'test-operator@example.com',phone:'760-000-1111',
 website:'https://example.com',business_address:'101 Example Street',
 city:'Victorville',zip:'92392',file_reference:'B123456789'};
const NOW=new Date('2026-11-14T22:00:00Z');
const fetchMock=async()=>new Response('<!doctype html><h1>Official published instructions</h1>',{
 status:200,headers:{'content-type':'text/html','content-length':'56'}});
const disallowed=async()=>new Response('<html><h1>Moved</h1></html>',{status:302,headers:{'content-type':'text/html','location':'http://evil.invalid/'}});
async function roots(){
 const x=await mkdtemp(join(tmpdir(),'fial55-'));return {parent:x,root:join(x,'exec'),grant:join(x,'grants')}
}
test('private user-provided Elektron identity stays separate from Fun software workspace',()=>{
 const p=initializeIdentity(C);
 assert.equal(p.software.name,'Fun Industrial');
 assert.equal(p.software.type,'software_workspace');
 assert.equal(p.software.has_business_license_claim,false);
 assert.equal(p.company.legal_name,'ELEKTRON INDUSTRIAL LLC');
 assert.equal(p.company.official_registration_verified,false);
 assert.equal(p.company.business_license_status_verified,false);
 assert.equal(p.company.business_license_file_reference,'B123456789');
 assert.throws(()=>validateIdentity({...p,software:{...p.software,licensed_business_claim:true}}),/BUSINESS_IDENTITY_SCHEMA_OR_CLAIMS_INVALID/);
 assert.throws(()=>initializeIdentity({...C,email:'not-mail'}),/BUSINESS_CONTACT_OR_REFERENCE_INVALID/);
});
test('private identity write is idempotent and refuses overwrite of a different business profile',async()=>{
 const p=await roots();
 try{
  assert.equal((await storeIdentity(C,{root:p.root})).state,'LOCAL_PROFILE_CREATED');
  assert.equal((await storeIdentity(C,{root:p.root})).state,'EXISTING_LOCAL_PROFILE_ADOPTED');
  await assert.rejects(storeIdentity({...C,phone:'760-000-2222'},{root:p.root}),/PROFILE_EXISTS_DIFFERENT_REVIEW_BEFORE_OVERWRITE/);
  const content=await readFile(join(p.root,'business-identity-v5-5.json'),'utf8');
  assert.match(content,/operator_provided/);
 }finally{await rm(p.parent,{recursive:true,force:true})}
});
test('seeds real company filing and email research once without overwriting human edits',async()=>{
 const p=await roots();
 try{
  await mkdir(p.root,{recursive:true});
  await writeFile(join(p.root,'work-register-v1.json'),JSON.stringify({
   schema:'executive-operator-work-register-v1',items:[{
    id:'owner-priority',kind:'projects',company:'elektron',title:'Operator approved milestone',priority:91
   }]
  }));
  const a=await seedWorkRegister({root:p.root});
  assert.ok(a.added>=7);
  const b=await seedWorkRegister({root:p.root});
  assert.equal(b.added,0);
  const j=JSON.parse(await readFile(join(p.root,'work-register-v1.json'),'utf8'));
  assert.equal(j.items[0].title,'Operator approved milestone');
  assert.ok(j.items.some(x=>x.title.includes('Victorville business license')));
  assert.ok(j.items.some(x=>x.company==='elektron'&&x.kind==='mail'));
 }finally{await rm(p.parent,{recursive:true,force:true})}
});
test('official source monitoring is bounded, detects content change and throttles repeat calls',async()=>{
 const p=await roots();let count=0,content='<h1>Official A</h1>';
 try{
  const mock=async()=>{count++;return new Response(content,{status:200,headers:{'content-type':'text/html'}})};
  const a=await monitorOfficialSites({dir:join(p.root,'watch'),now:NOW,fetcher:mock});
  assert.equal(a.fetched,SOURCES.length);assert.equal(count,SOURCES.length);assert.equal(a.changed,0);
  const b=await monitorOfficialSites({dir:join(p.root,'watch'),now:new Date(+NOW+1000),fetcher:mock});
  assert.equal(b.fetched,0);assert.equal(count,SOURCES.length);
  content='<h1>Official B</h1>';
  const c=await monitorOfficialSites({dir:join(p.root,'watch'),now:new Date(+NOW+25*3600000),fetcher:mock});
  assert.equal(c.changed,SOURCES.length);
  assert.equal(c.errors,0);
 }finally{await rm(p.parent,{recursive:true,force:true})}
});
test('unsafe redirects and inaccessible government pages are held without stopping unrelated work',async()=>{
 const p=await roots();
 try{
  const watch=await monitorOfficialSites({dir:join(p.root,'watch'),now:NOW,fetcher:disallowed});
  assert.equal(watch.errors,SOURCES.length);
  assert.ok(watch.sources.every(x=>x.state==='OFFICIAL_PAGE_FETCH_HOLD'));
  assert.ok(watch.sources.every(x=>!x.source_file));
 }finally{await rm(p.parent,{recursive:true,force:true})}
});
test('real operations generate local filing draft and SOS research without filing, sending, altering software',async()=>{
 const p=await roots();
 try{
  await storeIdentity(C,{root:p.root});
  const a=await runRealOperationsCycle({root:p.root,now:NOW,officialFetch:fetchMock});
  assert.equal(a.version,VERSION);
  assert.equal(a.company_identity_status,'OPERATOR_PROVIDED_NOT_OFFICIALLY_VERIFIED');
  assert.equal(a.new_local_artifacts,4);
  assert.equal(a.emails_sent,0);assert.equal(a.government_filings,0);
  assert.equal(a.applied_configs,0);assert.equal(a.payments,0);assert.equal(a.rea_executions,0);
  assert.equal(a.official_sources.fetched,SOURCES.length);
  const grantProposal=a.artifacts.find(x=>x.id==='elektron-grant-applicant-proposal');
  const proposal=JSON.parse(await readFile(grantProposal.path,'utf8'));
  assert.equal(proposal.business_name,'ELEKTRON INDUSTRIAL LLC');
  assert.equal(proposal.eligible_business_verified,false);
  assert.equal(proposal.good_standing_verified,false);
  const draft=a.artifacts.find(x=>x.id==='victorville-license-check');
  assert.match(await readFile(draft.path,'utf8'),/LOCAL DRAFT ONLY/);
  assert.match(await readFile(draft.path,'utf8'),/businesslicense@victorvilleca.gov/);
  assert.match(await readFile(draft.path,'utf8'),/not independently verified/);
  await writeFile(draft.path,'HUMAN EDIT PRESERVED');
  const b=await runRealOperationsCycle({root:p.root,now:new Date(+NOW+1000),officialFetch:fetchMock});
  assert.equal(b.new_local_artifacts,0);
  assert.equal(await readFile(draft.path,'utf8'),'HUMAN EDIT PRESERVED');
 }finally{await rm(p.parent,{recursive:true,force:true})}
});
test('full bounded combined cycle reuses previous executive engine without claiming LLC for software',async()=>{
 const p=await roots();
 try{
  await storeIdentity(C,{root:p.root});await mkdir(p.grant,{recursive:true});
  await mkdir(p.root,{recursive:true});
  await writeFile(join(p.root,'work-register-v1.json'),JSON.stringify({
   schema:'executive-operator-work-register-v1',items:[]}));
  const result=await runUnifiedCycle({root:p.root,grantRoot:p.grant,now:NOW,officialFetch:fetchMock});
  assert.equal(result.state,'BOUNDED_LOCAL_EXECUTION_CONFIRMED');
  assert.ok(result.legacy.items>=17);
  assert.equal(result.real.government_filings,0);
  assert.equal(result.real.emails_sent,0);
  const old=JSON.parse(await readFile(join(p.root,'state-v1.json'),'utf8'));
  assert.equal(old.companies.find(x=>x.id==='fun').name,'Fun Industrial (software workspace)');
  assert.ok(old.items.some(x=>x.company==='elektron'&&x.kind==='filings'));
  const status=await readRealStatus({root:p.root});assert.equal(status.version,VERSION);
 }finally{await rm(p.parent,{recursive:true,force:true})}
});


test('old Fun Industrial LLC grants profile is held until genuine Elektron applicant profile is verified',async()=>{
 const p=await roots();
 try{
  await storeIdentity(C,{root:p.root});await mkdir(p.grant,{recursive:true});
  await writeFile(join(p.root,'work-register-v1.json'),JSON.stringify({
   schema:'executive-operator-work-register-v1',items:[]}));
  await writeFile(join(p.grant,'last-run.json'),JSON.stringify({
   version:'fun-real-application-worker-v1',
   state:'REAL_SOURCE_SCANNED_DRAFTS_PREPARED',source_sha256:'b'.repeat(64),
   submitted_applications:0,top_candidates:[{
    grant_id:'12345',title:'Example program for legitimate business applicants',deadline_date:'2026-12-30'
   }]
  }));
  await writeFile(join(p.grant,'business-profile.json'),JSON.stringify({business_name:'FUN INDUSTRIAL LLC'}));
  const a=await runUnifiedCycle({root:p.root,grantRoot:p.grant,now:NOW,officialFetch:fetchMock});
  const aState=JSON.parse(await readFile(join(p.root,'state-v1.json'),'utf8'));
  assert.equal(aState.grants.state,'source_held');
  assert.equal(aState.grants.issue,'GRANT_APPLICANT_PROFILE_MISMATCH_OR_MISSING');
  assert.equal(aState.items.filter(x=>x.source.startsWith('verified_local_grants_snapshot:')).length,0);
  await writeFile(join(p.grant,'business-profile.json'),JSON.stringify({business_name:'ELEKTRON INDUSTRIAL LLC'}));
  const b=await runUnifiedCycle({root:p.root,grantRoot:p.grant,now:new Date(+NOW+120000),officialFetch:fetchMock});
  const bState=JSON.parse(await readFile(join(p.root,'state-v1.json'),'utf8'));
  assert.equal(bState.grants.state,'verified_local_snapshot');
  assert.ok(bState.items.some(x=>x.kind==='funding'&&x.company==='elektron'&&
   x.title.includes('Example program')));
  assert.equal(b.real.government_filings,0);
 }finally{await rm(p.parent,{recursive:true,force:true})}
});
