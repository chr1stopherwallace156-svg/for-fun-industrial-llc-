import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const p=new URL('../src/layout-intelligence/text-position-v12m.py',import.meta.url);
test('V12M calculates bounded above/below/within word geometry',()=>{
 const file=decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\');
 const script="import importlib.util;s=importlib.util.spec_from_file_location('m',"+JSON.stringify(file)+");m=importlib.util.module_from_spec(s);s.loader.exec_module(m);w=[{'text':'caption','x0':0,'x1':30,'top':5,'bottom':10},{'text':'cell','x0':0,'x1':30,'top':25,'bottom':30},{'text':'note','x0':0,'x1':30,'top':45,'bottom':50},{'text':'far','x0':100,'x1':120,'top':5,'bottom':10}];r=m.context(w,[0,20,40,40],20);assert {x['position'] for x in r['candidates']}=={'ABOVE','WITHIN_TABLE_REGION','BELOW'};assert m.validbox([1,1,0,2]) is None;assert m.context(w,None,10)['state']=='NO_TABLE_BBOX'";
 const r=spawnSync('python',['-c',script],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr)
});
test('V12M source hash, selective pages, cache and no semantic promotion',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['PDF_HASH_HOLD','SOURCE_CHAIN_HOLD','PAGE_BUDGET_HOLD','CACHE_PROVENANCE_HOLD','OUTPUT_CONFLICT_HOLD','captionScopeVerified','unitBindingVerified','engineeringApproved'])assert.ok(s.includes(x),x)
});
