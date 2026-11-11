import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createAutoSidecarServer,HOST,PORT} from '../scripts/Run-Fun-Auto-Sidecar8796.mjs';
import {createAutoLocalDashboard} from '../src/experimental/auto-local-dashboard.mjs';

const defs=Array.from({length:19},(_,i)=>({
 type:'function',function:{name:i===0?'fi_graph_analyze':'fi_tool_'+String(i).padStart(2,'0'),
 description:i===0?'Graph network analysis of nodes and edges':'Fun Industrial local placeholder',
 parameters:{type:'object',properties:{}}}
}));
const rea=Array.from({length:229},(_,i)=>({
 type:'function',function:{name:'rea__inspect_'+String(i).padStart(3,'0'),
 description:'REA informational tool',parameters:{type:'object',properties:{}}}
}));
const call={type:'function',function:{name:'fi_graph_analyze',arguments:JSON.stringify({nodes:['depot','truck1'],edges:[['depot','truck1']]})}};
test('ready REA 229 mixed catalogue still permits one local tool only, never an REA execution',async()=>{
 let executed=0,modelToolNames=[],reaCalls=0;
 const client=async(path,body)=>{
  if(path==='/api/ai/status')return {state:'ready'};
  if(path==='/api/cognition/health')return {version:'fi-cognitive-live-bridge-v1',reaExecutionGrants:0};
  if(path==='/api/cognition/catalogue/status')return {version:'fi-capability-index-v1',localCount:19,executionGrants:0};
  if(path==='/api/ai/tools')return {tools:[...defs,...rea],local_tool_count:19,rea_tool_count:229};
  if(path==='/api/ai/chat'){
   modelToolNames=body.tools.map(x=>x.function.name);
   return {reply:'Tool selected',tool_calls:[call]};
  }
  if(path==='/api/ai/tool-call'){
   executed++;
   assert.equal(body.name,'fi_graph_analyze');
   return {tool:body.name,result:{nodes:2,is_connected:true}};
  }
  if(path.includes('/api/rea'))reaCalls++;
  throw Error('UNEXPECTED_ROUTE_'+path);
 };
 const service=createAutoLocalDashboard({client});
 const result=await service.run({prompt:'Analyze a graph depot connected to truck1',rounds:1});
 assert.equal(result.actions.length,1);
 assert.equal(executed,1);
 assert.equal(reaCalls,0);
 assert.equal(modelToolNames.every(name=>name.startsWith('fi_')),true);
 assert.ok(modelToolNames.length<=6);
 assert.equal(service.status().reaExecutionGrants,0);
});
function mock(){let runs=0;
 const dashboard={status:()=>({version:'fi-auto-local-dashboard-v1',reaExecutionGrants:0,
  busy:false,backgroundExecution:false}),
  run:async()=>{runs++;return {version:'fi-auto-local-dashboard-v1',state:'completed_with_actions',
   registeredLocal:19,actions:[{tool:'fi_graph_analyze',result:{is_connected:true}}],reply:'Connected',reaExecutionGrants:0}}};
 return {dashboard,getRuns:()=>runs};
}
async function withSidecar(fn){
 const m=mock(),server=createAutoSidecarServer({dashboard:m.dashboard,readClient:async()=>'(function(){})();'});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,HOST,resolve)});
 const actualPort=server.address().port;
 function send(method,path,body=null,headers={}){
  return new Promise((resolve,reject)=>{
   const payload=body===null?null:JSON.stringify(body);
   const req=http.request({hostname:HOST,port:actualPort,path,method,headers:{
    host:HOST+':'+PORT,...(payload===null?{}:{'content-type':'application/json'}),...headers
   }},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
     resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),headers:res.headers});
    });
   });
   req.once('error',reject);req.end(payload||undefined);
  });
 }
 try{await fn({send,getRuns:m.getRuns})}finally{await new Promise(resolve=>server.close(resolve))}
}
test('sidecar is inert without explicit --serve and only serves its own UI/client/status',async()=>{
 await withSidecar(async({send,getRuns})=>{
  const page=await send('GET','/');
  assert.equal(page.status,200);assert.match(page.body,/fi-auto-local-panel/);
  assert.match(page.body,/Run AI tools automatically/);
  assert.match(page.headers['content-security-policy'],/script-src 'self'/);
  const js=await send('GET','/api/ai/auto-local/client.js');
  assert.equal(js.status,200);
  const meta=await send('GET','/api/ai/auto-local/status');
  assert.equal(meta.status,200);
  assert.equal(JSON.parse(meta.body).sidecar,true);
  assert.equal(JSON.parse(meta.body).parentProcessesPreserved,true);
  assert.equal(getRuns(),0);
 });
});
test('site-origin mismatch, missing custom click header and wrong host never trigger execution',async()=>{
 await withSidecar(async({send,getRuns})=>{
  const task={prompt:'Analyze depot and truck graph',rounds:1};
  const other=await send('POST','/api/ai/auto-local/run',task,{origin:'http://evil.invalid','x-fi-auto-local':'operator-click'});
  assert.equal(other.status,403);
  const noHeader=await send('POST','/api/ai/auto-local/run',task,{origin:'http://127.0.0.1:8796'});
  assert.equal(noHeader.status,403);
  const missingOrigin=await send('POST','/api/ai/auto-local/run',task,{'x-fi-auto-local':'operator-click'});
  assert.equal(missingOrigin.status,403);
  const wrongHost=await send('GET','/api/ai/auto-local/status',null,{host:'evil.invalid'});
  assert.equal(wrongHost.status,403);
  assert.equal(getRuns(),0);
 });
});
test('one explicitly clicked same-origin request runs one local session, not 8789 restart',async()=>{
 await withSidecar(async({send,getRuns})=>{
  const task={prompt:'Analyze depot and truck graph',rounds:1};
  const ok=await send('POST','/api/ai/auto-local/run',task,{
   origin:'http://127.0.0.1:8796','x-fi-auto-local':'operator-click'});
  assert.equal(ok.status,200,ok.body);
  assert.equal(JSON.parse(ok.body).actions[0].tool,'fi_graph_analyze');
  assert.equal(getRuns(),1);
  const strange=await send('POST','/api/ai/auto-local/run',{prompt:'do stuff',source:'rea'},{
   origin:'http://127.0.0.1:8796','x-fi-auto-local':'operator-click'});
  assert.equal(strange.status,400);
  assert.equal(getRuns(),1);
 });
});
test('sidecar source does not start or stop any external service or modify the 8789 dashboard',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {Script}=await import('node:vm');
 const script=await readFile(new URL('../scripts/Run-Fun-Auto-Sidecar8796.mjs',import.meta.url),'utf8');
 const client=await readFile(new URL('../src/experimental/auto-local-client.js',import.meta.url),'utf8');
 assert.doesNotMatch(script,/Stop-Process|spawn\(|exec\(|platform\.start\(|\/api\/activate|\/api\/stop/);
 assert.match(script,/127\.0\.0\.1/);
 assert.match(client,/x-fi-auto-local/);
 assert.doesNotThrow(()=>new Script(client));
});
test('PowerShell bootstrap explicitly protects 229 ready REA, parent ports and sidecar identity',async()=>{
 const {readFile}=await import('node:fs/promises');
 const text=await readFile(new URL('../Start-Fun-Auto-Sidecar8796.ps1',import.meta.url),'utf8');
 for(const pattern of [/rea_tool_count -ne 229/,/local_tool_count -ne 19/,
 /'REA_229_SESSION_NOT_READY_PRESERVE_HOST'/,/PortOwners 8789/,/PARENT_8789=PRESERVED/,
 /Start-Process -FilePath \$Node/,/SIDECAR_PORT_8796_ALREADY_OWNED_NO_RESTART/]){
  assert.match(text,pattern);
 }
 assert.doesNotMatch(text,/Stop-Process -Id \$OldPid|\/api\/activate|\/api\/stop/);
});
