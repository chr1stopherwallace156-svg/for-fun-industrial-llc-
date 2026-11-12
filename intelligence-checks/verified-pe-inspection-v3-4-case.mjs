import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {createVerifiedPeInspectionV34,probeApprovedPeBinary,PE_TOOLS} from '../src/experimental/verified-pe-inspection-v3-4.mjs';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
import {diagnosePe34} from '../scripts/Diagnose-Fun-Verified-PE-V34.mjs';
import {createUnifiedChatServer} from '../scripts/Run-Fun-Unified-Chat8798.mjs';
const REA='http://127.0.0.1:8797',TOKEN='ba'.repeat(24);
const sample=()=>({path:'C:\\FunIndustrial-Approved-Inputs\\known.exe',
 name:'known.exe',sha256:'a'.repeat(64),bytes:65536,format:'PE',fileIdentity:'4:100',
 machine:0x8664,sections:7,optionalMagic:0x20b});
function fixture(){
 let now=1000,proof=sample(),calls=0,error=null;
 const tools=Array.from({length:229},(_,i)=>{
  const name=PE_TOOLS[i]??'rea_other_'+i;
  return {name,inputSchema:{type:'object',required:['path'],
   properties:{path:{type:'string'}},additionalProperties:false}};
 });
 const state={status:{liveMcpHealth:'ready',realReaToolCount:229},
  catalogue:{tools},result:{tool:'inspect_pe_imports',
   result:{isError:false,structuredContent:{imports:['SYNTHETIC_FUNCTION']}}}};
 const requests=[];
 const request=async(url,body)=>{
  requests.push({url,body});
  if(url===REA+'/api/rea229/status')return state.status;
  if(url===REA+'/api/rea229/tools?limit=229')return state.catalogue;
  if(url===REA+'/api/rea229/call'){calls++;if(error)throw Error(error);return state.result}
  throw Error('UNEXPECTED_ROUTE');
 };
 const probe=async()=>({...proof});
 const engine=()=>createVerifiedPeInspectionV34({
  request,probe,clock:()=>now,tokenFactory:()=>TOKEN,root:'C:\\FunIndustrial-Approved-Inputs'});
 return {engine,state,request,requests,probe,
  advance:ms=>now+=ms,setProof:p=>proof=p,setError:e=>error=e,calls:()=>calls};
}
test('V3.4 live schema diagnostic only issues ten catalogue/status GETs and no tool calls',async()=>{
 const f=fixture(),lines=[];const hashes=await diagnosePe34({request:f.request,write:s=>lines.push(s)});
 assert.equal(hashes.length,5);
 assert.equal(f.requests.length,10);
 assert.equal(f.calls(),0);
 assert.ok(lines.includes('V34_SCHEMA_PREFLIGHT=PASS EXACT_TOOLS=5'));
 assert.ok(lines.includes('V34_MCP_CALLS=0 FILES_OPENED=0 APPROVAL_GRANTED=FALSE PROCESSES_MODIFIED=FALSE'));
});
test('V3.4 diagnostic is inert unless explicitly --schema-only',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const filename=fileURLToPath(new URL('../scripts/Diagnose-Fun-Verified-PE-V34.mjs',import.meta.url));
 const out=spawnSync(process.execPath,[filename],{encoding:'utf8',timeout:12000});
 assert.equal(out.status,0,out.stderr);
 assert.match(out.stdout,/V34_DIAGNOSTIC=INACTIVE/);
});
test('V3.4 exposes exactly five PE names and preflight makes two GETs, no MCP tool call',async()=>{
 const f=fixture(),e=f.engine();
 assert.deepEqual([...PE_TOOLS],['inspect_pe_imports','inspect_native_exports',
  'inspect_pe_resources','inspect_byte_entropy','inspect_pe_load_config']);
 const p=await e.preflight({name:'inspect_pe_imports'});
 assert.equal(p.state,'schema_compatible_file_not_probed');
 assert.equal(p.executionCount,0);assert.equal(p.mcpCalls,0);
 assert.deepEqual(f.requests.map(x=>x.url),[
  REA+'/api/rea229/status',REA+'/api/rea229/tools?limit=229']);
 assert.equal(f.calls(),0);
});
test('all five exact PE tool names prepare independently with only {path}',async()=>{
 for(const name of PE_TOOLS){
  const f=fixture(),e=f.engine();
  const a=await e.prepare({name,filePath:'known.exe'});
  assert.equal(a.preview.name,name);
  assert.deepEqual(a.preview.arguments,{path:sample().path});
  assert.equal(a.preview.file.machine,0x8664);
  assert.equal(a.preview.file.optionalMagic,0x20b);
  assert.equal(a.preview.file.sections,7);
  assert.equal(a.executionCount,0);
  assert.equal(f.calls(),0);
  assert.equal(e.cancel().state,'cancelled_no_execution');
  assert.equal(f.calls(),0);
 }
});
test('one explicit confirmed call returns verified envelope only when file remains unchanged',async()=>{
 const f=fixture(),e=f.engine();
 const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 await assert.rejects(e.confirm({token:a.token}),/SEPARATE_OPERATOR_CONFIRMATION_REQUIRED/);
 await assert.rejects(e.confirm({token:'de'.repeat(24),operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 const o=await e.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(o.state,'verified_mcp_envelope');
 assert.equal(o.executionCount,1);
 assert.equal(o.receipt.fileIdentityVerified,true);
 assert.equal(o.receipt.analysisAccuracyVerified,false);
 assert.equal(o.receipt.providerSideEffectsVerified,false);
 assert.equal(o.receipt.automaticRetries,0);
 assert.equal(o.receipt.receiptHash.length,64);
 assert.deepEqual(f.requests.at(-1),{
  url:REA+'/api/rea229/call',
  body:{name:'inspect_pe_imports',arguments:{path:sample().path}}});
 assert.equal(f.calls(),1);
 await assert.rejects(e.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 assert.equal(f.calls(),1);
});
test('canonical provider NUL-excluding path pattern and optional schema fields pass, but only path is submitted',async()=>{
 for(const name of ['inspect_byte_entropy','inspect_pe_load_config']){
  const f=fixture(),entry=f.state.catalogue.tools.find(t=>t.name===name);
  entry.inputSchema.properties.path.pattern=String.raw`^[^\x00]*import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {createVerifiedPeInspectionV34,probeApprovedPeBinary,PE_TOOLS} from '../src/experimental/verified-pe-inspection-v3-4.mjs';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
import {diagnosePe34} from '../scripts/Diagnose-Fun-Verified-PE-V34.mjs';
import {createUnifiedChatServer} from '../scripts/Run-Fun-Unified-Chat8798.mjs';
const REA='http://127.0.0.1:8797',TOKEN='ba'.repeat(24);
const sample=()=>({path:'C:\\FunIndustrial-Approved-Inputs\\known.exe',
 name:'known.exe',sha256:'a'.repeat(64),bytes:65536,format:'PE',fileIdentity:'4:100',
 machine:0x8664,sections:7,optionalMagic:0x20b});
function fixture(){
 let now=1000,proof=sample(),calls=0,error=null;
 const tools=Array.from({length:229},(_,i)=>{
  const name=PE_TOOLS[i]??'rea_other_'+i;
  return {name,inputSchema:{type:'object',required:['path'],
   properties:{path:{type:'string'}},additionalProperties:false}};
 });
 const state={status:{liveMcpHealth:'ready',realReaToolCount:229},
  catalogue:{tools},result:{tool:'inspect_pe_imports',
   result:{isError:false,structuredContent:{imports:['SYNTHETIC_FUNCTION']}}}};
 const requests=[];
 const request=async(url,body)=>{
  requests.push({url,body});
  if(url===REA+'/api/rea229/status')return state.status;
  if(url===REA+'/api/rea229/tools?limit=229')return state.catalogue;
  if(url===REA+'/api/rea229/call'){calls++;if(error)throw Error(error);return state.result}
  throw Error('UNEXPECTED_ROUTE');
 };
 const probe=async()=>({...proof});
 const engine=()=>createVerifiedPeInspectionV34({
  request,probe,clock:()=>now,tokenFactory:()=>TOKEN,root:'C:\\FunIndustrial-Approved-Inputs'});
 return {engine,state,request,requests,probe,
  advance:ms=>now+=ms,setProof:p=>proof=p,setError:e=>error=e,calls:()=>calls};
}
test('V3.4 live schema diagnostic only issues ten catalogue/status GETs and no tool calls',async()=>{
 const f=fixture(),lines=[];const hashes=await diagnosePe34({request:f.request,write:s=>lines.push(s)});
 assert.equal(hashes.length,5);
 assert.equal(f.requests.length,10);
 assert.equal(f.calls(),0);
 assert.ok(lines.includes('V34_SCHEMA_PREFLIGHT=PASS EXACT_TOOLS=5'));
 assert.ok(lines.includes('V34_MCP_CALLS=0 FILES_OPENED=0 APPROVAL_GRANTED=FALSE PROCESSES_MODIFIED=FALSE'));
});
test('V3.4 diagnostic is inert unless explicitly --schema-only',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const filename=fileURLToPath(new URL('../scripts/Diagnose-Fun-Verified-PE-V34.mjs',import.meta.url));
 const out=spawnSync(process.execPath,[filename],{encoding:'utf8',timeout:12000});
 assert.equal(out.status,0,out.stderr);
 assert.match(out.stdout,/V34_DIAGNOSTIC=INACTIVE/);
});
test('V3.4 exposes exactly five PE names and preflight makes two GETs, no MCP tool call',async()=>{
 const f=fixture(),e=f.engine();
 assert.deepEqual([...PE_TOOLS],['inspect_pe_imports','inspect_native_exports',
  'inspect_pe_resources','inspect_byte_entropy','inspect_pe_load_config']);
 const p=await e.preflight({name:'inspect_pe_imports'});
 assert.equal(p.state,'schema_compatible_file_not_probed');
 assert.equal(p.executionCount,0);assert.equal(p.mcpCalls,0);
 assert.deepEqual(f.requests.map(x=>x.url),[
  REA+'/api/rea229/status',REA+'/api/rea229/tools?limit=229']);
 assert.equal(f.calls(),0);
});
test('all five exact PE tool names prepare independently with only {path}',async()=>{
 for(const name of PE_TOOLS){
  const f=fixture(),e=f.engine();
  const a=await e.prepare({name,filePath:'known.exe'});
  assert.equal(a.preview.name,name);
  assert.deepEqual(a.preview.arguments,{path:sample().path});
  assert.equal(a.preview.file.machine,0x8664);
  assert.equal(a.preview.file.optionalMagic,0x20b);
  assert.equal(a.preview.file.sections,7);
  assert.equal(a.executionCount,0);
  assert.equal(f.calls(),0);
  assert.equal(e.cancel().state,'cancelled_no_execution');
  assert.equal(f.calls(),0);
 }
});
test('one explicit confirmed call returns verified envelope only when file remains unchanged',async()=>{
 const f=fixture(),e=f.engine();
 const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 await assert.rejects(e.confirm({token:a.token}),/SEPARATE_OPERATOR_CONFIRMATION_REQUIRED/);
 await assert.rejects(e.confirm({token:'de'.repeat(24),operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 const o=await e.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(o.state,'verified_mcp_envelope');
 assert.equal(o.executionCount,1);
 assert.equal(o.receipt.fileIdentityVerified,true);
 assert.equal(o.receipt.analysisAccuracyVerified,false);
 assert.equal(o.receipt.providerSideEffectsVerified,false);
 assert.equal(o.receipt.automaticRetries,0);
 assert.equal(o.receipt.receiptHash.length,64);
 assert.deepEqual(f.requests.at(-1),{
  url:REA+'/api/rea229/call',
  body:{name:'inspect_pe_imports',arguments:{path:sample().path}}});
 assert.equal(f.calls(),1);
 await assert.rejects(e.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 assert.equal(f.calls(),1);
});
;
  entry.inputSchema.properties.max_file_bytes={type:'integer',description:'Read cap'};
  if(name==='inspect_byte_entropy'){
   entry.inputSchema.properties.block_size={type:'integer',minimum:256,maximum:65536};
   entry.inputSchema.properties.offset={type:'integer',minimum:0};
   entry.inputSchema.properties.length={type:'integer',minimum:0};
   entry.inputSchema.properties.detail={type:'string',enum:['complete','summary']};
  }else{
   entry.inputSchema.properties.max_callbacks={type:'integer',description:'TLS callback limit'};
  }
  entry.inputSchema.$schema='https://json-schema.org/draft/2020-12/schema';
  const e=f.engine(),p=await e.preflight({name});
  assert.equal(p.state,'schema_compatible_file_not_probed');
  const a=await e.prepare({name,filePath:'known.exe'});
  assert.deepEqual(a.preview.arguments,{path:sample().path});
  assert.equal(f.calls(),0);
  assert.equal(e.cancel().state,'cancelled_no_execution');
  assert.equal(f.calls(),0);
 }
});
test('unsupported REA tools and wrong file or schema never prepare',async()=>{
 for(const name of ['inspect_binary_layout','inspect_binary_hardening','close_binary','']){
  const f=fixture(),e=f.engine();
  await assert.rejects(e.prepare({name,filePath:'known.exe'}),/TOOL_NOT_ALLOWLISTED/);
  assert.equal(f.requests.length,0);
 }
 for(const change of [
  schema=>{schema.required=['path','mode']},
  schema=>{schema.additionalProperties=true},
  schema=>{schema.properties.path.pattern='.*'},
  schema=>{schema.properties.path.pattern='^.+
  schema=>{schema.properties.path.type='number'},
  schema=>{schema.anyOf=[{type:'object'}]},
  schema=>{schema.properties.path.minLength=-1}
 ]){
  const f=fixture(),e=f.engine();change(f.state.catalogue.tools[0].inputSchema);
  await assert.rejects(e.prepare({name:'inspect_pe_imports',filePath:'known.exe'}),/V34_/);
  assert.equal(f.calls(),0);
 }
});
test('missing or duplicated registered 229-tool identity fails before file probe',async()=>{
 for(const edit of [x=>x.state.status.realReaToolCount=228,
   x=>x.state.catalogue.tools.pop(),
   x=>x.state.catalogue.tools[5].name='inspect_pe_imports']){
  const f=fixture(),e=f.engine();edit(f);
  await assert.rejects(e.preflight({name:'inspect_pe_imports'}),/V34_/);
  assert.equal(f.calls(),0);
 }
});
test('drift, expiration and cancellation consume or revoke one-time authorization',async()=>{
 for(const change of [
  f=>f.state.catalogue.tools[0].inputSchema.description='new schema',
  f=>f.setProof({...sample(),sha256:'b'.repeat(64)}),
  f=>f.setProof({...sample(),fileIdentity:'4:999'}),
  f=>f.advance(120001)
 ]){
  const f=fixture(),e=f.engine();
  const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
  change(f);
  try{
   const o=await e.confirm({token:a.token,operatorConfirmed:true});
   assert.equal(o.state,'preflight_hold_no_call');
  }catch(err){assert.match(err.message,/APPROVAL_EXPIRED/)}
  assert.equal(f.calls(),0);
  await assert.rejects(e.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 }
 const f=fixture(),e=f.engine();const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 e.cancel();await assert.rejects(e.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 assert.equal(f.calls(),0);
});
test('known MCP rejection is negative receipt; unknown network fault never retries',async()=>{
 const f=fixture(),e=f.engine();
 const error={version:'fi-rea-mcp-error-evidence-v1',errorClass:'unclassified_mcp_error',
  resultIsError:true,analysisSucceeded:false,diagnosticTextExposed:false,
  evidenceDigestSha256:'f'.repeat(64),digestScope:'complete_json_utf8'};
 f.state.result={tool:'inspect_pe_imports',result:{isError:true,
  structuredContent:{errorEvidence:error}},mcpErrorEvidence:error};
 const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 const o=await e.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(o.state,'provider_mcp_error_reported');
 assert.equal(o.receipt.mcpErrorClass,'unclassified_mcp_error');
 assert.equal(o.receipt.analysisAccuracyVerified,false);
 assert.equal(o.receipt.resultHash,null);
 assert.equal(f.calls(),1);
 const u=fixture(),run=u.engine();u.setError('closed socket');
 const x=await run.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 const y=await run.confirm({token:x.token,operatorConfirmed:true});
 assert.equal(y.state,'outcome_unknown_do_not_retry');
 assert.equal(y.executionCount,'unknown');assert.equal(u.calls(),1);
});
test('malformed error payload or post-inspection file drift never counts as positive verified analysis',async()=>{
 const f=fixture(),e=f.engine();
 f.state.result={tool:'inspect_pe_imports',result:{isError:true,
  content:[{type:'text',text:'SECRET_UNTRUSTED'}]}};
 const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 const o=await e.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(o.state,'result_hold_manual_review');
 assert.equal(o.preview.includes('SECRET_UNTRUSTED'),false);
 const g=fixture(),z=g.engine(),b=await z.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 g.setProof({...sample(),sha256:'c'.repeat(64)});
 const w=await z.confirm({token:b.token,operatorConfirmed:true});
 assert.equal(w.state,'preflight_hold_no_call');assert.equal(g.calls(),0);
});
test('true synthetic PE32+ x64 header is parsed locally without launching the file',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'fi-v34-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const file=path.join(root,'real.exe');
 const bytes=Buffer.alloc(1024);bytes.writeUInt16LE(0x5a4d,0);
 bytes.writeInt32LE(128,60);bytes.writeUInt32LE(0x4550,128);
 bytes.writeUInt16LE(0x8664,132);bytes.writeUInt16LE(7,134);
 bytes.writeUInt16LE(240,148);bytes.writeUInt16LE(0x20b,152);
 await writeFile(file,bytes);
 const p=await probeApprovedPeBinary('real.exe',{root});
 assert.equal(p.path,await realpath(file));
 assert.equal(p.machine,0x8664);
 assert.equal(p.sections,7);
 assert.equal(p.optionalMagic,0x20b);
 assert.equal(p.sha256.length,64);
 bytes.writeUInt16LE(800,148);await writeFile(file,bytes);
 await assert.rejects(probeApprovedPeBinary('real.exe',{root}),/V34_PE_HEADER_OR_SECTION_TABLE_TRUNCATED/);
 bytes.writeUInt16LE(240,148);await writeFile(file,bytes);
 await assert.rejects(probeApprovedPeBinary('../real.exe',{root}),/V34_/);
 await assert.rejects(probeApprovedPeBinary('real.elf',{root}),/V34_/);
 bytes.writeUInt16LE(0x014c,132);await writeFile(file,bytes);
 await assert.rejects(probeApprovedPeBinary('real.exe',{root}),/V34_NOT_X64_PE32_PLUS/);
});
test('same-origin V3.4 HTTP requires separate approval and exact body keys',async()=>{
 const f=fixture(),engine=f.engine(),app=createUnifiedTaskChat({request:f.request});
 const server=createUnifiedChatServer({app:{...app,
  verifiedPeStatus:()=>engine.status(),prepareVerifiedPe:b=>engine.prepare(b),
  confirmVerifiedPe:b=>engine.confirm(b),cancelVerifiedPe:()=>engine.cancel()},readClient:async()=>''});
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)});
 const port=server.address().port;
 async function req(route,body,approved=true){
  return new Promise((resolve,reject)=>{
   const data=body===null?'':JSON.stringify(body);
   const r=http.request({host:'127.0.0.1',port,path:route,method:body===null?'GET':'POST',
    headers:{host:'127.0.0.1:8798',...(body!==null?{'content-type':'application/json'}:{}),
     ...(approved?{origin:'http://127.0.0.1:8798','x-fi-unified':'operator-click'}:{})}},
    response=>{let data='';response.on('data',chunk=>data+=chunk);
     response.on('end',()=>resolve({code:response.statusCode,body:JSON.parse(data)}))});
   r.once('error',reject);r.end(data||undefined);
  });
 }
 try{
  assert.equal((await req('/api/unified/v3.4/status',null)).body.enabled,true);
  const body={name:'inspect_pe_imports',filePath:'known.exe'};
  assert.equal((await req('/api/unified/v3.4/prepare',body,false)).code,403);
  assert.equal((await req('/api/unified/v3.4/prepare',{...body,unreviewed:true})).code,422);
  const a=await req('/api/unified/v3.4/prepare',body);
  assert.equal(a.code,200);assert.equal(f.calls(),0);
  assert.equal((await req('/api/unified/v3.4/confirm',{
   token:a.body.token,operatorConfirmed:false})).code,422);
  assert.equal(f.calls(),0);
  const o=await req('/api/unified/v3.4/confirm',{
   token:a.body.token,operatorConfirmed:true});
  assert.equal(o.code,200);assert.equal(o.body.state,'verified_mcp_envelope');
  assert.equal(f.calls(),1);
  assert.equal((await req('/api/unified/v3.4/confirm',{
   token:a.body.token,operatorConfirmed:true})).code,422);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
},
  schema=>{schema.properties.path.type='number'},
  schema=>{schema.anyOf=[{type:'object'}]},
  schema=>{schema.properties.path.minLength=-1}
 ]){
  const f=fixture(),e=f.engine();change(f.state.catalogue.tools[0].inputSchema);
  await assert.rejects(e.prepare({name:'inspect_pe_imports',filePath:'known.exe'}),/V34_/);
  assert.equal(f.calls(),0);
 }
});
test('missing or duplicated registered 229-tool identity fails before file probe',async()=>{
 for(const edit of [x=>x.state.status.realReaToolCount=228,
   x=>x.state.catalogue.tools.pop(),
   x=>x.state.catalogue.tools[5].name='inspect_pe_imports']){
  const f=fixture(),e=f.engine();edit(f);
  await assert.rejects(e.preflight({name:'inspect_pe_imports'}),/V34_/);
  assert.equal(f.calls(),0);
 }
});
test('drift, expiration and cancellation consume or revoke one-time authorization',async()=>{
 for(const change of [
  f=>f.state.catalogue.tools[0].inputSchema.description='new schema',
  f=>f.setProof({...sample(),sha256:'b'.repeat(64)}),
  f=>f.setProof({...sample(),fileIdentity:'4:999'}),
  f=>f.advance(120001)
 ]){
  const f=fixture(),e=f.engine();
  const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
  change(f);
  try{
   const o=await e.confirm({token:a.token,operatorConfirmed:true});
   assert.equal(o.state,'preflight_hold_no_call');
  }catch(err){assert.match(err.message,/APPROVAL_EXPIRED/)}
  assert.equal(f.calls(),0);
  await assert.rejects(e.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 }
 const f=fixture(),e=f.engine();const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 e.cancel();await assert.rejects(e.confirm({token:a.token,operatorConfirmed:true}),/PREPARATION_NOT_FOUND/);
 assert.equal(f.calls(),0);
});
test('known MCP rejection is negative receipt; unknown network fault never retries',async()=>{
 const f=fixture(),e=f.engine();
 const error={version:'fi-rea-mcp-error-evidence-v1',errorClass:'unclassified_mcp_error',
  resultIsError:true,analysisSucceeded:false,diagnosticTextExposed:false,
  evidenceDigestSha256:'f'.repeat(64),digestScope:'complete_json_utf8'};
 f.state.result={tool:'inspect_pe_imports',result:{isError:true,
  structuredContent:{errorEvidence:error}},mcpErrorEvidence:error};
 const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 const o=await e.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(o.state,'provider_mcp_error_reported');
 assert.equal(o.receipt.mcpErrorClass,'unclassified_mcp_error');
 assert.equal(o.receipt.analysisAccuracyVerified,false);
 assert.equal(o.receipt.resultHash,null);
 assert.equal(f.calls(),1);
 const u=fixture(),run=u.engine();u.setError('closed socket');
 const x=await run.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 const y=await run.confirm({token:x.token,operatorConfirmed:true});
 assert.equal(y.state,'outcome_unknown_do_not_retry');
 assert.equal(y.executionCount,'unknown');assert.equal(u.calls(),1);
});
test('malformed error payload or post-inspection file drift never counts as positive verified analysis',async()=>{
 const f=fixture(),e=f.engine();
 f.state.result={tool:'inspect_pe_imports',result:{isError:true,
  content:[{type:'text',text:'SECRET_UNTRUSTED'}]}};
 const a=await e.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 const o=await e.confirm({token:a.token,operatorConfirmed:true});
 assert.equal(o.state,'result_hold_manual_review');
 assert.equal(o.preview.includes('SECRET_UNTRUSTED'),false);
 const g=fixture(),z=g.engine(),b=await z.prepare({name:'inspect_pe_imports',filePath:'known.exe'});
 g.setProof({...sample(),sha256:'c'.repeat(64)});
 const w=await z.confirm({token:b.token,operatorConfirmed:true});
 assert.equal(w.state,'preflight_hold_no_call');assert.equal(g.calls(),0);
});
test('true synthetic PE32+ x64 header is parsed locally without launching the file',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'fi-v34-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const file=path.join(root,'real.exe');
 const bytes=Buffer.alloc(1024);bytes.writeUInt16LE(0x5a4d,0);
 bytes.writeInt32LE(128,60);bytes.writeUInt32LE(0x4550,128);
 bytes.writeUInt16LE(0x8664,132);bytes.writeUInt16LE(7,134);
 bytes.writeUInt16LE(240,148);bytes.writeUInt16LE(0x20b,152);
 await writeFile(file,bytes);
 const p=await probeApprovedPeBinary('real.exe',{root});
 assert.equal(p.path,await realpath(file));
 assert.equal(p.machine,0x8664);
 assert.equal(p.sections,7);
 assert.equal(p.optionalMagic,0x20b);
 assert.equal(p.sha256.length,64);
 bytes.writeUInt16LE(800,148);await writeFile(file,bytes);
 await assert.rejects(probeApprovedPeBinary('real.exe',{root}),/V34_PE_HEADER_OR_SECTION_TABLE_TRUNCATED/);
 bytes.writeUInt16LE(240,148);await writeFile(file,bytes);
 await assert.rejects(probeApprovedPeBinary('../real.exe',{root}),/V34_/);
 await assert.rejects(probeApprovedPeBinary('real.elf',{root}),/V34_/);
 bytes.writeUInt16LE(0x014c,132);await writeFile(file,bytes);
 await assert.rejects(probeApprovedPeBinary('real.exe',{root}),/V34_NOT_X64_PE32_PLUS/);
});
test('same-origin V3.4 HTTP requires separate approval and exact body keys',async()=>{
 const f=fixture(),engine=f.engine(),app=createUnifiedTaskChat({request:f.request});
 const server=createUnifiedChatServer({app:{...app,
  verifiedPeStatus:()=>engine.status(),prepareVerifiedPe:b=>engine.prepare(b),
  confirmVerifiedPe:b=>engine.confirm(b),cancelVerifiedPe:()=>engine.cancel()},readClient:async()=>''});
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)});
 const port=server.address().port;
 async function req(route,body,approved=true){
  return new Promise((resolve,reject)=>{
   const data=body===null?'':JSON.stringify(body);
   const r=http.request({host:'127.0.0.1',port,path:route,method:body===null?'GET':'POST',
    headers:{host:'127.0.0.1:8798',...(body!==null?{'content-type':'application/json'}:{}),
     ...(approved?{origin:'http://127.0.0.1:8798','x-fi-unified':'operator-click'}:{})}},
    response=>{let data='';response.on('data',chunk=>data+=chunk);
     response.on('end',()=>resolve({code:response.statusCode,body:JSON.parse(data)}))});
   r.once('error',reject);r.end(data||undefined);
  });
 }
 try{
  assert.equal((await req('/api/unified/v3.4/status',null)).body.enabled,true);
  const body={name:'inspect_pe_imports',filePath:'known.exe'};
  assert.equal((await req('/api/unified/v3.4/prepare',body,false)).code,403);
  assert.equal((await req('/api/unified/v3.4/prepare',{...body,unreviewed:true})).code,422);
  const a=await req('/api/unified/v3.4/prepare',body);
  assert.equal(a.code,200);assert.equal(f.calls(),0);
  assert.equal((await req('/api/unified/v3.4/confirm',{
   token:a.body.token,operatorConfirmed:false})).code,422);
  assert.equal(f.calls(),0);
  const o=await req('/api/unified/v3.4/confirm',{
   token:a.body.token,operatorConfirmed:true});
  assert.equal(o.code,200);assert.equal(o.body.state,'verified_mcp_envelope');
  assert.equal(f.calls(),1);
  assert.equal((await req('/api/unified/v3.4/confirm',{
   token:a.body.token,operatorConfirmed:true})).code,422);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
