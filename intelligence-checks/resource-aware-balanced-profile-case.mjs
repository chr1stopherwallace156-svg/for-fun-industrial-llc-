import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSyntheticBalancedAdmission,SYNTHETIC_BALANCED_POLICY,SYNTHETIC_LIVE_MARGIN_MIB,SYNTHETIC_PRECHECK_MARGIN_MIB} from '../src/resource-aware/synthetic-admission-profile.mjs';
const snap={totalMiB:15981,freeMiB:3256,cpuBusyPct:0.76};
test('last Windows snapshot grants 128 MiB under isolated balanced profile',()=>{
  const result=evaluateSyntheticBalancedAdmission(snap,56.38);
  assert.equal(result.state,'GRANT');assert.equal(result.grantedMiB,128);
  assert.equal(result.reserveMiB,2048);assert.equal(result.runtimeFreeFloorMiB,2304);
  assert.equal(result.admissionProfile,'SYNTHETIC_BALANCED_ONLY');
});
test('baseline process memory is included in adaptive decision',()=>{
  const result=evaluateSyntheticBalancedAdmission(snap,124);
  assert.equal(result.state,'HOLD');assert.equal(result.reason,'INSUFFICIENT_ADAPTIVE_MARGIN');
});
test('extra preflight host headroom is required above reserve',()=>{
  const result=evaluateSyntheticBalancedAdmission({...snap,freeMiB:2559},56.38);
  assert.equal(result.state,'HOLD');assert.equal(result.reason,'BENCHMARK_HEADROOM_GUARD');
});
test('at or beyond CPU ceiling, holds despite available memory',()=>{
  const result=evaluateSyntheticBalancedAdmission({...snap,cpuBusyPct:90},56.38);
  assert.equal(result.state,'HOLD');assert.equal(result.reason,'CPU_PRESSURE');
});
test('never grants more than 128 MiB',()=>{
  const result=evaluateSyntheticBalancedAdmission({...snap,freeMiB:12000},56.38);
  assert.equal(result.grantedMiB,128);
});
test('memory pressure in upstream admission stays on HOLD',()=>{
  const result=evaluateSyntheticBalancedAdmission({...snap,freeMiB:2100},56.38);
  assert.equal(result.state,'HOLD');assert.equal(result.grantedMiB,0);
});
test('profile preserves 2 GiB floor plus independent live and preflight guards',()=>{
  assert.equal(SYNTHETIC_BALANCED_POLICY.reserveMiB,2048);
  assert.equal(SYNTHETIC_LIVE_MARGIN_MIB,256);assert.equal(SYNTHETIC_PRECHECK_MARGIN_MIB,512);
  assert.equal(SYNTHETIC_BALANCED_POLICY.maxConcurrent,1);
});
test('rejects invalid resource snapshots rather than silently relaxing controls',()=>{
  assert.throws(()=>evaluateSyntheticBalancedAdmission({...snap,freeMiB:20000},56.38),/INVALID/);
});
