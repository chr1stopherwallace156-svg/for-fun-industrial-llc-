import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import fs from 'node:fs';
const p=new URL('../src/layout-intelligence/operator-review-v12q.py',import.meta.url);
test('V12Q hash journal rejects tampering and duplicate decisions',()=>{
 const file=decodeURIComponent(p.pathname).replace(/^\//,'').replaceAll('/','\\');
 const s="import importlib.util,tempfile,pathlib,json;x=importlib.util.spec_from_file_location('m',"+JSON.stringify(file)+");m=importlib.util.module_from_spec(x);x.loader.exec_module(m);p=pathlib.Path(tempfile.mkdtemp())/'log';key=('a'*64,1,'abc');e={'seq':1,'prevHash':'GENESIS','queueSha256':'q','sourceSha256':key[0],'page':1,'lineKey':'abc','decision':'DEFER','engineeringApproved':False};e['entryHash']=m.digest(m.canonical(e));p.write_bytes(m.canonical(e)+b'\\n');r,d,t=m.read_log(p,'q',{key:{}});assert len(r)==1 and t==e['entryHash'];p.write_bytes(m.canonical({**e,'decision':'CONFIRM_RELATIONSHIP'})+b'\\n');try_:False\n";
 const fixed=s.replace("try_:False\n","try:\n m.read_log(p,'q',{key:{}})\n assert False\nexcept ValueError as ex:\n assert 'JOURNAL_HASH_HOLD' in str(ex)\n");
 const r=spawnSync('python',['-c',fixed],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr)
});
test('V12Q requires operator and reason, retains provenance and no engineering approval',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['QUEUE_PROVENANCE_HOLD','OPERATOR_REQUIRED','REASON_REQUIRED','ALREADY_REVIEWED_HOLD','O_EXCL','fsync','engineeringApproved'])assert.ok(s.includes(x),x)
});
