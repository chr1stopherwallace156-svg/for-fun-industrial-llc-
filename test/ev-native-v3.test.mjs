import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const native=resolve('src/ev-conversion/native-wireviz-v3.mjs');
const v2=resolve('src/ev-conversion/prototype-v2.mjs');
function rootCase(fn){
 const root=mkdtempSync(join(tmpdir(),'fi-native-v3-'));
 try{
  const local=join(root,'local'),pf=join(root,'pf');
  mkdirSync(local);mkdirSync(pf);
  const env={...process.env,LOCALAPPDATA:local,ProgramFiles:pf,'ProgramFiles(x86)':pf};
  const run=(script,args)=>spawnSync(process.execPath,[script,...args],{env,cwd:resolve('.'),encoding:'utf8',timeout:8000});
  fn({root,local,pf,run});
 }finally{rmSync(root,{recursive:true,force:true})}
}
test('probe is read-only and clearly not a native qualification',()=>{
 rootCase(({local,run})=>{
  const r=run(native,['probe']);assert.equal(r.status,0,r.stderr);
  const data=JSON.parse(r.stdout);
  assert.equal(data.scope,'FUN_INDUSTRIAL_ONLY');
  assert.equal(data.execution,'NONE');
  assert.equal(data.installed_and_qualified,false);
  assert.equal(data.tools.wireviz.state,'NOT_FOUND_IN_SCOPED_PATHS');
  assert.equal(existsSync(join(local,'FunIndustrial')),false);
 });
});
test('probe finds scoped native candidates and hashes without executing them',()=>{
 rootCase(({local,pf,run})=>{
  const bin=join(local,'FunIndustrial','EVEngineering','Tools','WireViz','venv','Scripts');
  mkdirSync(bin,{recursive:true});writeFileSync(join(bin,'wireviz.exe'),'fake');
  const gv=join(pf,'Graphviz','bin');
  mkdirSync(gv,{recursive:true});writeFileSync(join(gv,'dot.exe'),'fake');
  const r=run(native,['probe']);assert.equal(r.status,0,r.stderr);
  const j=JSON.parse(r.stdout);
  assert.match(j.tools.wireviz.matches[0].sha256,/^[a-f0-9]{64}$/);
  assert.match(j.tools.graphviz.matches[0].sha256,/^[a-f0-9]{64}$/);
  assert.equal(j.tools.freecad.state,'NOT_FOUND_IN_SCOPED_PATHS');
 });
});
test('render rejects nonexistent tools or missing approval hashes before external execution',()=>{
 rootCase(({local,run})=>{
  const project=join(local,'FunIndustrial','EVEngineering','Prototypes');
  mkdirSync(project,{recursive:true});
  let r=run(native,['render','bench-a','bad','bad']);
  assert.notEqual(r.status,0);assert.match(r.stderr,/OPERATOR_HASHES_REQUIRED_HOLD/);
  r=run(v2,['demo','bench-a']);assert.equal(r.status,0,r.stderr);
  const f='0'.repeat(64);r=run(native,['render','bench-a',f,f]);
  assert.notEqual(r.status,0);assert.match(r.stderr,/PINNED_NATIVE_TOOL_UNAVAILABLE_HOLD/);
  assert.equal(existsSync(join(project,'bench-a','native-wireviz-v3')),false);
 });
});
test('render rejects altered V2 input and invalid project IDs',()=>{
 rootCase(({local,run})=>{
  const p=join(local,'FunIndustrial','EVEngineering','Prototypes');
  mkdirSync(p,{recursive:true});
  assert.equal(run(v2,['demo','bench-b']).status,0);
  const r=run(native,['render','../bad','0'.repeat(64),'0'.repeat(64)]);
  assert.notEqual(r.status,0);assert.match(r.stderr,/BAD_ID_HOLD/);
 });
});
