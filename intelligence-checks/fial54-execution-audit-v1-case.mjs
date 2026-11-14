import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {inspectCycle,collectAudit,VERSION} from '../scripts/Audit-Fun-Executive-State.mjs';
const NOW=new Date('2026-11-14T21:40:00Z');
const KEY='fial5.4-executive-operator-v1';
const ZERO={email_sent:0,government_filings:0,spent_usd:0,rea_runs:0,source_patches:0,training_runs:0};
const item=(i,type,source)=>({id:String(i),kind:type,source,phase:'needs_verified_inputs',due:null,
 title:'Review '+type,priority:35,executed_externally:false,external_action_authorized:false});
const state=()=>({version:KEY,cycle_utc:'2026-11-14T21:39:00Z',
 domains:['mail','filings','configuration','projects','funding','incentives','sales','vendors','finance','engineering','security'],
 active_items:4,new_or_changed:2,mail_state:'unavailable',
 items:[item(1,'mail','operator_goal'),item(2,'filings','operator_goal'),
 item(3,'funding','verified_local_grants_snapshot:sha'),item(4,'configuration','operator_registered_unverified')],
 local_packets_written:[{path:'test.md'}],grants:{state:'verified_local_snapshot'},
 outbound_permissions:ZERO});
const receipt=()=>({version:KEY,cycle_utc:'2026-11-14T21:39:00Z',active_items:4,
 new_or_changed:2,prepared_packets:1,outbound_permissions:ZERO});
test('a valid local cycle is not misrepresented as full executive assistant',()=>{
 const r=inspectCycle({state:state(),receipt:receipt(),now:NOW,packetsCount:4,
  companyProfiles:{companies:[]},grantReport:{timestamp:'2026-11-14T21:20:00Z'},
  sourceEvidence:{status:'SHA256_MATCHED'}});
 assert.equal(r.ledger_status,'VALID_LOCAL_CYCLE');
 assert.equal(r.expectation_met,false);
 assert.equal(r.source_classes.generic_checklists,2);
 assert.equal(r.source_classes.grant_candidates,1);
 assert.equal(r.source_classes.registered_projects,1);
 assert.equal(r.capabilities.actual_external_email_sends,false);
 assert.equal(r.capabilities.actual_configuration_changes,false);
 assert.equal(r.capabilities.actual_government_submissions,false);
 assert.match(r.assessment,/scheduled evidence organizer/);
});
test('tampered status, unauthorized action, and mismatched receipts fail closed',()=>{
 const a=state();a.outbound_permissions={...ZERO,email_sent:1};
 const r=inspectCycle({state:a,receipt:receipt(),now:NOW});
 assert.equal(r.ledger_status,'HOLD_INVALID_LEDGER');
 assert.match(r.errors.join(','),/unsupported nonzero/);
 const b=state();b.active_items=999;
 assert.equal(inspectCycle({state:b,receipt:receipt(),now:NOW}).ledger_status,'HOLD_INVALID_LEDGER');
 const c=state();c.items[2].executed_externally=true;
 assert.equal(inspectCycle({state:c,receipt:receipt(),now:NOW}).ledger_status,'HOLD_INVALID_LEDGER');
 const d=state();d.cycle_utc='2026-11-14T21:00:00Z';
 assert.equal(inspectCycle({state:d,receipt:receipt(),now:NOW}).ledger_status,'HOLD_INVALID_LEDGER');
});
test('no cycle never claims automatic execution',()=>{
 const r=inspectCycle({state:null,receipt:null,now:NOW});
 assert.equal(r.ledger_status,'HOLD_MISSING_STATE_OR_RECEIPT');
 assert.equal(r.expectation_met,false);
});
test('stale cycles and grant snapshots are labeled, not portrayed as fresh',()=>{
 const s=state(),receiptData=receipt();
 s.cycle_utc=receiptData.cycle_utc='2026-11-12T21:39:00Z';
 const r=inspectCycle({state:s,receipt:receiptData,now:NOW,packetsCount:0});
 assert.equal(r.ledger_status,'VALID_LOCAL_CYCLE');
 assert.match(r.warnings.join(' '),/overdue/);
 assert.equal(r.grants.scan_age_hours,null);
 assert.equal(r.grants.source_sha256,'NOT_VERIFIED');
});
test('real source hash is checked against the raw CSV bytes, without remote fetch',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fun54-audit-'));const root=join(dir,'exec'),grants=join(dir,'grants');
 try{
  await mkdir(root);await mkdir(join(grants,'evidence'),{recursive:true});
  await mkdir(join(root,'packets'));
  const raw='id,title\\n1,source test\\n';
  const hash=createHash('sha256').update(raw).digest('hex');
  const evidenceFile=join(grants,'evidence','grants-offered-'+hash+'.csv');
  await writeFile(evidenceFile,raw);
  await writeFile(join(root,'state-v1.json'),JSON.stringify(state()));
  await writeFile(join(root,'last-cycle-v1.json'),JSON.stringify(receipt()));
  await writeFile(join(grants,'last-run.json'),JSON.stringify({source_sha256:hash,evidence_file:evidenceFile,timestamp:'2026-11-14T21:20:00Z'}));
  const r=await collectAudit({root,grantRoot:grants,now:NOW});
  assert.equal(r.ledger_status,'VALID_LOCAL_CYCLE');
  assert.equal(r.grants.source_sha256,'SHA256_MATCHED');
  await writeFile(evidenceFile,'tampered');
  const bad=await collectAudit({root,grantRoot:grants,now:NOW});
  assert.equal(bad.grants.source_sha256,'SHA256_MISMATCH');
  assert.ok(bad.warnings.some(s=>s.includes('Official grants CSV bytes not verified')));
 }finally{await rm(dir,{force:true,recursive:true})}
});
test('old or unverified company profiles remain visibly incomplete',()=>{
 const r=inspectCycle({state:state(),receipt:receipt(),now:NOW,companyProfiles:{companies:[
  {id:'fun',verified_state_status:'confirmed',verified_registered_address:'verified'},
  {id:'elektron',verified_state_status:null,verified_registered_address:null}
 ]}});
 assert.equal(r.companies_with_verifiable_registration,1);
 assert.match(r.warnings.join(' '),/Both company profiles/);
});
