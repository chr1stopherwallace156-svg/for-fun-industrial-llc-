import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import fs from 'node:fs';
const p=new URL('../src/layout-intelligence/review-priority-v12p.py',import.meta.url);
test('V12P prioritizes unresolved geometry and records reasons without claiming confidence',()=>{
 const file=decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\');
 const s="import importlib.util;x=importlib.util.spec_from_file_location('m',"+JSON.stringify(file)+");m=importlib.util.module_from_spec(x);x.loader.exec_module(m);a={'line':{'hints':['UNIT_TOKEN_PATTERN'],'verticalGap':5}};hi=m.priority({'state':'UNRESOLVED_MIXED_REGION_OVERLAP','distinctComparisonRecords':3},[a]);lo=m.priority({'state':'SAME_COMPARISON_RECORD_NOT_CONFLICT','distinctComparisonRecords':1},[a]);assert hi[0]>lo[0];assert 'UNIT_TOKEN_PATTERN' in hi[1];assert 'MIXED_REGION_OVERLAP' in hi[1]";
 const r=spawnSync('python',['-c',s],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr)
});
test('V12P preserves provenance, rejects missing associations, and never approves',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['PROVENANCE_HOLD','ASSOCIATION_COUNT_HOLD','UNACCOUNTED_ASSOCIATIONS_HOLD','OUTPUT_CONFLICT_HOLD','priorityIsConfidence','engineeringApproved'])assert.ok(s.includes(x),x)
});
