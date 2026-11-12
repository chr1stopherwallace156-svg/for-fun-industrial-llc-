import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEmbeddedLocalToolsV42} from '../src/experimental/embedded-local-tools-v4-2.mjs';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
const LOCAL='http://127.0.0.1:8796/api/ai/auto-local/status';
const PARENT='http://127.0.0.1:8789/api/ai/tools';
const LLAMA='http://127.0.0.1:8088/v1/chat/completions';
function fixture(){
 const calls=[],readCalls=[];let pending,resolve;
 const original={version:'fi-auto-local-dashboard-v1',enabled:true,busy:false,
  reaExecutionGrants:0,scope:'existing_local_registered_tools_only',backgroundExecution:false};
 const bridge={
  status:()=>({...original}),
  run:async body=>{
   calls.push(body);
   if(pending)await pending;
   return {version:'fi-auto-local-dashboard-v1',state:'completed_with_actions',
    actions:[{tool:'fi_graph_analyze',round:1,result:{nodes:2}}],
    reply:'Graph ready',reaExecutionGrants:0};
  }
 };
 const answers={legacy:{sidecar:true,busy:false,reaExecutionGrants:0},
  tools:{local_tool_count:19,rea_tool_count:229}};
 const read=async url=>{
  readCalls.push(url);
  if(url===LOCAL)return answers.legacy;
  if(url===PARENT)return answers.tools;
  throw Error('UNKNOWN_ENDPOINT');
 };
 const embedded=createEmbeddedLocalToolsV42({dashboard:bridge,read});
 const request=async(url,body)=>{
  if(url.endsWith('/api/ai/auto-local/run')||url.endsWith('/api/rea229/run')||
   url.endsWith('/api/rea229/call'))throw Error('UNEXPECTED_SIDE_EFFECT');
  if(url===LLAMA)return {choices:[{message:{content:'Model answer'}}]};
  if(url===PARENT)return answers.tools;
  if(url===LOCAL)return answers.legacy;
  throw Error('UNEXPECTED_UNIFIED_REQUEST_'+url);
 };
 return {embedded,bridge,calls,readCalls,original,answers,request,
  hold:()=>{pending=new Promise(r=>resolve=r)},release:()=>{resolve?.();pending=null}};
}
test('V4 Stage2 embedded mode uses existing local dashboard in-process and zero 8796 POSTs',async()=>{
 const f=fixture(),app=createUnifiedTaskChat({request:f.request,embeddedLocal:f.embedded});
 const pending=await app.chat({prompt:'Run a local graph analysis with compute'});
 assert.equal(pending.state,'awaiting_operator_click');
 assert.equal(f.calls.length,0);
 assert.equal(f.readCalls.length,0);
 await assert.rejects(app.executeLocal({prompt:'Run local graph analysis with compute'}),/LOCAL_OPERATOR_CONFIRMATION_REQUIRED/);
 assert.equal(f.calls.length,0);
 const out=await app.executeLocal({prompt:'Run local graph analysis with compute',operatorConfirmed:true});
 assert.equal(out.state,'local_action_executed');
 assert.equal(out.localExecutionPath,'embedded_in_8798');
 assert.equal(out.actions[0].tool,'fi_graph_analyze');
 assert.deepEqual(f.calls,[{prompt:'Run local graph analysis with compute',rounds:2}]);
 assert.deepEqual(f.readCalls.sort(),[LOCAL,PARENT].sort());
 assert.equal(f.embedded.status().reaExecutionGrants,0);
 assert.equal(f.embedded.status().legacy8796ExecutionPostUsed,false);
});
test('V4 Stage2 status reports embedded readiness without granting action authority',async()=>{
 const f=fixture(),s=f.embedded.status();
 assert.equal(s.enabled,true);assert.equal(s.operatorApprovalRequired,true);
 assert.equal(s.legacy8796Retired,false);assert.equal(s.backgroundExecution,false);
 assert.equal(s.executionPath,'8798_in_process_to_existing_8789_parent');
 assert.equal(s.startedSessions,0);
});
test('V4 Stage2 read-only status does not submit a local tool or execute Qwen',()=>{
 const f=fixture();f.embedded.status();
 assert.equal(f.calls.length,0);assert.equal(f.readCalls.length,0);
});
test('V4 Stage2 malformed requests, unsupported roles, and unapproved prompts never execute',async()=>{
 const f=fixture(),app=createUnifiedTaskChat({request:f.request,embeddedLocal:f.embedded});
 for(const prompt of ['', 'x','Read my email','Use REA to inspect native code']){
  await assert.rejects(app.executeLocal({prompt,operatorConfirmed:true}),/PROMPT_INVALID|LOCAL_TASK_NOT_MATCHED/);
 }
 await assert.rejects(f.embedded.run({prompt:'Compute a graph',rounds:0}),/REQUEST_INVALID/);
 await assert.rejects(f.embedded.run({prompt:'Compute a graph',rounds:3}),/REQUEST_INVALID/);
 assert.equal(f.calls.length,0);
});
test('V4 Stage2 refuses 8796 sidecar busy, catalogue drift, and REA grant changes',async()=>{
 for(const variant of [
  f=>f.answers.legacy.busy=true,
  f=>f.answers.legacy.sidecar=false,
  f=>f.answers.legacy.reaExecutionGrants=1,
  f=>f.answers.tools.local_tool_count=18,
  f=>f.answers.tools.rea_tool_count=228,
  f=>f.original.reaExecutionGrants=1,
  f=>f.original.scope='rea_full'
 ]){
  const f=fixture();variant(f);
  await assert.rejects(f.embedded.run({prompt:'Compute graph',rounds:2}),/V42_/);
  assert.equal(f.calls.length,0);
  assert.equal(f.embedded.status().failedSessions,1);
 }
});
test('V4 Stage2 refuses untrusted tool result and will not retry side effects',async()=>{
 let calls=0;
 const f=fixture();
 const service=createEmbeddedLocalToolsV42({
  read:async url=>url===LOCAL?f.answers.legacy:f.answers.tools,
  dashboard:{status:f.bridge.status,run:async()=>{
   calls++;return {version:'fi-auto-local-dashboard-v1',actions:[{tool:'rea__run',result:{}}],
    reply:'false verified',reaExecutionGrants:0};
  }}
 });
 await assert.rejects(service.run({prompt:'Compute graph'}),/RESULT_NEEDS_MANUAL_REVIEW_NO_RETRY/);
 assert.equal(calls,1);
 assert.equal(service.status().failedSessions,1);
});
test('V4 Stage2 concurrent action is rejected while a prior local session is running',async()=>{
 const f=fixture();f.hold();
 const one=f.embedded.run({prompt:'Compute a graph'});
 await Promise.resolve();await Promise.resolve();
 await assert.rejects(f.embedded.run({prompt:'Compute a graph'}),/CONCURRENT_SESSION/);
 f.release();await one;
 assert.equal(f.calls.length,1);
 assert.equal(f.embedded.status().busy,false);
});
test('V4 Stage2 legacy mode remains available to existing tests without implicit fallback',async()=>{
 const f=fixture(),app=createUnifiedTaskChat({request:f.request});
 const status=await app.status().catch(()=>null);
 assert.equal(status?.localExecutionPath,'legacy_8796_http');
 assert.equal(status?.embeddedLocalV42?.enabled,false);
});
test('V4 Stage2 no new listener or unexpected calls to legacy executor are added in production wiring',async()=>{
 const source=await readFile(new URL('../scripts/Run-Fun-Unified-Chat8798.mjs',import.meta.url),'utf8');
 const embedded=await readFile(new URL('../src/experimental/embedded-local-tools-v4-2.mjs',import.meta.url),'utf8');
 assert.match(source,/createEmbeddedLocalToolsV42\(\{read:fixedJson\}\)/);
 assert.doesNotMatch(embedded,/api\/rea229\/call|api\/rea229\/run|auto-local\/run|createServer\(|listen\(/);
 assert.match(source,/PORT=8798/);
});
