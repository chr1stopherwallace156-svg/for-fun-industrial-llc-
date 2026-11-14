import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,mkdirSync,symlinkSync,rmSync} from "node:fs";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
const script=resolve("src/ev-conversion/cli.mjs");
function run(root,...args){return spawnSync(process.execPath,[script,...args],
 {cwd:resolve("."),env:{...process.env,FUN_EV_WORKSPACE_ROOT:root},encoding:"utf8",timeout:8000})}
test("catalog is actual reference metadata, never auto-installed",()=>{
 const root=mkdtempSync(join(tmpdir(),"fun-ev-cat-"));
 try{const r=run(root,"catalog");assert.equal(r.status,0);const x=JSON.parse(r.stdout);
 assert.ok(x.tools.length>=15);assert.ok(x.tools.some(t=>t.id==="wireviz"));
 assert.ok(x.tools.some(t=>t.id==="freecad"))}finally{rmSync(root,{recursive:true,force:true})}
});
test("read-only status reports no execution authority",()=>{
 const root=mkdtempSync(join(tmpdir(),"fun-ev-read-"));
 try{const r=run(root,"status");assert.equal(r.status,0);const x=JSON.parse(r.stdout);
 assert.equal(x.external_executions,0);assert.equal(x.installed_and_qualified,false);
 assert.equal(x.state,"STAGED_ONLY")}finally{rmSync(root,{recursive:true,force:true})}
});
test("explicit init yields unapproved workspace, verify; repeat refuses overwrite",()=>{
 const root=mkdtempSync(join(tmpdir(),"fun-ev-work-"));
 try{let r=run(root,"init","e450-concept");assert.equal(r.status,0,r.stderr);
 const p=JSON.parse(readFileSync(join(root,"e450-concept","project.json"),"utf8"));
 assert.equal(p.production_released,false);assert.equal(p.high_voltage_work_authorized,false);
 r=run(root,"verify","e450-concept");assert.equal(r.status,0,r.stderr);
 assert.equal(JSON.parse(r.stdout).state,"STRUCTURE_OK_ENGINEERING_HOLD");
 r=run(root,"init","e450-concept");assert.notEqual(r.status,0);
 assert.match(r.stderr,/EV_PROJECT_EXISTS_HOLD/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test("reject invalid and traversing project names",()=>{
 const root=mkdtempSync(join(tmpdir(),"fun-ev-path-"));
 try{
  let r=run(root,"init","../bad");assert.notEqual(r.status,0);
  r=run(root,"init","Not Valid");assert.notEqual(r.status,0);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test("reject symlink-backed destination when host permits creating symlinks",(t)=>{
 const root=mkdtempSync(join(tmpdir(),"fun-ev-link-"));
 const other=mkdtempSync(join(tmpdir(),"fun-ev-other-"));
 try{
  const link=join(root,"linked");
  try{symlinkSync(other,link,"dir")}
  catch(err){
   if(process.platform==="win32"&&["EPERM","EACCES","UNKNOWN"].includes(err.code)){
    t.skip("Windows symlink privilege unavailable; no filesystem policy weakened");
    return;
   }
   throw err;
  }
  const r=run(link,"init","test");assert.notEqual(r.status,0);
  assert.match(r.stderr,/EV_UNSAFE_PATH_HOLD/);
 }finally{rmSync(root,{recursive:true,force:true});rmSync(other,{recursive:true,force:true})}
});
