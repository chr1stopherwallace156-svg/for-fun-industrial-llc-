import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyParentReadinessV43} from '../scripts/Run-Fun-Rea229-Sidecar8797.mjs';
import {createUnifiedGatewayV4} from '../src/experimental/unified-gateway-v4.mjs';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
import {createEmbeddedLocalToolsV42} from '../src/experimental/embedded-local-tools-v4-2.mjs';

const parentNames=Array.from({length:229},(_,i)=>'rea_tool_'+i);
const local=Array.from({length:19},(_,i)=>({type:'function',function:{name:'fi_local_'+i,parameters:{type:'object',properties:{}}}}));
function fixture(reaCount=0,reaReady=false){
 return {status:{services:[{id:'rea',state:reaReady?'ready':'stopped'}]},
 registered:{local_tool_count:19,rea_tool_count:reaCount,tools:local},
 cognition:{version:'fi-cognitive-live-bridge-v1',reaExecutionGrants:0},
 index:{version:'fi-capability-index-v1',localCount:19,executionGrants:0},
 qwen:{status:'ok'},
 catalogue:reaReady?{tools:parentNames.map(name=>({name}))}:null};
}
test('one-command REA can independently initialize with exactly 19 local and zero parent grants',()=>{
 assert.equal(classifyParentReadinessV43(fixture()),null);
 assert.deepEqual(classifyParentReadinessV43(fixture(229,true)),parentNames);
});
test('REA parent identity drifts fail closed; no unknown catalogue can masquerade as absence',()=>{
 for(const bad of [
  x=>x.registered.local_tool_count=18,x=>x.registered.rea_tool_count=229,
  x=>x.status.services=[{id:'rea',state:'ready'}],x=>x.cognition.reaExecutionGrants=1,
  x=>x.index.executionGrants=1,x=>x.qwen.status='stopped',
  x=>x.registered.tools.pop()
 ]){
  const x=fixture();bad(x);
  assert.throws(()=>classifyParentReadinessV43(x),/HOLD|INCONSISTENT/);
 }
 const x=fixture(229,true);x.catalogue.tools[5].name=x.catalogue.tools[0].name;
 assert.throws(()=>classifyParentReadinessV43(x),/NAMES_INVALID/);
});
test('single-entrypoint V4 accepts parent REA=0 only if actual independent 8797 has 229',async()=>{
 const END={
  'http://127.0.0.1:8789/api/ai/status':{state:'stopped'},
  'http://127.0.0.1:8789/api/ai/tools':{local_tool_count:19,rea_tool_count:0},
  'http://127.0.0.1:8796/api/ai/auto-local/status':{sidecar:true,reaExecutionGrants:0},
  'http://127.0.0.1:8797/api/rea229/status':{liveMcpHealth:'ready',realReaToolCount:229,busy:false},
  'http://127.0.0.1:8088/health':{status:'ok'},
  'http://127.0.0.1:8791/health':{state:'running'}
 };
 const v4=createUnifiedGatewayV4({read:async url=>END[url]});
 const s=await v4.status();
 assert.equal(s.state,'ready');assert.equal(s.registered.parentReaRegistered,0);
 assert.equal(s.registered.rea,229);
 const fail=createUnifiedGatewayV4({read:async url=>url.includes('8797')?
   {liveMcpHealth:'not_ready',realReaToolCount:0,busy:false}:END[url]});
 assert.equal((await fail.status()).state,'degraded');
});
test('embedded local runner checks real 8797 before permitting 19 local tools if parent REA=0',async()=>{
 const reads=[],calls=[];
 const dash={status:()=>({version:'fi-auto-local-dashboard-v1',enabled:true,busy:false,reaExecutionGrants:0,
  scope:'existing_local_registered_tools_only',backgroundExecution:false}),
  run:async input=>{calls.push(input);return {version:'fi-auto-local-dashboard-v1',actions:[],reply:'no tool calls',reaExecutionGrants:0}}};
 const source={
  'http://127.0.0.1:8796/api/ai/auto-local/status':{sidecar:true,busy:false,reaExecutionGrants:0},
  'http://127.0.0.1:8789/api/ai/tools':{local_tool_count:19,rea_tool_count:0},
  'http://127.0.0.1:8797/api/rea229/status':{liveMcpHealth:'ready',realReaToolCount:229,busy:false}
 };
 const service=createEmbeddedLocalToolsV42({dashboard:dash,read:async url=>{reads.push(url);return source[url]}});
 assert.equal((await service.run({prompt:'Run local graph analyze'})).localExecutionMode,'embedded_in_8798');
 assert.equal(calls.length,1);
 assert.equal(reads.includes('http://127.0.0.1:8797/api/rea229/status'),true);
 source['http://127.0.0.1:8797/api/rea229/status'].realReaToolCount=228;
 await assert.rejects(service.run({prompt:'Run local graph analyze'}),/INDEPENDENT_REA_229_NOT_READY/);
 assert.equal(calls.length,1);
});
test('unified chat presents independently healthy Qwen as ready without model or REA execution',async()=>{
 const seen=[];
 const REA='http://127.0.0.1:8797',LOCAL='http://127.0.0.1:8796',PARENT='http://127.0.0.1:8789';
 const app=createUnifiedTaskChat({request:async url=>{
  seen.push(url);
  if(url===REA+'/api/rea229/status')return {liveMcpHealth:'ready',realReaToolCount:229};
  if(url===LOCAL+'/api/ai/auto-local/status')return {sidecar:true};
  if(url===PARENT+'/api/ai/tools')return {local_tool_count:19,rea_tool_count:0};
  if(url===PARENT+'/api/ai/status')return {state:'stopped'};
  if(url==='http://127.0.0.1:8088/health')return {status:'ok'};
  throw Error('UNEXPECTED_ACTION');
 }});
 const status=await app.status();
 assert.equal(status.state,'ready');assert.equal(status.ai.ready,true);
 assert.ok(seen.includes('http://127.0.0.1:8088/health'));
 assert.ok(!seen.some(u=>/\/run$|\/call$|\/completions/.test(u)));
});
test('single command launcher is start-only, has no REA call grant or all-process termination',async()=>{
 const ps=await readFile(new URL('../Start-Fun-Industrial-OneCommand.ps1',import.meta.url),'utf8');
 const cmd=await readFile(new URL('../Start-Fun-Industrial.cmd',import.meta.url),'utf8');
 for(const marker of ['[switch]$Start','NO_AUTOMATIC_RESTART_OR_TERMINATION','FUN_ONE_COMMAND=PASS',
   'FUN_ELEKTRON_11434=PRESERVED','FUN_STARTUP_TOOL_CALLS=0','LOCAL_FIRST_MODE',
   'REA_EXECUTION_PERMISSION_DRIFT','Start-Fun-Industrial-OneCommand.ps1']){
  assert.ok((ps+cmd).includes(marker),marker);
 }
 assert.doesNotMatch(ps,/Stop-Process|taskkill|\/api\/activate|\/api\/start|\/api\/stop|\/api\/shutdown|\/api\/rea229\/run|\/api\/rea229\/call|Set-ScheduledTask|Register-ScheduledTask/);
 assert.match(cmd,/powershell.exe.*-Start/);
});
