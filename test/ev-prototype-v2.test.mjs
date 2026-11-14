import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const entry=resolve('src/ev-conversion/prototype-v2.mjs');
function sandbox(fn){
 const root=mkdtempSync(join(tmpdir(),'fun-ev-v2-'));
 try{fn(root);}finally{rmSync(root,{recursive:true,force:true});}
}
function run(root,...args){return spawnSync(process.execPath,[entry,...args],{
 cwd:resolve('.'),env:{...process.env,FUN_EV_V2_ROOT:root},encoding:'utf8',timeout:8000});
}
test('prepare creates editable bench inputs, but no CAD output or external processes',()=>{
 sandbox(root=>{
  const r=run(root,'prepare','bench-a');assert.equal(r.status,0,r.stderr);
  const p=join(root,'bench-a');
  assert.ok(existsSync(join(p,'prototype.json')));
  assert.equal(existsSync(join(p,'output')),false);
  assert.equal(JSON.parse(r.stdout).external_tools_executed,0);
 });
});
test('demo produces FreeCAD macro, WireViz YAML and pinout CSV with hash manifest',()=>{
 sandbox(root=>{
  let r=run(root,'demo','bench-a');assert.equal(r.status,0,r.stderr);
  const out=join(root,'bench-a','output');
  const macro=readFileSync(join(out,'bench-plate.FCMacro'),'utf8');
  const yaml=readFileSync(join(out,'bench-harness.yml'),'utf8');
  assert.match(macro,/Part\.makeBox\(120, 80, 4\)/);
  assert.match(macro,/Part\.makeCylinder\(3, 4,/);
  assert.match(yaml,/connectors:\n  X1:/);assert.match(yaml,/cables:\n  W1:/);
  assert.match(yaml,/    - X1: \[1, 2\]/);
  assert.match(readFileSync(join(out,'bench-pinout.csv'),'utf8'),/NOT_ENGINEER_REVIEWED/);
  const m=JSON.parse(readFileSync(join(out,'manifest.json'),'utf8'));
  assert.equal(m.engineering_approved,false);assert.equal(m.high_voltage_work_authorized,false);
  r=run(root,'inspect','bench-a');assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(r.stdout).files_verified,3);
 });
});
test('explicit input dimensions are respected and unknown/injected fields rejected',()=>{
 sandbox(root=>{
  assert.equal(run(root,'prepare','sample').status,0);
  const f=join(root,'sample','prototype.json');
  const data=JSON.parse(readFileSync(f,'utf8'));
  data.plate.width_mm=160;data.plate.holes[1].x_mm=130;
  writeFileSync(f,JSON.stringify(data));
  let r=run(root,'export','sample');assert.equal(r.status,0,r.stderr);
  assert.match(readFileSync(join(root,'sample','output','bench-plate.FCMacro'),'utf8'),/Part\.makeBox\(160, 80, 4\)/);
 });
 sandbox(root=>{
  assert.equal(run(root,'prepare','sample').status,0);
  const f=join(root,'sample','prototype.json'),data=JSON.parse(readFileSync(f,'utf8'));
  data.harness.x1_pinlabels[0]='BAD: yaml';writeFileSync(f,JSON.stringify(data));
  const r=run(root,'export','sample');assert.notEqual(r.status,0);
  assert.match(r.stderr,/PIN_LABELS_HOLD/);
 });
});
test('unsafe geometry and duplicate overwrites fail closed',()=>{
 sandbox(root=>{
  assert.equal(run(root,'prepare','bench').status,0);
  const f=join(root,'bench','prototype.json'),data=JSON.parse(readFileSync(f,'utf8'));
  data.plate.holes[0].x_mm=1;writeFileSync(f,JSON.stringify(data));
  assert.notEqual(run(root,'export','bench').status,0);
  assert.equal(existsSync(join(root,'bench','output')),false);
 });
 sandbox(root=>{
  assert.equal(run(root,'demo','bench').status,0);
  assert.notEqual(run(root,'demo','bench').status,0);
  assert.notEqual(run(root,'export','bench').status,0);
 });
});
test('output/input tampering is independently detected',()=>{
 sandbox(root=>{
  assert.equal(run(root,'demo','bench').status,0);
  const f=join(root,'bench','output','bench-harness.yml');
  writeFileSync(f,'corrupt');
  const r=run(root,'inspect','bench');
  assert.notEqual(r.status,0);assert.match(r.stderr,/HASH_MISMATCH_HOLD/);
 });
});
test('path traversal and symlink-backed project roots are refused',t=>{
 sandbox(root=>{
  assert.notEqual(run(root,'demo','../escape').status,0);
  assert.notEqual(run(root,'demo','Bad Name').status,0);
 });
 const root=mkdtempSync(join(tmpdir(),'fun-ev-link-'));
 const other=mkdtempSync(join(tmpdir(),'fun-ev-target-'));
 try{
  const link=join(root,'outside');
  try{symlinkSync(other,link,'dir');}
  catch(e){if(process.platform==='win32'&&['EPERM','EACCES','UNKNOWN'].includes(e.code)){
   t.skip('Windows symlink creation requires additional privileges');return;
  }throw e;}
  const r=run(link,'demo','bench');
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/UNSAFE_DIRECTORY_HOLD/);
 }finally{rmSync(root,{recursive:true,force:true});rmSync(other,{recursive:true,force:true});}
});
