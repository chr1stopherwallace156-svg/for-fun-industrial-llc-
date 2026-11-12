import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,rm,link,symlink,truncate,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createVerifiedBinaryLayoutV32,probeApprovedLayoutBinary} from '../src/experimental/verified-binary-layout-v3-2.mjs';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
import {createUnifiedChatServer} from '../scripts/Run-Fun-Unified-Chat8798.mjs';
import {diagnoseV32} from '../scripts/Diagnose-Fun-Verified-Binary-V32.mjs';

const REA='http://127.0.0.1:8797';
const TOKEN='ac'.repeat(24);
const mockProof=()=>({
 path:'C:\\FunIndustrial-Approved-Inputs\\safe.exe',
 name:'safe.exe',bytes:8,sha256:'a'.repeat(64),fileIdentity:'17:401',format:'PE',
 root:'C:\\FunIndustrial-Approved-Inputs'
});
function fixture(){
 let now=10000,proof=mockProof(),callCount=0;
 const tools=Array.from({length:229},(_,i)=>({
  name:i===0?'inspect_binary_layout':'rea_other_'+i,
  description:'Static binary layout inspection',
  inputSchema:i===0?{type:'object',required:['path'],
   properties:{path:{type:'string'}},additionalProperties:false}:
   {type:'object',properties:{},required:[]}
 }));
 const state={rea:{liveMcpHealth:'ready',realReaToolCount:229},tools:{tools},
  response:{tool:'inspect_binary_layout',result:{isError:false,
   structuredContent:{file:'safe.exe',analysis:'observed'}}}};
 const calls=[];
 const request=async(url,body)=>{
  calls.push({url,body});
  if(url===REA+'/api/rea229/status')return state.rea;
  if(url===REA+'/api/rea229/tools?limit=229')return state.tools;
  if(url===REA+'/api/rea229/call'){
   callCount++;
   return state.response;
  }
  throw Error('V32_UNEXPECTED_ROUTE_'+url);
 };
 const probe=async()=>({...proof});
 const engine=()=>createVerifiedBinaryLayoutV32({request,probe,clock:()=>now,tokenFactory:()=>TOKEN,root:proof.root});
 return {engine,request,probe,calls,state,tick:n=>{now+=n},callsCount:()=>callCount,
  setProof:p=>{proof={...p}}};
}
test('V3.2 preflight is exactly two read-only catalogue queries, no files and no MCP calls',async()=>{
 const f=fixture(),v=f.engine();
 const result=await v.preflight();
 assert.equal(result.state,'schema_compatible_file_not_probed');
 assert.equal(result.tool,'inspect_binary_layout');
 assert.equal(result.executionCount,0);
 assert.equal(result.specificProvider,'unverified');
 assert.deepEqual(f.calls.map(x=>x.url),[
  REA+'/api/rea229/status',REA+'/api/rea229/tools?limit=229']);
 assert.equal(v.status().preparationPending,false);
});
test('prepare binds exact path, full file sha256, schema and single-use token without calling MCP',async()=>{
 const f=fixture(),v=f.engine();
 const r=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
 assert.equal(r.state,'awaiting_separate_operator_confirmation');
 assert.equal(r.executionCount,0);
 assert.equal(r.preview.name,'inspect_binary_layout');
 assert.equal(r.preview.file.sha256,'a'.repeat(64));
 assert.equal(r.preview.args.path,mockProof().path);
 assert.equal(r.preview.schemaHash.length,64);
 assert.equal(r.preview.argumentsHash.length,64);
 assert.equal(r.token,TOKEN);
 assert.equal(r.preview.providerReadiness,'rea_mcp_ready_specific_provider_unverified');
 assert.equal(f.callsCount(),0);
});
test('one separate confirmation executes exactly one named MCP tool with authorized path',async()=>{
 const f=fixture(),v=f.engine();
 const a=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
 await assert.rejects(v.confirm({token:a.token}),/SEPARATE_OPERATOR_APPROVAL_REQUIRED/);
 await assert.rejects(v.confirm({token:'cd'.repeat(24),operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 const r=await v.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(r.state,'verified_static_inspection');
 assert.equal(r.executionCount,1);
 assert.equal(r.receipt.fileSha256Before,r.receipt.fileSha256After);
 assert.equal(r.receipt.fileIdentityVerified,true);
 assert.equal(r.receipt.evidenceEnvelopeVerified,true);
 assert.equal(r.receipt.analysisContentAccuracyVerified,false);
 assert.equal(r.receipt.automaticRetries,0);
 assert.equal(f.callsCount(),1);
 assert.deepEqual(f.calls.at(-1),{
  url:REA+'/api/rea229/call',
  body:{name:'inspect_binary_layout',arguments:{path:mockProof().path}}
 });
 await assert.rejects(v.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 assert.equal(f.callsCount(),1);
});
test('schema drift, count drift and catalogue duplicate prevent a call after authorization',async()=>{
 for(const modify of [
  state=>{state.tools.tools[0].inputSchema.description='new meaning'},
  state=>{state.rea.realReaToolCount=228},
  state=>{state.tools.tools[1].name='inspect_binary_layout'}
 ]){
  const f=fixture(),v=f.engine(),a=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
  modify(f.state);
  const r=await v.confirm({token:a.token,operatorConfirmed:true});
  assert.equal(r.state,'preflight_hold_no_call');
  assert.equal(r.executionCount,0);
  assert.equal(f.callsCount(),0);
 }
});
test('invalid schema constraints fail closed before inspection',async()=>{
 for(const change of [
  t=>{t.inputSchema.required=['path','mode']},
  t=>{t.inputSchema.properties.path.type='integer'},
  t=>{t.inputSchema.properties.path.pattern='.*'},
  t=>{t.inputSchema.anyOf=[{type:'object'}]},
  t=>{t.inputSchema.properties.path.minLength=-1},
  t=>{t.inputSchema.properties.path.maxLength=0}
 ]){
  const f=fixture(),v=f.engine();change(f.state.tools.tools[0]);
  await assert.rejects(v.preflight(),/V32_/);
  assert.equal(f.callsCount(),0);
 }
});
test('non-allowlisted tools cannot be prepared and cancel never submits calls',async()=>{
 const f=fixture(),v=f.engine();
 await assert.rejects(v.prepare({name:'close_binary',filePath:'safe.exe'}),/NOT_ALLOWLISTED/);
 const a=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
 const r=v.cancel();
 assert.equal(r.state,'cancelled_no_execution');
 await assert.rejects(v.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 assert.equal(f.callsCount(),0);
});
test('expiry is enforced and cannot be replayed',async()=>{
 const f=fixture(),v=f.engine();
 const a=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
 f.tick(120001);
 await assert.rejects(v.confirm({token:a.token,operatorConfirmed:true}),/APPROVAL_EXPIRED/);
 await assert.rejects(v.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 assert.equal(f.callsCount(),0);
});
test('changed file hash or file identity blocks before REA submission',async()=>{
 for(const changed of [{...mockProof(),sha256:'b'.repeat(64)},{...mockProof(),fileIdentity:'17:999'}]){
  const f=fixture(),v=f.engine(),a=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
  f.setProof(changed);
  const r=await v.confirm({token:a.token,operatorConfirmed:true});
  assert.equal(r.state,'preflight_hold_no_call');
  assert.equal(r.requestSubmitted,false);
  assert.equal(f.callsCount(),0);
 }
});
test('file changed after submission prevents a verified receipt despite matching MCP envelope',async()=>{
 const f=fixture(),v=f.engine();
 let times=0;
 const probe=async()=>{times++;return times===3?{...mockProof(),sha256:'c'.repeat(64)}:mockProof()};
 const run=createVerifiedBinaryLayoutV32({request:f.request,probe,tokenFactory:()=>TOKEN,root:mockProof().root});
 const a=await run.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
 const r=await run.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(r.state,'result_hold_manual_review');
 assert.equal(r.receipt.fileIdentityVerified,false);
 assert.equal(r.receipt.fileChangedOrUnverifiable,true);
 assert.equal(r.executionCount,'unverified');
 assert.equal(f.callsCount(),1);
});
test('provider MCP error or different result name cannot be called verified success',async()=>{
 for(const data of [
  {tool:'some_other_tool',result:{isError:false,structuredContent:{some:'data'}}},
  {tool:'inspect_binary_layout',result:{isError:true,content:[{type:'text',text:'fail'}]}},
  {tool:'inspect_binary_layout',result:{}}
 ]){
  const f=fixture(),v=f.engine();f.state.response=data;
  const a=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
  const r=await v.confirm({token:a.token,operatorConfirmed:true});
  assert.equal(r.state,'result_hold_manual_review');
  assert.equal(r.executionCount,'unverified');
  assert.equal(f.callsCount(),1);
 }
});
test('non-error response without evidence is a manual HOLD',async()=>{
 const f=fixture(),v=f.engine();
 f.state.response={tool:'inspect_binary_layout',result:{isError:false}};
 const a=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
 const r=await v.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(r.state,'result_hold_manual_review');
 assert.equal(r.receipt.evidenceEnvelopeVerified,false);
});
test('opaque transport failure is unknown and never retried',async()=>{
 const f=fixture(),v=createVerifiedBinaryLayoutV32({
  request:async(url,body)=>url===REA+'/api/rea229/call'?Promise.reject(Error('socket closed')):f.request(url,body),
  probe:f.probe,tokenFactory:()=>TOKEN,root:mockProof().root
 });
 const a=await v.prepare({name:'inspect_binary_layout',filePath:'safe.exe'});
 const r=await v.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(r.state,'outcome_unknown_do_not_retry');
 assert.equal(r.executionCount,'unknown');
 assert.equal(r.manualVerificationRequired,true);
 await assert.rejects(v.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
});
test('file probe rejects missing, nested, outside, wrong extension, and fake non-binary',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'fi-v31-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const good=path.join(root,'known.exe');
 await writeFile(good,Buffer.from([0x4d,0x5a,0x90,0,1,2,3,4]));
 const r=await probeApprovedLayoutBinary('known.exe',{root});
 assert.equal(r.format,'PE');assert.equal(r.bytes,8);assert.equal(r.sha256.length,64);
 assert.equal(r.path,await realpath(good));
 for(const bad of ['missing.exe','known.txt','../known.exe','folder/known.exe',good+'.evil']){
  await assert.rejects(probeApprovedLayoutBinary(bad,{root}),/V32_/);
 }
 await writeFile(path.join(root,'fake.exe'),Buffer.from([1,2,3,4,5]));
 await assert.rejects(probeApprovedLayoutBinary('fake.exe',{root}),/NOT_PE_OR_ELF_STATIC_BINARY/);
 await writeFile(path.join(root,'valid.elf'),Buffer.from([0x7f,0x45,0x4c,0x46,1,2]));
 const elf=await probeApprovedLayoutBinary('valid.elf',{root});
 assert.equal(elf.format,'ELF');
});
test('staged file probe rejects hardlinks and symlinks, if supported by the test host',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'fi-v31-links-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const f=path.join(root,'original.exe'),hard=path.join(root,'hard.exe'),symbolic=path.join(root,'sym.exe');
 await writeFile(f,Buffer.from([0x4d,0x5a,0,0,1,1]));
 await link(f,hard);
 await assert.rejects(probeApprovedLayoutBinary('hard.exe',{root}),/NOT_SINGLE_REGULAR_FILE/);
 try{
  await symlink(f,symbolic,'file');
  await assert.rejects(probeApprovedLayoutBinary('sym.exe',{root}),/NOT_SINGLE_REGULAR_FILE|TARGET_REDIRECTED/);
 }catch(e){
  if(!['EPERM','EACCES','ENOSYS'].includes(e.code))throw e;
 }
});
test('file >64MiB is refused before any bytes are hashed',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'fi-v31-size-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const file=path.join(root,'huge.exe');
 await writeFile(file,Buffer.from([0x4d,0x5a,0,0]));
 await truncate(file,64*1024*1024+1);
 await assert.rejects(probeApprovedLayoutBinary('huge.exe',{root}),/SIZE_OUTSIDE_LIMIT/);
});
test('diagnostic is inert unless explicitly requested',()=>{
 const file=fileURLToPath(new URL('../scripts/Diagnose-Fun-Verified-Binary-V32.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:12000});
 assert.equal(p.status,0,p.stderr);assert.match(p.stdout,/V32_DIAG=INACTIVE/);
});
test('schema-only diagnostic makes exactly two read-only requests and opens no file',async()=>{
 const f=fixture(),lines=[];
 const out=await diagnoseV32({request:f.request,write:s=>lines.push(s)});
 assert.equal(out.state,'schema_compatible_file_not_probed');
 assert.ok(lines.includes('V32_SCHEMA_PREFLIGHT=PASS'));
 assert.ok(lines.includes('V32_FILES_OPENED=0 MCP_CALLS=0 APPROVAL_GRANTED=false'));
 assert.equal(f.callsCount(),0);
 assert.equal(f.calls.length,2);
});
test('same-origin V3.2 HTTP prepare and confirm require independent authorization',async()=>{
 const f=fixture();
 const app=createUnifiedTaskChat({request:f.request});
 // The real HTTP app's V3.2 probe would require a staged file; this test
 // uses an injected narrow facade, not a live filesystem and not a tool.
 const engine=f.engine();
 const facade={
  ...app,
  verifiedLayoutStatus:()=>engine.status(),
  prepareVerifiedLayout:b=>engine.prepare(b),
  confirmVerifiedLayout:b=>engine.confirm(b),
  cancelVerifiedLayout:()=>engine.cancel()
 };
 const server=createUnifiedChatServer({app:facade,readClient:async()=>''});
 await new Promise((ok,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ok)});
 async function post(route,body,auth=true){
  const raw=JSON.stringify(body);
  return new Promise((ok,reject)=>{
   const req=http.request({hostname:'127.0.0.1',port:server.address().port,
    path:route,method:'POST',headers:{host:'127.0.0.1:8798',
     'content-type':'application/json',
     ...(auth?{origin:'http://127.0.0.1:8798','x-fi-unified':'operator-click'}:{})}},
    res=>{let result='';res.on('data',x=>result+=x);
     res.on('end',()=>ok({status:res.statusCode,body:JSON.parse(result)}))});
   req.once('error',reject);req.end(raw);
  });
 }
 try{
  const body={name:'inspect_binary_layout',filePath:'safe.exe'};
  assert.equal((await post('/api/unified/v3.2/prepare',body,false)).status,403);
  assert.equal((await post('/api/unified/v3.2/prepare',{...body,secret:true})).status,422);
  const a=await post('/api/unified/v3.2/prepare',body);
  assert.equal(a.status,200);
  assert.equal(f.callsCount(),0);
  assert.equal((await post('/api/unified/v3.2/confirm',{token:a.body.token,operatorConfirmed:false})).status,422);
  assert.equal(f.callsCount(),0);
  const done=await post('/api/unified/v3.2/confirm',{token:a.body.token,operatorConfirmed:true});
  assert.equal(done.status,200);
  assert.equal(done.body.state,'verified_static_inspection');
  assert.equal(f.callsCount(),1);
  assert.equal((await post('/api/unified/v3.2/confirm',{token:a.body.token,operatorConfirmed:true})).status,422);
 }finally{await new Promise(ok=>server.close(ok))}
});
