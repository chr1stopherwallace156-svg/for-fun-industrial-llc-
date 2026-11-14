import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const p=new URL('../src/layout-intelligence/operator-review-v12q.py',import.meta.url);
function run(script){
 const r=spawnSync('python',['-c',script],{encoding:'utf8'});
 if(r.error)throw r.error;
 assert.equal(r.status,0,r.stderr);
}
const loader="import importlib.util,tempfile,pathlib\n"+"spec=importlib.util.spec_from_file_location('m',"+JSON.stringify(fileURLToPath(p))+")\n"+"m=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\n";
test('V12Q detects tampering and duplicate decisions',()=>{
 run(loader+[
 "p=pathlib.Path(tempfile.mkdtemp())/'journal'",
 "key=('a'*64,1,'abc')",
 "e={'seq':1,'prevHash':'GENESIS','queueSha256':'q','sourceSha256':key[0],'page':1,'lineKey':'abc','decision':'DEFER','engineeringApproved':False}",
 "e['entryHash']=m.digest(m.canonical(e))",
 "p.write_bytes(m.canonical(e)+bytes([10]))",
 "r,d,t=m.read_log(p,'q',{key:{}})",
 "assert len(r)==1 and t==e['entryHash']",
 "p.write_bytes(m.canonical({**e,'decision':'CONFIRM_RELATIONSHIP'})+bytes([10]))",
 "try:",
 " m.read_log(p,'q',{key:{}})",
 " raise AssertionError('Tampering accepted')",
 "except ValueError as ex:",
 " assert 'JOURNAL_HASH_HOLD' in str(ex)",
 "second={**e,'seq':2,'prevHash':e['entryHash']}",
 "second['entryHash']=m.digest(m.canonical(second))",
 "p.write_bytes(m.canonical(e)+bytes([10])+m.canonical(second)+bytes([10]))",
 "try:",
 " m.read_log(p,'q',{key:{}})",
 " raise AssertionError('Duplicate accepted')",
 "except ValueError as ex:",
 " assert 'DUPLICATE_DECISION_HOLD' in str(ex)"
 ].join('\n'));
});
test('V12Q rejects incomplete journal',()=>{
 run(loader+[
 "p=pathlib.Path(tempfile.mkdtemp())/'journal'",
 "p.write_bytes(b'{}')",
 "try:",
 " m.read_log(p,'q',{})",
 " raise AssertionError('Incomplete accepted')",
 "except ValueError as ex:",
 " assert 'INCOMPLETE_JOURNAL_HOLD' in str(ex)"
 ].join('\n'));
});
test('V12Q requires operator and reason, retains provenance and no engineering approval',()=>{
 const s=fs.readFileSync(p,'utf8');
 for(const x of ['QUEUE_PROVENANCE_HOLD','OPERATOR_REQUIRED','REASON_REQUIRED','ALREADY_REVIEWED_HOLD','O_EXCL','fsync','engineeringApproved'])assert.ok(s.includes(x),x);
});
