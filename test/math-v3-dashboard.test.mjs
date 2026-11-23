import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {researchV3Snapshot,researchV3Evidence,researchV3Candidates} from '../src/math/math-report-bridge-v3.mjs';
import {MATH_V3_HTML} from '../src/ui/math-v3-page.mjs';
import {DASHBOARD_HTML} from '../src/ui/oneport-dashboard-v1.mjs';
import {FISRE_QWEN_CHAT_HTML} from '../src/ui/fisre-qwen-chat-v4.mjs';

const hash='a'.repeat(64);
const candidate=(n)=>({name:`candidate_${n}`,terms:[['hot25',0.2]],validation_mean_log_gain:-0.0001,
  historical_test_mean_log_gain:-0.0001,validation_rank_score:-0.0041});
function report(){return {system:'Fun Industrial',version:'fun-math-research-v3',authority:'statistical_research_only',
  conclusion:'NO_VERIFIED_PREDICTIVE_EDGE', services_touched:0,tool_executions:0,ticket_purchases:0,
  elektron_touched:false, draws:2559,equations_generated_per_era:138, sha256:hash,
  candidate_set_sha256:hash,last:'2026-11-20',stale:false,utc:'2026-11-22T20:00:00+00:00',
  eras:{'2025':{status:'HISTORICAL_MODEL_SCREEN_NOT_PROOF',equations_generated:138,draws:168,
    models_positive_on_validation:3,models_positive_on_historical_test:1,
    selected:'FAIR_RANDOM_BASELINE',validation_best:{validation_mean_log_gain:-.1},selected_test_mean_log_gain:null}},
  prospective:{state:'FROZEN_AWAITING_GENUINELY_FUTURE_DRAWINGS',frozen_after_draw:'2026-11-20',
     family_size:5,future_scored:0,mixture_evalue:1,anytime_evidence_threshold:20}};}

async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'fi-v3-'));try{return await fn(root)}finally{await rm(root,{force:true,recursive:true})}}

test('report and all 138 scores are read only and bounded',()=>fixture(async root=>{
 await writeFile(join(root,'latest_report.json'),JSON.stringify(report()));
 await writeFile(join(root,'candidate_ledger.json'),JSON.stringify({version:'fun-math-research-v3',source_sha256:hash,
   eras:{'2025':Array.from({length:138},(_,i)=>candidate(i))}}));
 const data=await researchV3Snapshot({root});
 assert.equal(data.ready,true);assert.equal(data.modelCanExecute,false);
 assert.equal(data.equationsPerEra,138);assert.equal(data.elektronTouched,false);
 const context=researchV3Evidence(data);
 assert.ok(context.length<2900);assert.ok(context.includes('No verified predictive edge'));
 const table=await researchV3Candidates('2025',{root});
 assert.equal(table.ready,true);assert.equal(table.rows.length,138);
}));

test('missing, forged or tampered report holds all evidence',()=>fixture(async root=>{
 assert.equal((await researchV3Snapshot({root})).ready,false);
 await writeFile(join(root,'latest_report.json'),'garbage');
 assert.equal((await researchV3Snapshot({root})).ready,false);
 const poisoned=report();poisoned.tool_executions=1;
 await writeFile(join(root,'latest_report.json'),JSON.stringify(poisoned));
 const d=await researchV3Snapshot({root});
 assert.equal(d.ready,false);assert.throws(()=>researchV3Evidence(d));
}));

test('candidate ledger missing/changed source cannot be silently trusted',()=>fixture(async root=>{
 await writeFile(join(root,'latest_report.json'),JSON.stringify(report()));
 assert.equal((await researchV3Candidates('2025',{root})).ready,false);
 await writeFile(join(root,'candidate_ledger.json'),JSON.stringify({version:'fun-math-research-v3',source_sha256:'b'.repeat(64),
 eras:{'2025':Array.from({length:138},(_,i)=>candidate(i))}}));
 assert.equal((await researchV3Candidates('2025',{root})).ready,false);
 assert.equal((await researchV3Candidates('../../etc/passwd',{root})).ready,false);
}));

test('one-port V3 UI is linked while old Qwen UI remains available',()=>{
 assert.ok(DASHBOARD_HTML.includes('href="/math/v3/"'));
 assert.ok(MATH_V3_HTML.includes('/api/fun/math/v3/client.js'));
 assert.ok(MATH_V3_HTML.includes('fi-v3-ask'));
 assert.ok(FISRE_QWEN_CHAT_HTML.includes('fi-fial53-math-v3-evidence'));
});