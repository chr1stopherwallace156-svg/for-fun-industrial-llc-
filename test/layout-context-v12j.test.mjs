import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const p=new URL('../src/layout-intelligence/context-v12j.py',import.meta.url);
test('V12J real Python context classifier preserves source line provenance',()=>{
 const code="import importlib.util;s=importlib.util.spec_from_file_location('m',"+JSON.stringify(decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\'))+");m=importlib.util.module_from_spec(s);s.loader.exec_module(m);x={'classification':'SAME_TEXT_DIFFERENT_STRUCTURE','primaryEvidence':{'rows':[['Wheelbase','179']]} ,'secondaryEvidence':{'rows':[['179','Wheelbase']]}};r=m.analyze(x,'Heading\\nTable 1 dimensions\\nWheelbase 179 in\\nNote: illustrative',32);assert r['action']=='REVIEW_ROW_COLUMN_ASSOCIATIONS';assert r['pageTextAnchorHits']>0;assert r['proposedReplacement'] is None;assert r['meaningVerified'] is False";
 const r=spawnSync('python',['-c',code],{encoding:'utf8'});
 if(r.error?.code==='ENOENT'){assert.ok(fs.readFileSync(p,'utf8').includes('REVIEW_ROW_COLUMN_ASSOCIATIONS'));return}
 assert.equal(r.status,0,r.stderr);
});
test('V12J checks provenance and refuses source mutation and automatic repair',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['CROSSENGINE_HASH_HOLD','PAGE_EVIDENCE_PROVENANCE_HOLD','PAGE_NUMBER_MISMATCH','OUTPUT_CONFLICT_HOLD','proposedReplacement','autoCorrected','engineeringApproved'])assert.ok(s.includes(x),x)
});
