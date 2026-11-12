import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Script} from 'node:vm';
import {createAutoLocalDashboard} from '../src/experimental/auto-local-dashboard.mjs';
import {patchAutoLocalDashboardServer} from '../scripts/patch-auto-local-dashboard-server.mjs';
import {patchAutoLocalDashboardUi} from '../scripts/patch-auto-local-dashboard-ui.mjs';
import {patchCognitiveLiveServer} from '../scripts/patch-cognitive-live.mjs';
import {patchCapabilityLive} from '../scripts/patch-capability-live.mjs';
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
  if(path==='/__llama_health__')return {status:'ok'};
  if(path==='/api/cognition/health')return {version:'fi-cognitive-live-bridge-v1',reaExecutionGrants:0};
  if(path==='/api/cognition/catalogue/status')return {version:'fi-capability-index-v1',localCount:tools.length,executionGrants:0};
  if(path==='/api/ai/tools')return {tools,local_tool_count:tools.length,rea_tool_count:0};
  if(path==='/__raw_llama__')return {choices:[{message:noCalls?{content:'No matching capability',tool_calls:[]}:{content:'Using graph',tool_calls:[toolCall('fi_graph_analyze',{nodes:['A','B'],edges:[['A','B']]})]}}]};
  if(path==='/api/ai/tool-call'){onCall(body);return {tool:body.name,result:{nodes:2,edges:1}}}
  throw Error('UNEXPECTED_ROUTE_'+path);
 };
 return {client,paths};
}
function serverFixture(){
 return [
 "import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import {readFile} from 'node:fs/promises';",
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
  if(path==='/__llama_health__'){notified();await gate;}
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
test('standalone panel works without old chat IDs and preserves existing HTML scripts',()=>{
 const original=uiFixture(),updated=patchAutoLocalDashboardUi(original);
 assert.match(updated,/FI_AUTO_LOCAL_DASHBOARD_UI_V2/);
 assert.match(updated,/id="fi-auto-run"/);
 assert.match(updated,/id="fi-auto-task"/);
 assert.match(updated,/\/api\/ai\/auto-local\/client\.js/);
 assert.match(updated,/id="chat-send"/);
 assert.match(updated,/id="chat-proposals"/);
 assert.match(updated,/document\.getElementById\("chat-send"\)\.onclick=sendChat/);
 assert.ok(updated.includes(original.slice(0,original.indexOf('</body>'))));
 assert.throws(()=>patchAutoLocalDashboardUi(updated),/ALREADY_INSTALLED/);
 const evolved='<html><body><main id="new-dashboard">Alternate page</main></body></html>';
 const compatible=patchAutoLocalDashboardUi(evolved);
 assert.match(compatible,/id="fi-auto-local-panel"/);
 assert.ok(compatible.includes('id="new-dashboard"'));
});
test('patches reject missing baseline instead of silently rewriting an incompatible UI',()=>{
 assert.throws(()=>patchAutoLocalDashboardServer('const server=http.createServer(async(req,res)=>{try{'),/BASELINE_MISSING/);
 assert.throws(()=>patchAutoLocalDashboardUi('<html></html>'),/NO_BODY/);
});
test('new bridge has no direct REA calls, shell, platform mutation or independent daemon',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/experimental/auto-local-dashboard.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\/api\/rea\/call|\/api\/activate|\/api\/stop|child_process|spawn\(|setInterval/);
 assert.match(source,/localhost|127\.0\.0\.1/);
});

test('all three additive server patches compose into one syntactically valid module',()=>{
 const base=[
  "import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import {readFile} from 'node:fs/promises';",
  "// FI_AUTO_COGNEE_CHAT_V1 FI_SOURCING_RETIRED_V1 FI_VOICE_MOBILE_DASHBOARD_V1",
  "const root=path.dirname(fileURLToPath(import.meta.url));",
  "const server=http.createServer(async(req,res)=>{try{",
  " if(req.method==='POST'&&req.url==='/api/rea/call')return;",
  " if(req.method==='POST'&&req.url==='/api/ai/tool-call')return;",
  " if(req.method==='GET'&&req.url==='/api/ai/automatic-memory/status')return;",
  " if(req.method==='POST'&&req.url==='/api/ai/chat'){",
  "  const body=await readBody(req,1000000);",
  "  const enriched=await fiAutomaticMemory(body,memoryStatus().enabled);",
  '  return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);',
  " }",
  "}catch(e){res.end();}});"
 ].join('\n');
 const final=patchAutoLocalDashboardServer(patchCapabilityLive(patchCognitiveLiveServer(base)));
 const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:final,encoding:'utf8'});
 assert.equal(result.status,0,'three-patch generated server syntax: '+result.stderr);
 assert.equal((final.match(/fiAutomaticMemory\(body,memoryStatus\(\)\.enabled\)/g)||[]).length,1);
 assert.match(final,/fiAutoLocalDashboard\.run\(body\)/);
 assert.match(final,/decorateCapabilityChat/);
});
test('patches real repository UI while retaining original chat functionality',async()=>{
 const {readFile}=await import('node:fs/promises');
 const before=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const after=patchAutoLocalDashboardUi(before);
 assert.equal(after.split('id="chat-send"').length,2);
 assert.equal(after.split('id="fi-auto-run"').length,2);
 assert.match(after,/Proposed platform \/ REA actions/);
 assert.match(after,/el\("chat-send"\)\.onclick=sendChat/);
 assert.match(after,/script src="\/api\/ai\/auto-local\/client\.js" defer/);
 const oldJs=[...before.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const newJs=[...after.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 assert.deepEqual(newJs,oldJs);
 const clientSource=await readFile(new URL('../src/experimental/auto-local-client.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Script(clientSource));
});
test('Windows auto-dashboard deployment protects old cognition and independent processes',async()=>{
 const {readFile}=await import('node:fs/promises');
 const script=await readFile(new URL('../Deploy-Fun-Auto-Local-Dashboard8789.ps1',import.meta.url),'utf8');
 assert.match(script,/param\(\[switch\]\$Apply\)/);
 assert.match(script,/FUN_AUTO_DASH_LIVE_DEPLOY=NOT_PERFORMED/);
 assert.match(script,/COGNITIVE_VOLATILE_DATA_WOULD_BE_LOST/);
 assert.match(script,/EmptyCognition \$pre\.Cognitive/);
 assert.match(script,/EmptyCognition \(Json '\/api\/cognition\/status' 12\)/);
 assert.match(script,/CheckRea/);
 assert.match(script,/\$env:REA_ALLOWED_TOOLS=''/);
 assert.match(script,/8088,8791,8443,4479,8794/);
 assert.match(script,/server\.original\.mjs/);
 assert.match(script,/index\.original\.html/);
 assert.match(script,/\$serverCurrent=Hash \$Server/);
 assert.match(script,/\$uiCurrent=Hash \$Ui/);
 assert.match(script,/auto-local-client\.js/);
 assert.match(script,/STANDALONE_UI_MARKER_NOT_FOUND/);
 assert.match(script,/FUN_AUTO_DASH_LIVE_DEPLOY=PASS/);
 assert.match(script,/FUN_AUTO_DASH_ROLLBACK_STARTED_PID/);
 const stops=[...script.matchAll(/Stop-Process -Id ([^\r\n]+)/g)].map(m=>m[1]);
 assert.equal(stops.length,2);
 assert.ok(stops.every(s=>s.includes('$OldPid')||s.includes('$NewProcess.Id')));
 assert.doesNotMatch(script,/\/ai\/runtime\/llama-cpp\/stop|\/api\/stop|\/api\/activate/);
});

test('same-origin client route is staged only and requires host validation',()=>{
 const out=patchAutoLocalDashboardServer(serverFixture());
 assert.match(out,/\/api\/ai\/auto-local\/client\.js/);
 assert.match(out,/readFile\(path\.join\(root,"experimental","auto-local-client\.js"\)\)/);
 assert.match(out,/x-content-type-options/);
});
