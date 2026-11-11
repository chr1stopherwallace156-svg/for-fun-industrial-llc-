import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Script} from 'node:vm';
import {createAutoLocalDashboard} from '../src/experimental/auto-local-dashboard.mjs';
import {patchAutoLocalDashboardServer} from '../scripts/patch-auto-local-dashboard-server.mjs';
import {patchAutoLocalDashboardUi} from '../scripts/patch-auto-local-dashboard-ui.mjs';
const tools=['fi_graph_analyze','fi_tensor_contract','fi_compute_train','fi_universe_list',
 'fi_hopfield_store','fi_hopfield_recall','fi_universe_add_bridge'].map(name=>({
 type:'function',function:{name,description:name.replace(/_/g,' '),parameters:{type:'object',properties:{}}}
}));
const toolCall=(name,args)=>({type:'function',function:{name,arguments:JSON.stringify(args)}});
function mockClient({noCalls=false,onCall=()=>{},wait=null}={}){
 const paths=[];
 const client=async(path,body)=>{
  paths.push(path);
  if(wait)await wait(path);
  if(path==='/api/ai/status')return {state:'ready'};
  if(path==='/api/cognition/health')return {version:'fi-cognitive-live-bridge-v1',reaExecutionGrants:0};
  if(path==='/api/cognition/catalogue/status')return {version:'fi-capability-index-v1',localCount:tools.length,executionGrants:0};
  if(path==='/api/ai/tools')return {tools,local_tool_count:tools.length,rea_tool_count:0};
  if(path==='/api/ai/chat')return noCalls?{reply:'No matching capability',tool_calls:[]}:{
   reply:'Using graph',tool_calls:[toolCall('fi_graph_analyze',{nodes:['A','B'],edges:[['A','B']]})]};
  if(path==='/api/ai/tool-call'){onCall(body);return {tool:body.name,result:{nodes:2,edges:1}}}
  throw Error('UNEXPECTED_ROUTE_'+path);
 };
 return {client,paths};
}
function serverFixture(){
 return [
 "import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';",
 "const root=path.dirname(fileURLToPath(import.meta.url));",
 "/* FI_COGNITIVE_LIVE_PATCH_V1 FI_CAPABILITY_INDEX_LIVE_V1 FI_AUTO_COGNEE_CHAT_V1 FI_VOICE_MOBILE_DASHBOARD_V1",
 "/api/cognition/catalogue/status /api/cognition/status /api/cognition/catalogue/search /api/ai/tool-call /api/rea/call /api/ai/automatic-memory/status /api/cognition/health",
 "const enriched=await fiAutomaticMemory(body,memoryStatus().enabled); */",
 "const server=http.createServer(async(req,res)=>{try{",
 "  if(req.url==='/api/ai/chat')return;",
 " }catch(error){res.end();}});"
 ].join('\n');
}
function uiFixture(){
 return '<!doctype html><body><div id="chat-history"></div>'+
 '<textarea id="chat-input"></textarea><button id="chat-send">Send message</button>'+
 '<button id="chat-clear"></button><button id="ai-stop"></button>'+
 '<button id="security-scan"></button><div id="chat-proposals"></div>'+
 '<script>function sendChat(){};document.getElementById("chat-send").onclick=sendChat;</script></body></html>';
}
test('dashboard automatically executes a registered local function after one operator click',async()=>{
 const executed=[],mock=mockClient({onCall:a=>executed.push(a)});
 const service=createAutoLocalDashboard({client:mock.client});
 assert.equal(service.status().backgroundExecution,false);
 assert.equal(service.status().perToolApprovalPrompts,false);
 const result=await service.run({prompt:'Analyze a graph with nodes A and B connected by an edge',rounds:1});
 assert.equal(result.version,'fi-auto-local-dashboard-v1');
 assert.equal(result.actions.length,1);
 assert.equal(result.actions[0].tool,'fi_graph_analyze');
 assert.equal(executed.length,1);
 assert.equal(service.status().busy,false);
 assert.equal(result.reaExecutionGrants,0);
 assert.equal(mock.paths.includes('/api/rea/call'),false);
});
test('no model calls means no tool execution or fabricated action',async()=>{
 const mock=mockClient({noCalls:true});
 const service=createAutoLocalDashboard({client:mock.client});
 const result=await service.run({prompt:'Explain all installed tools'});
 assert.equal(result.state,'model_declined_or_no_calls');
 assert.equal(result.actions.length,0);
 assert.equal(mock.paths.includes('/api/ai/tool-call'),false);
});
test('concurrent request is rejected and no other session starts',async()=>{
 let release;
 const gate=new Promise(resolve=>release=resolve);
 let notified;
 const entered=new Promise(resolve=>notified=resolve);
 const mock=mockClient({wait:async(path)=>{
  if(path==='/api/ai/status'){notified();await gate;}
 }});
 const service=createAutoLocalDashboard({client:mock.client});
 const pending=service.run({prompt:'Analyze a graph'});
 await entered;
 assert.equal(service.status().busy,true);
 await assert.rejects(service.run({prompt:'Analyze another graph'}),/CONCURRENT_SESSION/);
 release();
 await pending;
 assert.equal(service.status().busy,false);
 assert.equal(service.status().completedSessions,1);
});
test('invalid prompt or rounds cannot invoke any model or executor',async()=>{
 const mock=mockClient();
 const service=createAutoLocalDashboard({client:mock.client});
 await assert.rejects(service.run({prompt:'  '}),/INVALID_PROMPT/);
 await assert.rejects(service.run({prompt:'Analyze graph',rounds:400}),/INVALID_ROUNDS/);
 assert.equal(mock.paths.length,0);
});
test('server patch is additive to cognition and existing tool approval routes',()=>{
 const fixture=serverFixture(),source=patchAutoLocalDashboardServer(fixture);
 for(const marker of ['FI_AUTO_LOCAL_DASHBOARD_PATCH_V1','/api/ai/auto-local/status',
  '/api/ai/auto-local/run','/api/rea/call','/api/ai/tool-call','/api/cognition/health',
  'FI_CAPABILITY_INDEX_LIVE_V1','FI_COGNITIVE_LIVE_PATCH_V1'])
  assert.ok(source.includes(marker),'missing '+marker);
 assert.match(source,/fiAutoLocalDashboard\.run\(body\)/);
 const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:source,encoding:'utf8'});
 assert.equal(result.status,0,'generated server syntax invalid: '+result.stderr);
 assert.throws(()=>patchAutoLocalDashboardServer(source),/ALREADY_INSTALLED/);
});
test('UI patch adds a distinct button and leaves ordinary chat and tool proposals unchanged',()=>{
 const original=uiFixture(),updated=patchAutoLocalDashboardUi(original);
 assert.match(updated,/id="chat-auto-run"/);
 assert.match(updated,/id="chat-auto-state"/);
 assert.match(updated,/\/api\/ai\/auto-local\/run/);
 assert.match(updated,/id="chat-send"/);
 assert.match(updated,/id="chat-proposals"/);
 assert.match(updated,/document\.getElementById\("chat-send"\)\.onclick=sendChat/);
 assert.match(updated,/node\.textContent=/);
 const script=[...updated.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
 assert.throws(()=>patchAutoLocalDashboardUi(updated),/ALREADY_INSTALLED/);
});
test('patches reject missing baseline instead of silently rewriting an incompatible UI',()=>{
 assert.throws(()=>patchAutoLocalDashboardServer('const server=http.createServer(async(req,res)=>{try{'),/BASELINE_MISSING/);
 assert.throws(()=>patchAutoLocalDashboardUi('<html></html>'),/EXISTING_CHAT_MISSING/);
});
test('new bridge has no direct REA calls, shell, platform mutation or independent daemon',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/experimental/auto-local-dashboard.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\/api\/rea\/call|\/api\/activate|\/api\/stop|child_process|spawn\(|setInterval/);
 assert.match(source,/localhost|127\.0\.0\.1/);
});
