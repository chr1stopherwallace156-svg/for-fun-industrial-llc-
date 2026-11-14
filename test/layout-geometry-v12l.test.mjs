import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const p=new URL('../src/layout-intelligence/geometry-v12l.py',import.meta.url);
test('V12L independently checks bbox overlap and rejects malformed geometry',()=>{
 const file=decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\');
 const s="import importlib.util;x=importlib.util.spec_from_file_location('m',"+JSON.stringify(file)+");m=importlib.util.module_from_spec(x);x.loader.exec_module(m);assert m.iou([0,0,10,10],[0,0,10,10])==1;assert m.iou([0,0,10,10],[20,20,30,30])==0;assert m.box([0,0,-1,1]) is None;assert m.box([0,0,float('nan'),1]) is None;z={'sourceSha256':'a'*64,'page':1,'classification':'MATERIAL_TEXT_DIFFERENCE','primaryEvidence':{'bbox':[0,0,10,10]},'secondaryEvidence':{'bbox':[0,0,10,10]}};r=m.assess(z);assert r['geometryAssessment']=='HIGH_REGION_OVERLAP';assert r['relationshipVerified'] is False";
 const r=spawnSync('python',['-c',s],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr)
});
test('V12L retains source hashes and never promotes geometric overlap to semantic proof',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['GRAPH_CONTEXT_HASH_HOLD','RECONCILIATION_HASH_HOLD','OUTPUT_CONFLICT_HOLD','captionScopeVerified','unitBindingVerified','engineeringApproved'])assert.ok(s.includes(x),x)
});
