import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const source=resolve('src/ev-conversion/freecad-preflight-v8.mjs');
const v2=resolve('src/ev-conversion/prototype-v2.mjs');
function fixture(fn){
 const local=mkdtempSync(join(tmpdir(),'fun-v8-')),id='fixture-bench';
 const env={...process.env,LOCALAPPDATA:local};
 const run=(file,...args)=>spawnSync(process.execPath,[file,...args],{env,encoding:'utf8',timeout:8000});
 try{
  const demo=run(v2,'demo',id);assert.equal(demo.status,0,demo.stderr);
  const root=join(local,'FunIndustrial','EVEngineering','Prototypes',id);
  fn({id,root,run});
 }finally{rmSync(local,{recursive:true,force:true});}
}
test('preflight validates source geometry and does not execute FreeCAD or write files',()=>{
 fixture(x=>{
  const r=x.run(source,'preflight',x.id);
  assert.equal(r.status,0,r.stderr);
  const v=JSON.parse(r.stdout);
  assert.equal(v.schema,'fun.ev.freecad.preflight.v8');
  assert.deepEqual(v.dimensions_mm,{width:120,depth:80,thickness:4});
  assert.equal(v.holes_checked,2);
  assert.ok(v.expected_volume_mm3>0&&v.expected_volume_mm3<38400);
  assert.equal(v.freecad_executed,false);
  assert.equal(v.files_written,0);
  assert.equal(v.engineering_approved,false);
 });
});
test('altered macro bytes fail even if the file still parses',()=>{
 fixture(x=>{
  const p=join(x.root,'output','bench-plate.FCMacro');
  writeFileSync(p,readFileSync(p,'utf8')+'\n');
  const r=x.run(source,'preflight',x.id);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/MACRO_DIGEST_HOLD/);
 });
});
test('changed input dimensions fail SHA evidence lineage',()=>{
 fixture(x=>{
  const p=join(x.root,'prototype.json');
  writeFileSync(p,readFileSync(p,'utf8').replace('"width_mm": 120','"width_mm": 121'));
  const r=x.run(source,'preflight',x.id);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/INPUT_DIGEST_HOLD/);
 });
});
test('bad project identifiers and unknown project fail closed',()=>{
 fixture(x=>{
  for(const id of ['../escape','missing']){
   const r=x.run(source,'preflight',id);
   assert.notEqual(r.status,0);
   assert.match(r.stderr,/FUN_EV_V8_.*_HOLD/);
  }
 });
});
test('preflight does not accept an arbitrary injected macro after manifest rehash',()=>{
 fixture(x=>{
  const p=join(x.root,'output','bench-plate.FCMacro');
  const m=join(x.root,'output','manifest.json');
  const macro=readFileSync(p,'utf8')+'\nprint("untrusted extra")\n';
  writeFileSync(p,macro);
  const manifest=JSON.parse(readFileSync(m,'utf8'));
  const {createHash}=requireShim();
  const entry=manifest.files.find(v=>v.name==='bench-plate.FCMacro');
  entry.sha256=createHash('sha256').update(macro).digest('hex');
  entry.size_bytes=Buffer.byteLength(macro);
  writeFileSync(m,JSON.stringify(manifest));
  const r=x.run(source,'preflight',x.id);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/MACRO_SOURCE_MISMATCH_HOLD/);
 });
});
function requireShim(){return {createHash:hash};}
import {createHash as hash} from 'node:crypto';
