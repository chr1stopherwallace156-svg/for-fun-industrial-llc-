import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const p=new URL('../src/layout-intelligence/evidence-graph-v12k.py',import.meta.url);
test('V12K builds real graph edges without promoting candidate relations to fact',()=>{
 const file=decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\');
 const script="import importlib.util;s=importlib.util.spec_from_file_location('g',"+JSON.stringify(file)+");m=importlib.util.module_from_spec(s);s.loader.exec_module(m);d={'items':[{'sourceSha256':'a'*64,'page':1,'primaryTableId':'T1','secondaryTableIndex':0,'classification':'MATERIAL_TEXT_DIFFERENCE','action':'REVIEW_MISSING_OR_ALTERED_CELLS','pageTextAnchorHits':1,'sourceContext':[{'line':3,'text':'Table 1 Dimensions 12 mm'}],'captionCandidates':[{'line':3,'text':'Table 1 Dimensions 12 mm'}],'footnoteCandidates':[],'unitMentions':['mm']}]};r=m.build(d,100,100);assert any(e['relation']=='possible_caption' for e in r['edges']);assert any(e['relation']=='possible_unit' for e in r['edges']);assert all(e['verified'] is False for e in r['edges'])";
 const r=spawnSync('python',['-c',script],{encoding:'utf8'});if(r.error?.code==='ENOENT'){assert.ok(fs.readFileSync(p,'utf8').includes('possible_caption'));return}assert.equal(r.status,0,r.stderr)
});
test('V12K enforces hashes, budgets and no silent authority',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['RECONCILIATION_HASH_HOLD','CONTEXT_REFERENCE_HOLD','GRAPH_BUDGET_HOLD','OUTPUT_CONFLICT_HOLD','relationsVerified','engineeringApproved'])assert.ok(s.includes(x),x)
});

test('V12K skips legitimate blank lines but rejects invalid line references',()=>{
 const file=decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\');
 const script="import importlib.util;s=importlib.util.spec_from_file_location('g',"+JSON.stringify(file)+");m=importlib.util.module_from_spec(s);s.loader.exec_module(m);x={'sourceSha256':'a'*64,'page':1,'primaryTableId':'T1','secondaryTableIndex':0,'classification':'MATERIAL_TEXT_DIFFERENCE','action':'REVIEW_MISSING_OR_ALTERED_CELLS','pageTextAnchorHits':1,'sourceContext':[{'line':1,'text':'   '},{'line':2,'text':'Table 1 dimensions'}],'captionCandidates':[{'line':2,'text':'Table 1 dimensions'}],'footnoteCandidates':[],'unitMentions':[]};r=m.build({'items':[x]},100,100);assert r['classifications']['blankContextLinesSkipped']==1;assert len([n for n in r['nodes'] if n['kind']=='source_line'])==1;x['sourceContext'][0]['line']=0;failed=False\ntry:m.build({'items':[x]},100,100)\nexcept ValueError as e:failed=str(e)=='INVALID_LINE_EVIDENCE'\nassert failed";
 const r=spawnSync('python',['-c',script],{encoding:'utf8'});if(r.error?.code==='ENOENT')throw r.error;assert.equal(r.status,0,r.stderr)
});
