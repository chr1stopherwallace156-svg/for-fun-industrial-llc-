import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePilotArgs,evaluateLivePilotReadiness,LIVE_CONFIRMATION,exactOperatorConfirmation} from '../src/resource-aware/catalogue-live-gate.mjs';
import {evaluateAdmission} from '../src/resource-aware/raem.mjs';

const snapshot={totalMiB:15981,freeMiB:3237,cpuBusyPct:4.64};
test('dry-run is the only default mode, live must be explicitly selected',()=>{
 assert.equal(parsePilotArgs([]),'dry-run');
 assert.equal(parsePilotArgs(['--dry-run']),'dry-run');
 assert.equal(parsePilotArgs(['--live']),'live');
});
test('unknown command arguments cannot activate live access',()=>{
 for(const flags of [['--live','--dry-run'],['--live=1'],['live'],['--auto'],['--live','--live']])
  assert.throws(()=>parsePilotArgs(flags),/RAEM009_ARGS_INVALID/);
});
test('operator confirmation demands an exact, non-empty phrase',()=>{
 assert.equal(exactOperatorConfirmation(LIVE_CONFIRMATION),true);
 for(const answer of [undefined,null,'','yes','AUTHORIZE','AUTHORIZE ONE PUBLIC CATALOGUE GET '])
  assert.equal(exactOperatorConfirmation(answer),false);
});
test('low-headroom snapshot retains conservative 20 percent live reserve',()=>{
 const result=evaluateLivePilotReadiness(snapshot,57.09);
 assert.equal(result.state,'HOLD');
 assert.equal(result.reserveMiB,3197);
 assert.equal(result.reason,'LIVE_PILOT_PREFLIGHT_MARGIN');
 assert.equal(result.grantedMiB,0);
 assert.equal(result.liveFloorMiB,3261);
});
test('sufficient host memory permits one bounded manual request',()=>{
 const result=evaluateLivePilotReadiness({...snapshot,freeMiB:4000},57);
 assert.equal(result.state,'GRANT');
 assert.equal(result.grantedMiB,128);
 assert.equal(result.liveFloorMiB,3261);
 assert.equal(result.profile,'CONSERVATIVE_MANUAL_LIVE_ONLY');
});
test('dangerous CPU load is still held with ample RAM',()=>{
 const result=evaluateLivePilotReadiness({...snapshot,freeMiB:7000,cpuBusyPct:95},57);
 assert.equal(result.state,'HOLD');assert.equal(result.reason,'CPU_PRESSURE');
});
test('baseline Node process RSS cannot exceed granted budget',()=>{
 const result=evaluateLivePilotReadiness({...snapshot,freeMiB:4000},124);
 assert.equal(result.state,'HOLD');
 assert.equal(result.reason,'INSUFFICIENT_ADAPTIVE_MARGIN');
});
test('never replaces the RAEM production policy with synthetic balanced policy',()=>{
 const result=evaluateAdmission(snapshot,{id:'public_catalogue',minimumMiB:64,targetMiB:128,maximumMiB:128});
 assert.equal(result.state,'HOLD');
 assert.equal(result.reserveMiB,3197);
});
test('one-shot CLI source protects default no-network and interactive confirmation',async()=>{
 const source=await readFile(new URL('../scripts/Qualify-Fun-RAEM009.mjs',import.meta.url),'utf8');
 assert.match(source,/if\(mode==='dry-run'\)/);
 assert.match(source,/if\(!exactOperatorConfirmation\(answer\)\)/);
 assert.match(source,/!process\.stdin\.isTTY\|\|!process\.stdout\.isTTY/);
 assert.match(source,/const again=await sampleHost/);
 assert.match(source,/new CatalogueSnapshotStore/);
 assert.match(source,/checkPublicCatalogue\(/);
 assert.doesNotMatch(source,/setInterval|setTimeout\(/);
});
test('live pilot uses the fixed catalogue adapter rather than arbitrary URLs',async()=>{
 const source=await readFile(new URL('../scripts/Qualify-Fun-RAEM009.mjs',import.meta.url),'utf8');
 assert.match(source,/CATALOGUE_URL/);
 assert.doesNotMatch(source,/\bfetch\(/);
 assert.match(source,/NO_BACKGROUND_TIMER/);
});
