import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildWork,runExecutiveCycle,readExecutiveStatus,KINDS,VERSION,PROHIBITED} from '../src/operator/executive-ops-v1.mjs';
const NOW=new Date('2026-11-14T20:00:00Z');
const report=()=>({version:'fun-real-application-worker-v1',
 state:'REAL_SOURCE_SCANNED_DRAFTS_PREPARED',source_sha256:'a'.repeat(64),
 submitted_applications:0,timestamp:'2026-11-14T19:00:00Z',
 top_candidates:[{grant_id:'CA-123',title:'Verified business software development grant',
 application_url:'https://grants.ca.gov/grants/example/',
 deadline_date:'2026-11-25',agency:'California Program',status:'Active'}]});
const mission=()=>({version:'fun-industrial-mission-controller-v2',source_sha256:'a'.repeat(64),
 applications_submitted:0,rea_actions:0,external_emails:0,spending:0});
async function temp(){const root=await mkdtemp(join(tmpdir(),'fi-exec54-'));return {root,execRoot:join(root,'executive'),grantRoot:join(root,'grants')}}
test('eleven distinct operational domains, not grant-only; no fabricated deadline or completed actions',()=>{
 const work=buildWork({today:NOW});
 assert.equal(KINDS.length,11);
 assert.deepEqual(new Set(work.map(x=>x.kind)),new Set(KINDS));
 assert.equal(work.filter(x=>x.source==='operator_goal').length,11);
 for(const item of work){
  assert.equal(item.due,null);assert.equal(item.executed_externally,false);
  assert.equal(item.external_action_authorized,false);assert.ok(item.required.length);
 }
 assert.equal(PROHIBITED.email_sent,0);assert.equal(PROHIBITED.government_filings,0);
});
test('verified local grants snapshot creates urgent work item but not false eligibility',()=>{
 const tasks=buildWork({grantReport:report(),mission:mission(),today:NOW});
 const grant=tasks.find(x=>x.title.includes('Verified business software'));
 assert.ok(grant);assert.equal(grant.kind,'funding');
 assert.equal(grant.due,'2026-11-25');assert.equal(grant.priority,95);
 assert.equal(grant.official_url,'https://grants.ca.gov/grants/example/');
 assert.equal(grant.external_action_authorized,false);
 assert.match(grant.required.join(' '),/Verified business registration/);
});
test('forged grant reports or unauthorized mission effects cannot enter work queue',()=>{
 assert.throws(()=>buildWork({grantReport:{...report(),submitted_applications:1},today:NOW}),
  /EXEC_GRANT_REPORT_NOT_ATTESTED/);
 assert.throws(()=>buildWork({grantReport:report(),mission:{...mission(),external_emails:1},today:NOW}),
  /EXEC_MISSION_NOT_ATTESTED/);
});
test('read-only incoming email triage never sends and marks message content untrusted',()=>{
 const work=buildWork({today:NOW,mailState:'connected_read_only',inbox:[
  {id:'acde00334455',subject:'Urgent filing update',from:'sender@example.com'},
  {id:'acde00334455',subject:'duplicate',from:'sender@example.com'},
  {id:'abc123',subject:'General supplier update',from:'supplier@example.com'}]});
 const mail=work.filter(x=>x.kind==='mail'&&x.source==='authorized_readonly_gmail_header');
 assert.equal(mail.length,2);
 assert.equal(mail[0].priority,80);
 assert.equal(mail[0].external_action_authorized,false);
 assert.ok(mail[0].required.includes('Approve exact email content and destination before sending'));
});
test('registered work items may propose plans but not infer completion',()=>{
 const work=buildWork({today:NOW,workRegister:{schema:'executive-operator-work-register-v1',items:[
  {id:'sos-check',kind:'filings',company:'fun',title:'Research annual filing obligations',
   due:'2027-02-01',required:['Verified official notice'],priority:90},
  {id:'engineering-review',kind:'engineering',company:'elektron',title:'Prepare CAD validation packet'}
 ]}});
 assert.equal(work.filter(x=>x.source==='operator_registered_unverified').length,2);
 assert.equal(work[0].due,'2027-02-01');
 assert.equal(work[0].executed_externally,false);
 assert.throws(()=>buildWork({today:NOW,workRegister:{schema:'executive-operator-work-register-v1',items:[
  {id:'oops',kind:'shell_command',title:'Do anything',company:'fun'}]}}),/EXEC_WORK_ITEM_INVALID/);
});
test('real bounded local cycle writes persistent packets, preserves edits and avoids duplicate packets',async()=>{
 const p=await temp();
 try{
  await mkdir(p.grantRoot,{recursive:true});
  await writeFile(join(p.grantRoot,'last-run.json'),JSON.stringify(report()));
  await writeFile(join(p.grantRoot,'last-mission-v2.json'),JSON.stringify(mission()));
  const a=await runExecutiveCycle({root:p.execRoot,grantRoot:p.grantRoot,now:NOW,
   readMailbox:async()=>({account_verified:true,messages:[{id:'feedcafe0011',subject:'Project follow-up',from:'project@example.org'}]})});
  assert.equal(a.version,VERSION);
  assert.equal(a.grants.state,'verified_local_snapshot');
  assert.equal(a.mail_state,'connected_read_only');
  assert.equal(a.outbound_permissions.email_sent,0);
  assert.ok(a.items.some(x=>x.kind==='engineering'));
  assert.ok(a.items.some(x=>x.kind==='funding'&&x.phase==='prepare_application_evidence'));
  assert.ok(a.items.some(x=>x.kind==='mail'&&x.source==='authorized_readonly_gmail_header'));
  assert.ok(a.local_packets_written.length>0);
  const original=a.local_packets_written[0].path;
  await writeFile(original,'OPERATOR_EDIT_WAS_PRESERVED');
  const b=await runExecutiveCycle({root:p.execRoot,grantRoot:p.grantRoot,now:new Date(+NOW+60000),
   readMailbox:async()=>({account_verified:true,messages:[{id:'feedcafe0011',subject:'Project follow-up',from:'project@example.org'}]})});
  assert.equal(b.new_or_changed,0);
  assert.equal(b.local_packets_written.length,0);
  assert.equal(await readFile(original,'utf8'),'OPERATOR_EDIT_WAS_PRESERVED');
  const status=await readExecutiveStatus({root:p.execRoot});
  assert.equal(status.active_items,b.active_items);
  assert.equal((await readdir(join(p.execRoot,'packets'))).length,a.local_packets_written.length);
 }finally{await rm(p.root,{recursive:true,force:true})}
});
test('missing or corrupt grant evidence never prevents other domains from operating',async()=>{
 const p=await temp();
 try{
  await mkdir(p.grantRoot,{recursive:true});
  await writeFile(join(p.grantRoot,'last-run.json'),JSON.stringify({...report(),submitted_applications:9}));
  const a=await runExecutiveCycle({root:p.execRoot,grantRoot:p.grantRoot,now:NOW});
  assert.equal(a.grants.state,'source_held');
  assert.match(a.grants.issue,/EXEC_GRANT_REPORT_NOT_ATTESTED/);
  assert.ok(a.active_items>=11);
  assert.equal(a.outbound_permissions.government_filings,0);
 }finally{await rm(p.root,{recursive:true,force:true})}
});
test('Gmail unavailable or unverified leaves independent work running without inventing messages',async()=>{
 const p=await temp();
 try{
  const a=await runExecutiveCycle({root:p.execRoot,grantRoot:p.grantRoot,now:NOW,
   readMailbox:async()=>{throw Error('GMAIL_NOT_CONNECTED')}});
  assert.equal(a.mail_state,'unavailable');
  assert.equal(a.mail_error,'GMAIL_NOT_CONNECTED');
  assert.equal(a.items.filter(x=>x.source==='authorized_readonly_gmail_header').length,0);
  assert.equal(a.outbound_permissions.email_sent,0);
 }finally{await rm(p.root,{recursive:true,force:true})}
});
test('approval flags or authority changes in local policy cannot elevate rights',async()=>{
 const p=await temp();
 try{
  await runExecutiveCycle({root:p.execRoot,grantRoot:p.grantRoot,now:NOW});
  const policyFile=join(p.execRoot,'operator-policy-v1.json');
  const policy=JSON.parse(await readFile(policyFile,'utf8'));
  policy.email_send_allowed=true;
  await writeFile(policyFile,JSON.stringify(policy));
  await assert.rejects(runExecutiveCycle({root:p.execRoot,grantRoot:p.grantRoot,now:NOW}),/EXEC_POLICY_NOT_AUTHORIZED/);
 }finally{await rm(p.root,{recursive:true,force:true})}
});
test('read-only status on a missing directory is inert',async()=>{
 const p=await temp();
 try{
  const x=await readExecutiveStatus({root:join(p.root,'missing')});
  assert.equal(x.state,'not_activated');
  assert.equal(x.active_items,0);
  assert.equal(x.outbound_permissions.rea_runs,0);
 }finally{await rm(p.root,{recursive:true,force:true})}
});
