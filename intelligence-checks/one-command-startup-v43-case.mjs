import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
import {createUnifiedGatewayV4} from '../src/experimental/unified-gateway-v4.mjs';
import {createAutoLocalDashboard} from '../src/experimental/auto-local-dashboard.mjs';
import {createEmbeddedLocalToolsV42} from '../src/experimental/embedded-local-tools-v4-2.mjs';
const URLS={
 parent:'http://127.0.0.1:8789/api/ai/status',
 tools:'http://127.0.0.1:8789/api/ai/tools',
 legacy:'http://127.0.0.1:8796/api/ai/auto-local/status',
 rea:'http://127.0.0.1:8797/api/rea229/status',
 llama:'http://127.0.0.1:8088/health',
 compute:'http://127.0.0.1:8791/health'
};
const make=()=>({
 [URLS.parent]:{state:'stopped'},
 [URLS.tools]:{rea_tool_count:0,local_tool_count:19},
 [URLS.legacy]:{sidecar:true,busy:false,reaExecutionGrants:0},
 [URLS.rea]:{liveMcpHealth:'ready',realReaToolCount:229,busy:false},
 [URLS.llama]:{status:'ok'},
 [URLS.compute]:{state:'running'}
});
test('V4.3 complete independent readiness does not depend on stale parent AI or REA session',async()=>{
 const observations=make(),queries=[];
 const v4=createUnifiedGatewayV4({read:async uri=>{queries.push(uri);return observations[uri]}});
 const s=await v4.status();
 assert.equal(s.state,'ready');
 assert.equal(s.registered.rea,229);
 assert.equal(s.registered.parentRea,0);
 assert.equal(s.registered.independentRea,229);
 assert.equal(s.parentMcpActivationRequiredForLegacyV3,true);
 assert.deepEqual(queries.sort(),Object.values(URLS).sort());
 assert.equal(s.toolExecutionsPerformed,0);
});
test('V4.3 fails closed if standalone 229 not validated or original registry is unexpected',async()=>{
 for(const patch of [
  x=>x[URLS.rea]={liveMcpHealth:'not_ready',realReaToolCount:0,busy:false},
  x=>x[URLS.tools].rea_tool_count=228,
  x=>x[URLS.tools].local_tool_count=20,
  x=>x[URLS.llama]={status:'error'},
  x=>x[URLS.parent]={state:'unavailable'}
 ]){
  const x=make();patch(x);
  const state=await createUnifiedGatewayV4({read:async u=>x[u]}).status();
  assert.equal(state.state,'degraded');
 }
});
test('V4.3 unified chat reports external model available without claiming Python ownership',async()=>{
 const values=make(),seen=[];
 const request=async uri=>{seen.push(uri);if(uri in values)return values[uri];throw Error('INVALID_ROUTE')};
 const status=await createUnifiedTaskChat({request}).status();
 assert.equal(status.state,'ready');
 assert.equal(status.ai.ready,true);
 assert.equal(status.ai.ownership,'independent_observed');
 assert.equal(status.legacyParentReaInitialized,false);
 assert.equal(status.rea.count,229);
 assert.equal(status.local.count,19);
 assert.deepEqual(seen.sort(),[
  URLS.parent,URLS.tools,URLS.legacy,URLS.rea,URLS.llama
 ].sort());
});
test('V4.3 unified chat does not claim ready without independent model health',async()=>{
 const values=make();values[URLS.llama]={status:'loading'};
 const status=await createUnifiedTaskChat({request:async uri=>values[uri]}).status();
 assert.equal(status.state,'degraded');assert.equal(status.ai.ready,false);
});
test('V4.3 operator-approved local bridge can observe owned Qwen without invoking /api/ai/start or REA',async()=>{
 const seen=[],toolCalls=[];
 const localTools=[{type:'function',function:{name:'fi_graph_analyze',parameters:{type:'object',properties:{}},description:'graph'}}];
 const client=async (route,body)=>{
  seen.push(route);
  if(route==='/api/ai/status')return {state:'stopped'};
  if(route==='/__raw_llama_health__')return {status:'ok'};
  if(route==='/api/cognition/health')return {version:'fi-cognitive-live-bridge-v1',reaExecutionGrants:0};
  if(route==='/api/cognition/catalogue/status')return {version:'fi-capability-index-v1',localCount:1,executionGrants:0};
  if(route==='/api/ai/tools')return {tools:localTools,local_tool_count:1,rea_tool_count:0};
  if(route==='/__raw_llama__')return {choices:[{message:{content:'I have no local actions to run',tool_calls:[]}}]};
  if(route==='/api/ai/tool-call'){toolCalls.push(body);throw Error('UNEXPECTED_EXECUTION')}
  throw Error('FORBIDDEN_PATH_'+route);
 };
 const bridge=createAutoLocalDashboard({client});
 assert.equal(bridge.status().completedSessions,0);
 const result=await bridge.run({prompt:'Analyze a graph',rounds:1});
 assert.equal(result.actions.length,0);
 assert.equal(result.reaExecutionGrants,0);
 assert.equal(toolCalls.length,0);
 assert.equal(seen.includes('/api/ai/start'),false);
 assert.equal(seen.includes('/api/ai/chat'),false);
 assert.ok(seen.includes('/__raw_llama_health__'));
});
test('V4.3 embedded local runner verifies independent REA before any local execution when parent has 0',async()=>{
 const observed=make(),reads=[],calls=[];
 const embedded=createEmbeddedLocalToolsV42({
  dashboard:{
   status:()=>({version:'fi-auto-local-dashboard-v1',enabled:true,busy:false,reaExecutionGrants:0,scope:'existing_local_registered_tools_only',backgroundExecution:false}),
   run:async args=>{calls.push(args);return {version:'fi-auto-local-dashboard-v1',reaExecutionGrants:0,actions:[],reply:'No actions'}}
  },
  read:async uri=>{reads.push(uri);return observed[uri]}
 });
 const r=await embedded.run({prompt:'Compute graph'});
 assert.equal(r.legacy8796PostCount,0);
 assert.equal(calls.length,1);
 assert.deepEqual(reads.sort(),[URLS.legacy,URLS.tools,URLS.rea].sort());
});
test('V4.3 refuses local actions when standalone REA is unavailable',async()=>{
 const observed=make();observed[URLS.rea].realReaToolCount=228;
 let executed=0;
 const embedded=createEmbeddedLocalToolsV42({
  dashboard:{
   status:()=>({version:'fi-auto-local-dashboard-v1',enabled:true,busy:false,reaExecutionGrants:0,scope:'existing_local_registered_tools_only',backgroundExecution:false}),
   run:async()=>{executed++}
  },
  read:async uri=>observed[uri]
 });
 await assert.rejects(embedded.run({prompt:'Compute graph'}),/INDEPENDENT_REA_CATALOGUE_NOT_VERIFIED/);
 assert.equal(executed,0);
});
test('V4.3 one command is start-only with idempotent adoption, no activation endpoints or terminating services',async()=>{
 const script=await readFile(new URL('../Start-Fun-Industrial.ps1',import.meta.url),'utf8');
 assert.match(script,/FUN_INDUSTRIAL_ONE_COMMAND=PASS/);
 assert.match(script,/Get-NetTCPConnection/);
 assert.match(script,/Run-Fun-Rea229-Sidecar8797\.mjs/);
 assert.match(script,/--standalone/);
 assert.match(script,/Run-Fun-Unified-Chat8798\.mjs/);
 const runtimeLines=script.split('\n').filter(x=>!x.trimStart().startsWith('#')).join('\n');
 for(const forbidden of ['Stop-Process','taskkill.exe','/api/activate','/api/ai/start','/api/start','/api/rea229/call','/api/rea229/run'])
  assert.equal(runtimeLines.includes(forbidden),false,'unexpected privileged startup path '+forbidden);
 assert.match(script,/FUN_REA_OPERATOR_APPROVAL=REQUIRED/);
 assert.match(script,/FUN_ELEKTRON_OLLAMA=UNTOUCHED/)
});
test('V4.3 independent REA broker keeps previous --serve baseline, adds standalone flag, and no auto tool execution',async()=>{
 const source=await readFile(new URL('../scripts/Run-Fun-Rea229-Sidecar8797.mjs',import.meta.url),'utf8');
 assert.match(source,/--standalone/);
 assert.match(source,/const expectedNames=independent\?undefined:await parentSnapshot/);
 assert.match(source,/active=await activateRea229\(\{expectedNames\}\)/);
 assert.match(source,/runner\.initialize\(\{expectedNames\}\)/);
 assert.doesNotMatch(source,/setInterval\(/);
});
