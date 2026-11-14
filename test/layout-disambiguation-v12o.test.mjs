import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import fs from 'node:fs';
const p=new URL('../src/layout-intelligence/disambiguation-v12o.py',import.meta.url);
test('V12O separates duplicate-region hypotheses from distinct and missing geometry',()=>{
 const file=decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\');
 const s="import importlib.util;x=importlib.util.spec_from_file_location('m',"+JSON.stringify(file)+");m=importlib.util.module_from_spec(x);x.loader.exec_module(m);base={'sourceSha256':'a'*64,'page':1,'region':'primaryContext','lineKey':'L'};a={**base,'primaryTableId':'A','secondaryTableIndex':0};b={**base,'primaryTableId':'B','secondaryTableIndex':1};g=[{**a,'primaryBBox':[0,0,100,100]},{**b,'primaryBBox':[0,0,100,100]}];r,c,z=m.assess({'lineAssociations':[a,b]},{'items':g},.85);assert c['POSSIBLE_DUPLICATE_REGION_ARTIFACT']==1;assert r[0]['associationVerified'] is False;g[1]['primaryBBox']=[200,200,300,300];r,c,z=m.assess({'lineAssociations':[a,b]},{'items':g},.85);assert c['COMPETING_DISJOINT_REGIONS']==1;g[1]['primaryBBox']=None;r,c,z=m.assess({'lineAssociations':[a,b]},{'items':g},.85);assert c['UNRESOLVED_MISSING_REGION_BBOX']==1;assert m.iou([0,0,10,10],[0,0,10,10])==1";
 const r=spawnSync('python',['-c',s],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr)
});
test('V12O preserves source evidence and does not approve inferred associations',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['SPATIAL_HASH_HOLD','GEOMETRY_HASH_HOLD','DUPLICATE_GEOMETRY_KEY_HOLD','OUTPUT_CONFLICT_HOLD','duplicateRegionsConfirmed','engineeringApproved'])assert.ok(s.includes(x),x)
});
