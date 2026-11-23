import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mathSnapshot,mathEvidence,MATH_VERSION} from '../src/math/math-report-bridge-v2.mjs';
import {MATH_HTML} from '../src/ui/math-research-v2.mjs';
import {DASHBOARD_HTML} from '../src/ui/oneport-dashboard-v1.mjs';
import {FISRE_QWEN_CHAT_HTML} from '../src/ui/fisre-qwen-chat-v4.mjs';

function fixture(){
 return {system:'Fun Industrial',version:'math-research-v2',authority:'statistical_research_only',
  draws:2559,sha256:'f'.repeat(64),last:'2026-11-20',source:'official_NY_data',
  stale:false,utc:'2026-11-22T00:00:00Z',equation_grammar:69,
  eras:{'2025':{status:'BASELINE_SELECTED',selected:'FAIR_RANDOM_BASELINE',
   test_mean_log_gain:0,test_p_uncorrected:null,corrected_across_eras_p:null}},
  future_protocol:{status:'FROZEN_WAITING_FOR_NEW_DRAWS',future_scored:0},
  tickets_or_bets:0,services_touched:0,elektron_touched:false};
}
test('validated local data produces bounded read-only report and Qwen evidence',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fimath-v2-'));
 try{
  await writeFile(join(root,'latest_report.json'),JSON.stringify(fixture()));
  const snap=await mathSnapshot({root});
  assert.equal(snap.state,'REPORT_VERIFIED_READONLY');
  assert.equal(snap.ready,true);
  assert.equal(snap.equations,69);
  assert.equal(snap.modelExecutesTools,false);
  assert.equal(snap.elektronTouched,false);
  const evidence=mathEvidence(snap);
  assert.ok(evidence.length<2950);
  assert.equal(JSON.parse(evidence).conclusion,'NO_VERIFIED_PREDICTIVE_EDGE');
 }finally{await rm(root,{recursive:true,force:true})}
});
test('missing, malformed, and forged reports fail closed',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fimath-v2-'));
 try{
  assert.equal((await mathSnapshot({root})).ready,false);
  await writeFile(join(root,'latest_report.json'),'bogus');
  assert.equal((await mathSnapshot({root})).ready,false);
  const poisoned=fixture();poisoned.services_touched=1;
  await writeFile(join(root,'latest_report.json'),JSON.stringify(poisoned));
  const h=await mathSnapshot({root});
  assert.equal(h.ready,false);
  assert.throws(()=>mathEvidence(h),/NOT_READY/);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('existing dashboard and Qwen chat expose operator-visible math integration',()=>{
 assert.ok(DASHBOARD_HTML.includes('href="/math/"'));
 assert.ok(MATH_HTML.includes('/api/fun/math/client.js'));
 assert.ok(MATH_HTML.includes('fi-math-ask'));
 assert.ok(FISRE_QWEN_CHAT_HTML.includes('fi-fial53-math-evidence'));
 assert.equal(MATH_VERSION,'fun-math-v2-readonly-8802');
});
