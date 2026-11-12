import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAdaptiveIncidentBudget} from '../src/resource-aware/adaptive-incident-budget.mjs';
const grant=(headroomMiB,grantedMiB=128)=>({state:'GRANT',reason:'TARGET_MET',reserveMiB:3197,headroomMiB,requestedMiB:128,grantedMiB});
test('adapts 78 MiB headroom to a 70 MiB ceiling while preserving 8 MiB host margin',()=>{
 const result=chooseAdaptiveIncidentBudget(grant(78,78),52);
 assert.equal(result.state,'GRANT');assert.equal(result.grantedMiB,70);assert.equal(result.reason,'ADAPTIVE_REDUCED_BUDGET');
});
test('does not raise a grant beyond the original RAEM admission',()=>{
 const result=chooseAdaptiveIncidentBudget(grant(100,68),48);
 assert.equal(result.state,'GRANT');assert.equal(result.grantedMiB,68);
});
test('retains full 128 MiB when memory is available',()=>{
 const result=chooseAdaptiveIncidentBudget(grant(400),55);
 assert.equal(result.grantedMiB,128);
});
test('holds when measured process RSS plus margin exceeds safe headroom',()=>{
 const result=chooseAdaptiveIncidentBudget(grant(78,78),70);
 assert.equal(result.state,'HOLD');assert.equal(result.reason,'INSUFFICIENT_ADAPTIVE_MARGIN');assert.equal(result.grantedMiB,0);
});
test('does not override an existing CPU or memory hold',()=>{
 const x=chooseAdaptiveIncidentBudget({...grant(400,0),state:'HOLD',reason:'CPU_PRESSURE'},50);
 assert.equal(x.state,'HOLD');assert.equal(x.reason,'CPU_PRESSURE');
});
test('rejects unsafe options and malformed snapshot',()=>{
 assert.throws(()=>chooseAdaptiveIncidentBudget(grant(78,78),-1),/INVALID/);
 assert.throws(()=>chooseAdaptiveIncidentBudget(grant(78,78),50,{hostMarginMiB:-1}),/INVALID/);
 assert.throws(()=>chooseAdaptiveIncidentBudget({state:'GRANT',reserveMiB:3197,headroomMiB:78},50),/INVALID/);
});
