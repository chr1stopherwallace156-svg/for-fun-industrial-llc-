import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createVerifiedReaV3,v3ApprovedReadOnlyTools} from '../src/experimental/verified-rea-v3.mjs';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
import {createUnifiedChatServer} from '../scripts/Run-Fun-Unified-Chat8798.mjs';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const REA='http://127.0.0.1:8797';
const TOK='ab'.repeat(24);
const names=Array.from({length:229},(_,i)=>i===0?'inspect_analysis_settings':i===1?'binary_session':'unknown_rea_'+i);
function fixture(){
 let now=1000000;
 const calls=[],data={
  health:{liveMcpHealth:'ready',realReaToolCount:229},
  catalogue:{tools:names.map(name=>({
   name,description:'Potential inspection tool — metadata only',
   inputSchema:{type:'object',properties:{},required:[],additionalProperties:false}
  }))},
  result:{tool:'inspect_analysis_settings',result:{
   isError:false,structuredContent:{'javascript.analysis_timeout_ms':300000}
  }}
 };
 let reqImpl=async(url,body)=>{
  calls.push({url,body});
  if(url===REA+'/api/rea229/status')return data.health;
  if(url===REA+'/api/rea229/tools?limit=229')return data.catalogue;
  if(url===REA+'/api/rea229/call')return {...data.result,tool:body.name};
  throw Error('UNEXPECTED_REQUEST_'+url);
 };
 const request=(...args)=>reqImpl(...args);
 const app=()=>createVerifiedReaV3({request,clock:()=>now,tokenFactory:()=>TOK});
 return {app,calls,data,request,now:()=>now,tick:(n=1)=>{now+=n},
  override:fn=>{reqImpl=fn}};
}
test('V3 conservative allowlist and status cannot imply 229 tools are approved',()=>{
 const f=fixture(),v3=f.app(),s=v3.status();
 assert.deepEqual(v3ApprovedReadOnlyTools(),['inspect_analysis_settings','binary_session']);
 assert.deepEqual(s.approvedTools,v3ApprovedReadOnlyTools());
 assert.equal(s.catalogueExpected,229);
 assert.equal(s.autoExecution,false);
 assert.equal(s.completedExecutions,0);
 assert.equal(s.preparationPending,false);
});
test('V3 prepare checks live 229 schema without calling an MCP tool',async()=>{
 const f=fixture(),v=f.app();
 const p=await v.prepare({name:'inspect_analysis_settings',arguments:{}});
 assert.equal(p.state,'awaiting_separate_operator_confirmation');
 assert.equal(p.preview.name,'inspect_analysis_settings');
 assert.equal(p.preview.specificProviderUsability,'not_proven_until_call');
 assert.equal(p.executedActions,0);
 assert.equal(p.authorizationToken,TOK);
 assert.equal(p.expiresAtUnixMs,f.now()+120000);
 assert.equal(f.calls.length,2);
 assert.ok(!f.calls.some(x=>x.url.endsWith('/call')));
});
test('reject unapproved tool names and nonempty or missing arguments without network calls',async()=>{
 const f=fixture(),v=f.app();
 for(const pair of [
  {name:'inspect_rust_binary',arguments:{}},{name:'close_binary',arguments:{}},
  {name:'inspect_analysis_settings'},{name:'inspect_analysis_settings',arguments:{danger:true}},
  {name:'binary_session',arguments:[]}
 ])await assert.rejects(v.prepare(pair),/V3_(TOOL_NOT_IN_REVIEWED_READONLY_ALLOWLIST|ARGS_MUST_BE_EXACT_EMPTY_OBJECT)/);
 assert.equal(f.calls.length,0);
});
test('require explicit separate approval with one matching capability token',async()=>{
 const f=fixture(),v=f.app();
 await v.prepare({name:'inspect_analysis_settings',arguments:{}});
 await assert.rejects(v.execute({authorizationToken:TOK}),/V3_OPERATOR_CONFIRMATION_REQUIRED/);
 await assert.rejects(v.execute({authorizationToken:'cd'.repeat(24),operatorConfirmed:true}),/V3_NO_MATCHING_LIVE_PREPARATION/);
 assert.equal(f.calls.length,2);
 const done=await v.execute({authorizationToken:TOK,operatorConfirmed:true});
 assert.equal(done.state,'verified_readonly_result');
 assert.equal(done.executedActions,1);
 assert.equal(done.requestSubmitted,true);
 assert.equal(f.calls.length,5);
 assert.equal(f.calls.filter(x=>x.url===REA+'/api/rea229/call').length,1);
 await assert.rejects(v.execute({authorizationToken:TOK,operatorConfirmed:true}),/V3_NO_MATCHING_LIVE_PREPARATION/);
 assert.equal(f.calls.length,5);
});
test('real exact MCP body is one fixed allowlisted name and empty arguments',async()=>{
 const f=fixture(),v=f.app();
 await v.prepare({name:'binary_session',arguments:{}});
 const r=await v.execute({authorizationToken:TOK,operatorConfirmed:true});
 assert.equal(r.receipt.tool,'binary_session');
 const call=f.calls.find(x=>x.url===REA+'/api/rea229/call');
 assert.deepEqual(call.body,{name:'binary_session',arguments:{}});
 assert.equal(r.receipt.argumentsHash.length,64);
 assert.equal(r.receipt.resultHash.length,64);
 assert.equal(r.receipt.receiptHash.length,64);
 assert.equal(r.receipt.automaticRetries,0);
 assert.equal(v.status().completedExecutions,1);
});
test('invalid catalogue status, counts, duplicate names and complex schemas hold before approval token',async()=>{
 for(const change of [
  d=>{d.health.realReaToolCount=228},
  d=>{d.catalogue.tools.pop()},
  d=>{d.catalogue.tools[2].name='inspect_analysis_settings'},
  d=>{d.catalogue.tools[0].inputSchema.required=['file']},
  d=>{d.catalogue.tools[0].inputSchema.allOf=[{type:'object'}]},
  d=>{d.catalogue.tools[0].inputSchema.type='string'}
 ]){
  const f=fixture(),v=f.app();change(f.data);
  await assert.rejects(v.prepare({name:'inspect_analysis_settings',arguments:{}}),/V3_/);
  assert.equal(f.calls.filter(x=>x.url.endsWith('/call')).length,0);
  assert.equal(v.status().preparationPending,false);
 }
});
test('schema drift between review and approval consumes token and does not execute',async()=>{
 const f=fixture(),v=f.app();await v.prepare({name:'inspect_analysis_settings',arguments:{}});
 f.data.catalogue.tools[0].inputSchema.description='schema changed';
 const out=await v.execute({authorizationToken:TOK,operatorConfirmed:true});
 assert.equal(out.state,'schema_changed_no_execution');
 assert.equal(out.executedActions,0);
 assert.equal(out.requestSubmitted,false);
 assert.equal(v.status().preparationPending,false);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/call')).length,0);
 await assert.rejects(v.execute({authorizationToken:TOK,operatorConfirmed:true}),/V3_NO_MATCHING_LIVE_PREPARATION/);
});
test('preflight health change blocks the approved call and cannot replay',async()=>{
 const f=fixture(),v=f.app();
 await v.prepare({name:'inspect_analysis_settings',arguments:{}});
 f.data.health.liveMcpHealth='not_ready';
 const out=await v.execute({authorizationToken:TOK,operatorConfirmed:true});
 assert.equal(out.state,'preflight_hold_no_execution');
 assert.equal(out.requestSubmitted,false);
 await assert.rejects(v.execute({authorizationToken:TOK,operatorConfirmed:true}),/NO_MATCHING_LIVE_PREPARATION/);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/call')).length,0);
});
test('expired, canceled or replaced preparation cannot execute later',async()=>{
 const f=fixture(),v=f.app();
 await v.prepare({name:'inspect_analysis_settings',arguments:{}});
 f.tick(120001);
 await assert.rejects(v.execute({authorizationToken:TOK,operatorConfirmed:true}),/PREPARATION_EXPIRED_NO_CALL/);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/call')).length,0);
 await v.prepare({name:'inspect_analysis_settings',arguments:{}});
 const cancel=v.cancel();
 assert.equal(cancel.state,'approval_cancelled_no_execution');
 await assert.rejects(v.execute({authorizationToken:TOK,operatorConfirmed:true}),/NO_MATCHING_LIVE_PREPARATION/);
});
test('transport failure after submission reports unknown, no replay, no success fabrication',async()=>{
 const f=fixture(),v=f.app(),delegate=f.request;
 await v.prepare({name:'inspect_analysis_settings',arguments:{}});
 f.override(async (url,body)=>{
  if(url===REA+'/api/rea229/call')throw Error('ECONNRESET');
  return delegate(url,body);
 });
 const out=await v.execute({authorizationToken:TOK,operatorConfirmed:true});
 assert.equal(out.state,'outcome_unverified_do_not_retry');
 assert.equal(out.requestSubmitted,true);
 assert.equal(out.executedActions,'unknown');
 assert.equal(v.status().completedExecutions,0);
 await assert.rejects(v.execute({authorizationToken:TOK,operatorConfirmed:true}),/NO_MATCHING_LIVE_PREPARATION/);
});
test('MCP error and tool identity mismatch cannot be reported as verified success',async()=>{
 for(const result of [
  {tool:'other_tool',result:{isError:false,content:[{type:'text',text:'x'}]}},
  {tool:'inspect_analysis_settings',result:{isError:true,content:[{type:'text',text:'oops'}]}},
  {tool:'inspect_analysis_settings',result:null}
 ]){
  const f=fixture(),v=f.app();f.data.result=result;
  await v.prepare({name:'inspect_analysis_settings',arguments:{}});
  const out=await v.execute({authorizationToken:TOK,operatorConfirmed:true});
  assert.equal(out.state,'result_hold_verify_manually');
  assert.equal(out.executedActions,'unverified');
  assert.equal(out.receipt.verifiedResultEnvelope,result?.result?.isError===false);
  assert.equal(v.status().completedExecutions,0);
 }
});
test('V3 module never runs model inference or any local /run endpoints',async()=>{
 const f=fixture(),v=f.app();
 await v.prepare({name:'inspect_analysis_settings',arguments:{}});
 await v.execute({authorizationToken:TOK,operatorConfirmed:true});
 assert.ok(f.calls.every(x=>x.url.startsWith('http://127.0.0.1:8797/api/rea229/')));
 assert.ok(f.calls.every(x=>!x.url.endsWith('/run')));
 assert.equal(f.calls.filter(x=>x.url.endsWith('/call')).length,1);
});
test('V3 client source parses and contains distinct review/confirmation controls',async()=>{
 const source=await readFile(new URL('../src/experimental/unified-task-client.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Script(source));
 assert.match(source,/v3-prepare/);
 assert.match(source,/v3-confirm/);
 assert.match(source,/v3-cancel/);
 assert.match(source,/authorizationToken:token,operatorConfirmed:true/);
});
test('V3 HTTP enforces origin, body allowlists, separate consent and single execution',async()=>{
 const f=fixture();
 const request=async(url,body)=>{
  if(url.startsWith(REA))return f.request(url,body);
  throw Error('NO_OTHER_PROVIDER_ALLOWED_'+url);
 };
 const app=createUnifiedTaskChat({request});
 const server=createUnifiedChatServer({app,readClient:async()=>'(function(){})()'});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const rawPost=async(path,body,headers={})=>new Promise((resolve,reject)=>{
  const r=http.request({hostname:'127.0.0.1',port:server.address().port,path,method:'POST',
   headers:{host:'127.0.0.1:8798','content-type':'application/json',...headers}},
   res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({
    code:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))
   }))});
  r.once('error',reject);r.end(JSON.stringify(body));
 });
 const h={origin:'http://127.0.0.1:8798','x-fi-unified':'operator-click'};
 try{
  assert.equal((await rawPost('/api/unified/v3/prepare',{name:'inspect_analysis_settings',arguments:{}},{})).code,403);
  assert.equal((await rawPost('/api/unified/v3/prepare',{name:'inspect_analysis_settings',arguments:{},extra:'x'},h)).code,422);
  const p=await rawPost('/api/unified/v3/prepare',{name:'inspect_analysis_settings',arguments:{}},h);
  assert.equal(p.code,200);
  assert.equal(p.data.state,'awaiting_separate_operator_confirmation');
  assert.equal(f.calls.filter(x=>x.url.endsWith('/call')).length,0);
  assert.equal((await rawPost('/api/unified/v3/confirm',{authorizationToken:p.data.authorizationToken,operatorConfirmed:false},h)).code,422);
  assert.equal(f.calls.filter(x=>x.url.endsWith('/call')).length,0);
  const ok=await rawPost('/api/unified/v3/confirm',{authorizationToken:p.data.authorizationToken,operatorConfirmed:true},h);
  assert.equal(ok.code,200);
  assert.equal(ok.data.state,'verified_readonly_result');
  assert.equal(f.calls.filter(x=>x.url.endsWith('/call')).length,1);
  assert.equal((await rawPost('/api/unified/v3/confirm',{authorizationToken:p.data.authorizationToken,operatorConfirmed:true},h)).code,422);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
