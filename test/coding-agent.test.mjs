import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {validateCodingPaths,validateCodingTask,codingEvidenceRecord,createCodingAgent} from '../src/coding-agent.mjs';

test('path allowlist never admits traversal, secrets, symlinks or dependency paths by syntax',()=>{
 assert.deepEqual(validateCodingPaths(['src/logic.mjs','test/logic.test.mjs']),['src/logic.mjs','test/logic.test.mjs']);
 for(const x of ['../other.js','/tmp/a.js','C:\\private\\file.js','.env','src/private.key',
   'src/node_modules/evil.js','src/../other.js','src/credentials.json','src/a.exe','a.js/../b.js'])
   assert.throws(()=>validateCodingPaths([x]),/invalid|protected|unsupported|path/);
 assert.throws(()=>validateCodingPaths([]),/one or two/);
 assert.throws(()=>validateCodingPaths(['a.js','b.js','c.js']),/one or two/);
});
test('bounded task permits fix requests but refuses obvious command injection or secrets',()=>{
 assert.equal(validateCodingTask('Fix source scoring based on existing tests'),'Fix source scoring based on existing tests');
 for(const s of ['/run powershell', 'run', 'password:1234 Fix the code bug','a'.repeat(801)])
   assert.throws(()=>validateCodingTask(s),/invalid|secrets/);
});
test('coding receipt is scoped to isolated worktree and makes no success claim',()=>{
 const record=codingEvidenceRecord({files:['src/code.mjs'],task:'Fix missing edge in source',baseCommit:'abc',sessionId:'def'});
 assert.equal(record.kind,'isolated-coding-candidate-v1');
 assert.equal(record.tests_run,false);
 assert.equal(record.candidate_status,'not_qualified');
 assert.equal(record.WHO,undefined);
});
async function fixture(fn){
 const dir=await mkdtemp(path.join(tmpdir(),'fi-aider-isolated-'));
 try{
  await mkdir(path.join(dir,'.git'));
  await mkdir(path.join(dir,'src'));
  await writeFile(path.join(dir,'src','logic.mjs'),'export const n = 1;\n');
  return await fn(dir);
 }finally{await rm(dir,{recursive:true,force:true})}
}
async function invoke(agent,method,endpoint,data){
 let statusCode,response;
 await agent({method},{writeHead(status){statusCode=status},end(s){response=JSON.parse(s)}},endpoint,data);
 return {statusCode,response};
}
test('GET status is non-mutating and dedicated Aider defaults to unavailable',()=>fixture(async dir=>{
 let calls=0;
 const agent=createCodingAgent({root:dir,modelPort:8088,baseDir:path.join(dir,'absent'),
   execFile:async()=>{calls++;throw Error('MUST_NOT_RUN')}});
 const {statusCode,response}=await invoke(agent,'GET','/api/unified/coding/status');
 assert.equal(statusCode,200);
 assert.equal(response.installed,false);
 assert.equal(response.mode,'on-demand');
 assert.equal(calls,0);
}));
test('prepare returns an approval token without spawning an executable',()=>fixture(async dir=>{
 let calls=0;
 const agent=createCodingAgent({root:dir,modelPort:8088,baseDir:path.join(dir,'dedicated'),
   execFile:async()=>{calls++;throw Error('MUST_NOT_RUN')}});
 const preview=await invoke(agent,'POST','/api/unified/coding/intent',
   {task:'Fix test regression in src/logic.mjs',files:['src/logic.mjs']});
 assert.equal(preview.statusCode,200);
 assert.equal(preview.response.state,'approval_required');
 assert.equal(preview.response.approval_token.length,32);
 assert.equal(calls,0);
 const invalid=await invoke(agent,'POST','/api/unified/coding/approve',
  {approve:true,intent_id:preview.response.intent_id,approval_token:'0'.repeat(32)});
 assert.equal(invalid.statusCode,400);
 assert.equal(calls,0);
 const unapproved=await invoke(agent,'POST','/api/unified/coding/approve',
   {intent_id:preview.response.intent_id,approval_token:preview.response.approval_token});
 assert.equal(unapproved.statusCode,400);
 assert.equal(calls,0);
}));
test('out-of-repo symlinks are rejected without running any coding operation',()=>fixture(async dir=>{
 const ext=path.join(tmpdir(),'fi-code-external-'+Date.now()+'.js');
 try{
  await writeFile(ext,'export const secret=1');
  try{await import('node:fs/promises').then(fs=>fs.symlink(ext,path.join(dir,'src','unsafe.js')))}
  catch(e){if(['EPERM','ENOSYS','EACCES'].includes(e.code))return;throw e}
  const agent=createCodingAgent({root:dir,modelPort:8088});
  const req=await invoke(agent,'POST','/api/unified/coding/intent',
   {task:'Fix the unsafe.js source logic',files:['src/unsafe.js']});
  assert.equal(req.statusCode,400);
 }finally{await rm(ext,{force:true})}
}));
