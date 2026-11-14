import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FRAMEWORKS,VERSION,selectFrameworks,planBusinessDecision,businessContextForQwen} from '../src/competence/business-knowledge-v5-6.mjs';
import {calculateFinancials,rankEvidenceBackedOptions} from '../src/competence/business-finance-v5-6.mjs';
import {newBusinessCase,transitionCase} from '../src/competence/business-workflow-v5-6.mjs';
import {reviewBusinessWriting} from '../src/competence/business-writing-v5-6.mjs';
import {inspectBusinessDocument,runValeCheck} from '../src/competence/optional-document-tools-v5-6.mjs';
import {runBusinessCompetenceCycle,readBusinessCompetenceStatus,OPERATOR_VERSION} from '../src/competence/business-operator-v5-6.mjs';
const NOW=new Date('2026-11-14T22:58:00.000Z');
const ZERO={email_sent:0,government_filings:0,spent_usd:0,rea_runs:0,source_patches:0,training_runs:0};
const row=(id,kind,source,title)=>({id,kind,source,title,company:'elektron',
 priority:90,required:['Verified primary documents'],phase:'prepare_local_packet',description:'Local operator task, not a completed action'});
const state=()=>({version:'fial5.4-executive-operator-v1',cycle_utc:NOW.toISOString(),
 items:[row('a'.repeat(22),'filings','operator_registered_unverified','Verify Victorville business license and filing status'),
 row('b'.repeat(22),'finance','operator_goal','Generic finance checklist'),
 row('c'.repeat(22),'sales','operator_registered_unverified','Prepare verified customer sales pipeline')],
 outbound_permissions:ZERO});
const receipt=()=>({version:'fial5.5-real-business-operations-v1',
 when_utc:NOW.toISOString(),government_filings:0,emails_sent:0,rea_executions:0,payments:0,applied_configs:0});
test('curated business knowledge covers strategy, finance, management, operations, writing and compliance',()=>{
 assert.equal(FRAMEWORKS.length,18);
 assert.equal(new Set(FRAMEWORKS.map(f=>f.id)).size,18);
 for(const domain of ['strategy','finance','management','operations','sales','compliance','communication'])
  assert.ok(FRAMEWORKS.some(f=>f.domain===domain));
 const selected=selectFrameworks('How can we improve pricing strategy, margins and cash runway?');
 assert.ok(selected.some(f=>f.domain==='finance')||selected.some(f=>f.domain==='strategy'));
 assert.ok(selected.every(f=>f.origin==='curated_business_methodology_not_company_evidence'));
 assert.match(businessContextForQwen('How do we improve gross margin?'),/Required evidence/);
 assert.equal(businessContextForQwen('zzzz utterly unrelated banana'), '');
});
test('strategy plans are evidence-bound and do not invent company data or approvals',()=>{
 const result=planBusinessDecision('Plan a go-to-market strategy for a fleet conversion pilot');
 assert.equal(result.version,VERSION);
 assert.equal(result.company,'ELEKTRON INDUSTRIAL LLC');
 assert.equal(result.decision_reached,false);
 assert.equal(result.external_action_authorized,false);
 assert.ok(result.needed_evidence.length>0);
 assert.throws(()=>planBusinessDecision('Plan an operations strategy',{company:'Unknown Corp'}),/ENTITY_NOT_AUTHORIZED/);
});
test('finance calculations use explicit numeric inputs and correct break-even math',()=>{
 const a=calculateFinancials({unit_price:100,unit_variable_cost:60,monthly_fixed_cost:1200,
 cash_available:24000,monthly_net_burn:4000,revenue:10000,
 cost_of_goods_sold:7500,initial_investment:5000,period_net_benefit:750});
 assert.equal(a.unit_economics.contribution_per_unit,40);
 assert.equal(a.unit_economics.monthly_break_even_units,30);
 assert.equal(a.unit_economics.contribution_margin_pct,40);
 assert.equal(a.cash_runway.months,6);
 assert.equal(a.gross_margin.margin_pct,25);
 assert.equal(a.investment_return.simple_period_roi_pct,15);
 assert.equal(a.actual_business_claim,false);
});
test('zero contribution, missing inputs and zero monthly burn never imply profit',()=>{
 const a=calculateFinancials({unit_price:100,unit_variable_cost:120,monthly_fixed_cost:600,
 cash_available:1000,monthly_net_burn:0});
 assert.equal(a.unit_economics.monthly_break_even_units,null);
 assert.equal(a.cash_runway.months,null);
 assert.equal(a.cash_runway.state,'HOLD_ZERO_BURN_NOT_AN_INFINITE_GUARANTEE');
 assert.equal(calculateFinancials().unit_economics.state,'HOLD_MISSING_VERIFIED_INPUTS');
 assert.throws(()=>calculateFinancials({unit_price:-1}),/FINANCE_VALUE_INVALID/);
});
test('options do not acquire scores with unverified or missing criteria',()=>{
 const a=rankEvidenceBackedOptions([{id:'option_a',evidence_quality:4,cost_feasibility:4,
 operational_feasibility:4,risk_control:3},{id:'option_b',evidence_quality:5}]);
 assert.equal(a[0].id,'option_a');
 assert.equal(a[1].score,null);
 assert.equal(a[1].state,'HOLD_MISSING_SCORING_INPUTS');
});
test('workflow transitions are stateful and cannot self-grant external execution',()=>{
 let c=newBusinessCase('case_123','Verify licensing obligations');
 assert.throws(()=>transitionCase(c,{to:'complete_with_receipt',actor:'system_local',evidence_sha256:'a'.repeat(64)}),/ILLEGAL_STATE_TRANSITION/);
 c=transitionCase(c,{to:'evidence_check',actor:'system_local',evidence_sha256:'a'.repeat(64)});
 c=transitionCase(c,{to:'draft',actor:'system_local',evidence_sha256:'a'.repeat(64)});
 c=transitionCase(c,{to:'operator_review',actor:'system_local',evidence_sha256:'a'.repeat(64)});
 assert.throws(()=>transitionCase(c,{to:'ready_for_approved_external_adapter',
  actor:'system_local',evidence_sha256:'a'.repeat(64),approval_id:'approval_confirmed'}),/EXPLICIT_REVIEW_REQUIRED/);
 c=transitionCase(c,{to:'ready_for_approved_external_adapter',
  actor:'operator_reviewed',evidence_sha256:'a'.repeat(64),approval_id:'approval_checked_123'});
 assert.equal(c.external_action_authorized_by_this_engine,false);
 assert.throws(()=>transitionCase(c,{to:'complete_with_receipt',actor:'system_local',
  evidence_sha256:'b'.repeat(64),receipt_id:'receipt_valid_123'}),/VERIFIED_RECEIPT_REQUIRED/);
 c=transitionCase(c,{to:'complete_with_receipt',actor:'verified_external_adapter',
  evidence_sha256:'b'.repeat(64),receipt_id:'receipt_checked_123'});
 assert.equal(c.state,'complete_with_receipt');
 assert.equal(c.external_action_authorized_by_this_engine,false);
});
test('business grammar heuristics flag unsupported claims and duplicate words',()=>{
 const a=reviewBusinessWriting('hello team,\nWe guarantee guaranteed funding and we we will succeed',
  {audience:'government'});
 assert.ok(a.issues.some(x=>x.code==='DUPLICATE_WORD'));
 assert.ok(a.issues.some(x=>x.code==='OPENING_CAPITALIZATION'));
 assert.ok(a.issues.some(x=>x.code==='MISSING_FINAL_PUNCTUATION'));
 assert.equal(a.truth_or_eligibility_verified,false);
 assert.equal(a.grammar_comprehensive,false);
 assert.equal(a.external_messages_sent,0);
});
test('optional Markdown and Vale adapter are bounded and do not rewrite source files',async()=>{
 const d=await mkdtemp(join(tmpdir(),'fi56-tool-'));
 try{
  const path=join(d,'draft.md');await writeFile(path,'# Business correspondence\nLocal text only.');
  const doc=await inspectBusinessDocument(path);
  assert.equal(doc.state,'LOCAL_MARKDOWN_READ');
  assert.match(doc.text,/Business correspondence/);
  const prior=await readFile(path,'utf8');
  const vale=await runValeCheck(path,{executable:'C:\\missingfial56\\vale.exe'});
  assert.match(vale.state,/^HOLD_VALE_/);
  assert.equal(await readFile(path,'utf8'),prior);
  await assert.rejects(inspectBusinessDocument('http://evil.invalid/sample.pdf'),/PATH_OR_EXTENSION_REFUSED/);
 }finally{await rm(d,{force:true,recursive:true})}
});
test('scheduled cycle reads real prior executive tasks and writes nonduplicated local methodology packets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fi56-cycle-'));
 try{
  await mkdir(join(root,'RealWorkV55'),{recursive:true});
  await writeFile(join(root,'state-v1.json'),JSON.stringify(state()));
  await writeFile(join(root,'RealWorkV55','last-real-cycle.json'),JSON.stringify(receipt()));
  const a=await runBusinessCompetenceCycle({root,now:NOW});
  assert.equal(a.version,OPERATOR_VERSION);
  assert.equal(a.eligible_tasks,2);
  assert.equal(a.packets_created,2);
  assert.equal(a.actions.mail_sent,0);
  assert.equal(a.actions.model_invocations,0);
  assert.equal(a.external_execution,'NOT_PERFORMED');
  const packets=await readdir(join(root,'BusinessCompetenceV56','packets'));
  assert.equal(packets.length,2);
  const first=join(root,'BusinessCompetenceV56','packets',packets[0]);
  const text=await readFile(first,'utf8');
  assert.match(text,/Decision: NOT REACHED/);
  await writeFile(first,'HUMAN REVIEW EDIT PRESERVED');
  const b=await runBusinessCompetenceCycle({root,now:new Date(+NOW+60000)});
  assert.equal(b.packets_created,0);
  assert.equal(await readFile(first,'utf8'),'HUMAN REVIEW EDIT PRESERVED');
  const status=await readBusinessCompetenceStatus({root});
  assert.equal(status.tracked_tasks,2);
 }finally{await rm(root,{force:true,recursive:true})}
});
test('tampered or missing real operational receipts block competence cycle',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fi56-hold-'));
 try{
  await mkdir(join(root,'RealWorkV55'),{recursive:true});
  await writeFile(join(root,'state-v1.json'),JSON.stringify(state()));
  await writeFile(join(root,'RealWorkV55','last-real-cycle.json'),JSON.stringify({
   ...receipt(),emails_sent:1
  }));
  await assert.rejects(runBusinessCompetenceCycle({root,now:NOW}),/UPSTREAM_RECEIPT_OR_POLICY_HOLD/);
 }finally{await rm(root,{force:true,recursive:true})}
});
