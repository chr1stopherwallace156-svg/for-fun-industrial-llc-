import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateAdmission} from '../src/resource-aware/raem.mjs';
import {evaluateSyntheticBalancedAdmission} from '../src/resource-aware/synthetic-admission-profile.mjs';
const latest={totalMiB:15981,freeMiB:3237,cpuBusyPct:4.64};
const baselineRssMiB=57.09;
const syntheticJob={id:'raem_catalogue_offline_demo',minimumMiB:64,targetMiB:128,maximumMiB:128};
test('last Windows snapshot fits isolated offline profile with 2 GiB reserve and 256 MiB live margin',()=>{
 const r=evaluateSyntheticBalancedAdmission(latest,baselineRssMiB);
 assert.equal(r.state,'GRANT');assert.equal(r.grantedMiB,128);
 assert.equal(r.reserveMiB,2048);assert.equal(r.runtimeFreeFloorMiB,2304);
 assert.equal(r.admissionProfile,'SYNTHETIC_BALANCED_ONLY');
});
test('RAEM default remains conservative for real workloads',()=>{
 const r=evaluateAdmission(latest,syntheticJob);
 assert.equal(r.state,'HOLD');assert.equal(r.reserveMiB,3197);
 assert.equal(r.reason,'MEMORY_PRESSURE');
});
test('offline profile refuses too little host free memory',()=>{
 const r=evaluateSyntheticBalancedAdmission({...latest,freeMiB:2559},baselineRssMiB);
 assert.equal(r.state,'HOLD');assert.equal(r.reason,'BENCHMARK_HEADROOM_GUARD');
});
test('offline profile refuses unsafe CPU pressure',()=>{
 const r=evaluateSyntheticBalancedAdmission({...latest,cpuBusyPct:80},baselineRssMiB);
 assert.equal(r.state,'HOLD');assert.equal(r.reason,'CPU_PRESSURE');
});
test('offline profile refuses worker baseline larger than target',()=>{
 const r=evaluateSyntheticBalancedAdmission(latest,124);
 assert.equal(r.state,'HOLD');assert.equal(r.reason,'INSUFFICIENT_ADAPTIVE_MARGIN');
});
test('offline runner injects a mocked response and uses the protected runtime floor',async()=>{
 const text=await readFile(new URL('../scripts/Qualify-Fun-RAEM008.mjs',import.meta.url),'utf8');
 assert.match(text,/evaluateSyntheticBalancedAdmission/);
 assert.match(text,/const fetchImpl=async url=>/);
 assert.match(text,/new Response\(JSON\.stringify\(active\)/);
 assert.match(text,/minimumHostFreeMiB:admission\.runtimeFreeFloorMiB/);
 assert.doesNotMatch(text,/\bfetch\(/);
});
