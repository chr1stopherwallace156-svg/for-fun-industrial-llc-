// Mission V2 is a real persistent goal-directed worker; tests use offline state.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat,readdir,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chooseWork,runMissionCycle,researchBrief,DEFAULT_MISSION,VERSION} from '../src/applications/mission-controller-v2.mjs';

const NOW=new Date('2026-11-14T10:00:00Z');
const SHA='c'.repeat(64);
const candidate=(i,change={})=>({
 grant_id:String(1000+i),title:'Industrial small business technology research '+i,agency:'California Agency',
 priority:100-i*10,status:'Active',application_deadline:'2027-12-31',
 deadline_date:'2027-12-31',purpose:'Business growth and innovation',
 description_excerpt:'Public competitive grants for California businesses',
 applicant_type:'Businesses',application_url:'https://grants.ca.gov/grants/real-listing-'+i,
 estimated_awards:'Variable',matching_funds:'Verify with grantor',
 ...change
});
const report=(n=5)=>({
 version:'fun-real-application-worker-v1',state:'REAL_SOURCE_SCANNED_DRAFTS_PREPARED',
 source_sha256:SHA,submitted_applications:0,top_candidates:Array.from({length:n},(_,i)=>candidate(i))
});
test('mission chooses actual autonomous actions and does not claim agency authority',()=>{
 const plan=chooseWork(report(5),{entries:{}},{},DEFAULT_MISSION,NOW);
 assert.equal(plan.version,VERSION);
 assert.equal(plan.decisions.length,5);
 assert.equal(plan.local_briefs_to_write.length,3);
 assert.equal(plan.deferred_briefs,2);
 assert.equal(plan.applications_submitted,0);
 assert.equal(plan.review_required,true);
 assert.equal(plan.decisions[0].reason,'NEW_ELIGIBLE_BUSINESS_RESEARCH_LEAD');
 assert.equal(plan.decisions[0].eligibility_state,'NOT_VERIFIED');
 assert.ok(plan.official_page_to_research.url.startsWith('https://grants.ca.gov/'));
 assert.ok(plan.company_information_needed.includes('documented project budget'));
});
test('mission holds for unverifiable scan or attempts to expand power',()=>{
 assert.throws(()=>chooseWork({...report(),submitted_applications:1}),/VERIFIED_LIVE_SCAN_REQUIRED/);
 assert.throws(()=>chooseWork({...report(),source_sha256:'not-a-source'}),/VERIFIED_LIVE_SCAN_REQUIRED/);
 assert.throws(()=>chooseWork(report(),{entries:{}},{},{...DEFAULT_MISSION,grant_submissions_allowed:true}),/AUTHORITY_POLICY_DENIED/);
 assert.throws(()=>chooseWork(report(),{entries:{}},{},{...DEFAULT_MISSION,external_emails_allowed:true}),/AUTHORITY_POLICY_DENIED/);
 assert.throws(()=>chooseWork(report(),{entries:{}},{},{...DEFAULT_MISSION,rea_execution_allowed:true}),/AUTHORITY_POLICY_DENIED/);
 assert.throws(()=>chooseWork(report(),{entries:{}},{},{...DEFAULT_MISSION,max_official_pages_per_cycle:99}),/AUTHORITY_POLICY_DENIED/);
});
test('malformed grant identifiers and off-domain pages never become authorized outward actions',()=>{
 const bad=report(2);
 bad.top_candidates[0]=candidate(0,{grant_id:'_YY_-SM_____',application_url:'https://attacker.example/upload'});
 bad.top_candidates[1]=candidate(1,{application_url:'https://evil.example/track'});
 const plan=chooseWork(bad,{entries:{}},{},DEFAULT_MISSION,NOW);
 assert.equal(plan.decisions.length,1);
 assert.equal(plan.decisions[0].official_link,null);
 assert.equal(plan.official_page_to_research,null);
});
test('real local file cycle chooses three then independently completes deferred candidates next run, no duplicates',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fi-mission-worker-'));
 let calls=0;
 const fetchImpl=async(url,options)=>{
  calls++;
  assert.ok(url.startsWith('https://grants.ca.gov/grants/'));
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  return new Response('<html><body><h1>California Grant Program</h1><p>Eligibility terms require official verification. Contact grantor before submission.</p></body></html>',
   {status:200,headers:{'content-type':'text/html'}});
 };
 try{
  const first=await runMissionCycle({directory:dir,report:report(),now:NOW,fetchImpl});
  assert.equal(first.decisions_made,5);
  assert.equal(first.new_local_briefs,3);
  assert.equal(first.official_pages_read,1);
  assert.equal(first.official_page_attempts,1);
  assert.equal(first.applications_submitted,0);
  assert.equal(first.rea_actions,0);
  assert.equal(first.external_emails,0);
  assert.equal(first.spending,0);
  assert.equal(first.state,'INDEPENDENT_RESEARCH_ACTIONS_COMPLETED_REVIEW_REQUIRED');
  assert.equal(first.actions.length,3);
  const original=await readFile(first.actions[0].path,'utf8');
  assert.match(original,/DRAFT; NOT SUBMITTED; ELIGIBILITY NOT VERIFIED/);
  assert.match(original,/Official page:/);
  const firstPath=first.actions[0].path;
  await writeFile(firstPath,original+'\nOperator verified local note\n');
  const second=await runMissionCycle({directory:dir,report:report(),now:new Date(NOW.getTime()+6*3600000),fetchImpl});
  assert.equal(second.new_local_briefs,2);
  assert.equal(second.official_pages_read,1);
  assert.ok(second.actions.every(a=>a.decision==='COMPLETE_PREVIOUSLY_DEFERRED_RESEARCH'));
  assert.match(await readFile(firstPath,'utf8'),/Operator verified local note/);
  const third=await runMissionCycle({directory:dir,report:report(),now:new Date(NOW.getTime()+12*3600000),fetchImpl});
  assert.equal(third.new_local_briefs,0);
  assert.equal(third.official_pages_read,0);
  assert.equal(third.decisions_made,5);
  assert.equal(calls,2);
  assert.equal((await readdir(join(dir,'mission-briefs'))).length,5);
  const state=JSON.parse(await readFile(join(dir,'mission-state-v2.json'),'utf8'));
  assert.equal(Object.keys(state.entries).length,5);
  assert.ok(Object.values(state.entries).every(e=>e.brief_pending===false));
  const journal=(await readFile(join(dir,'mission-actions.jsonl'),'utf8')).trim().split('\n');
  assert.equal(journal.length,3);
  assert.ok(journal.every(x=>JSON.parse(x).applications_submitted===0));
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('one failed official-page fetch is recorded and temporarily backed off; local drafts still generated',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fi-mission-backoff-'));
 let attempts=0;
 try{
  const bad=async()=>{
   attempts++;return new Response('Forbidden',{status:403,headers:{'content-type':'text/plain'}});
  };
  const first=await runMissionCycle({directory:dir,report:report(1),now:NOW,fetchImpl:bad});
  assert.equal(first.new_local_briefs,1);
  assert.equal(first.official_pages_read,0);
  assert.equal(first.official_page_attempts,1);
  assert.match(first.official_page_error,/UNAVAILABLE/);
  assert.equal(first.applications_submitted,0);
  const second=await runMissionCycle({directory:dir,report:report(1),
   now:new Date(NOW.getTime()+6*3600000),fetchImpl:bad});
  assert.equal(second.official_pages_read,0);
  assert.equal(second.official_page_attempts,0);
  assert.equal(attempts,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('changed government listing leads to a new versioned brief without overwriting earlier review',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fi-mission-changed-'));
 const never=async()=>{throw Error('UNEXPECTED_NETWORK_ACTION')};
 try{
  const base=report(1);
  base.top_candidates[0].application_url='https://other.invalid/grant';
  const first=await runMissionCycle({directory:dir,report:base,now:NOW,fetchImpl:never});
  assert.equal(first.new_local_briefs,1);
  const revised=report(1);
  revised.top_candidates[0].application_url='https://other.invalid/grant';
  revised.top_candidates[0].purpose='Updated agency purpose requiring additional facts';
  const second=await runMissionCycle({directory:dir,report:revised,
   now:new Date(NOW.getTime()+3600000),fetchImpl:never});
  assert.equal(second.new_local_briefs,1);
  assert.equal(second.actions[0].decision,'PUBLISHED_GRANT_RECORD_UPDATED');
  assert.notEqual(second.actions[0].path,first.actions[0].path);
  assert.equal((await readdir(join(dir,'mission-briefs'))).length,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('scheduler and runner integrate mission V2 within the existing single accountable 6-hour cycle',async()=>{
 const runner=await readFile(new URL('../scripts/Run-Fun-Grant-Applications-V1.mjs',import.meta.url),'utf8');
 const powershell=await readFile(new URL('../Run-Fun-Grant-Applications-V1.ps1',import.meta.url),'utf8');
 assert.match(runner,/await runOpportunityCycle/);
 assert.match(runner,/await runMissionCycle/);
 assert.match(runner,/FUN_MISSION_NEXT_PRIORITY/);
 assert.match(runner,/FUN_MISSION_BRIEF=/);
 assert.match(powershell,/MISSION_AUTHORITY_OR_EVIDENCE_INVALID/);
 assert.match(powershell,/FUN_MISSION_V2=PASS/);
 assert.doesNotMatch(runner,/submitApplication|sendEmail|tool.execute|shopify.*mutation/);
});

test('read-only mission status interface reports actual files and schedule, never restarts services',async()=>{
 const script=await readFile(new URL('../Show-Fun-Independent-Mission-V2.ps1',import.meta.url),'utf8');
 assert.match(script,/last-mission-v2\.json/);
 assert.match(script,/Get-ScheduledTaskInfo/);
 assert.match(script,/NEXT_SELF_CHOSEN_PRIORITY/);
 assert.match(script,/UNMATCHED_EVIDENCE/);
 assert.match(script,/SUBMISSIONS=0 REA_TOOL_EXECUTIONS=0 EXPENDITURES=0/);
 assert.doesNotMatch(script,/Start-Process|Stop-Process|Remove-Item|Invoke-WebRequest|Invoke-RestMethod|Register-ScheduledTask/);
});
