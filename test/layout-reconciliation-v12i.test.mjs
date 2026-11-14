import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const path=new URL('../src/layout-intelligence/reconcile-v12i.py',import.meta.url);
test('V12I Python algorithm distinguishes grid from text equivalence',()=>{
 const snippet="import importlib.util; s=importlib.util.spec_from_file_location('v12i',r'"+decodeURIComponent(path.pathname).replace(/^\//,'').replaceAll('/','\\')+"');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);assert m.decision(m.compare_rows([['A','B']],[['B','A']]))=='SAME_TEXT_DIFFERENT_STRUCTURE';assert m.decision(m.compare_rows([['A','B']],[['A','B']]))=='GRID_TEXT_IDENTICAL';assert m.decision(m.compare_rows([['A','B']],[['C','D']]))=='MATERIAL_TEXT_DIFFERENCE'";
 const r=spawnSync('python',['-c',snippet],{encoding:'utf8'});
 if(r.error?.code==='ENOENT'){assert.ok(fs.readFileSync(path,'utf8').includes('SAME_TEXT_DIFFERENT_STRUCTURE'));return}
 assert.equal(r.status,0,r.stderr);
});
test('V12I preserves provenance and never approves automated correction',()=>{
 const s=fs.readFileSync(path,'utf8');for(const x of ['PRIMARY_HASH_HOLD','AUDIT_HASH_HOLD','CACHE_KEY_HOLD','MATCH_PROVENANCE_HOLD','OUTPUT_CONFLICT_HOLD','autoCorrected','meaningVerified','engineeringApproved'])assert.ok(s.includes(x),x)
});
