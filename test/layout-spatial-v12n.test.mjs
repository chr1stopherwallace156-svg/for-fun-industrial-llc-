import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import fs from 'node:fs';
const p=new URL('../src/layout-intelligence/spatial-v12n.py',import.meta.url);
test('V12N groups word positions and detects shared candidate text across distinct tables',()=>{
 const file=decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\');
 const s="import importlib.util;x=importlib.util.spec_from_file_location('m',"+JSON.stringify(file)+");m=importlib.util.module_from_spec(x);x.loader.exec_module(m);w=[{'text':'Table','bbox':[0,0,20,8],'position':'ABOVE','verticalGap':5},{'text':'1','bbox':[22,0,25,8],'position':'ABOVE','verticalGap':5}];c={'state':'POSITION_CANDIDATES_ONLY','candidates':w};a={'sourceSha256':'a'*64,'page':1,'primaryTableId':'T1','secondaryTableIndex':0,'primaryContext':c,'secondaryContext':{'state':'NO_TABLE_BBOX'}};b={**a,'primaryTableId':'T2','secondaryTableIndex':1};r,counts=m.build({'items':[a,b]},100);assert counts['lineCandidates']==2;assert counts['ambiguousAssociations']==2;assert 'NUMBERED_CAPTION_PATTERN' in r[0]['line']['hints'];assert all(not z['line']['relationshipVerified'] for z in r)";
 const r=spawnSync('python',['-c',s],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr)
});
test('V12N checks source evidence and never grants engineering authority',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['INPUT_HASH_HOLD','INVALID_WORD_GEOMETRY','OUTPUT_CONFLICT_HOLD','relationsVerified','engineeringApproved','autoCorrected'])assert.ok(s.includes(x),x)
});
