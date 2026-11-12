import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {createAdaptivePlanner,validateLiveRegistry,buildAdaptivePlan,summarizeAdaptivePlan} from '../src/experimental/adaptive-capability-v2.mjs';
import {createUnifiedTaskChat,routeUnifiedTask} from '../src/experimental/unified-task-chat.mjs';
import {createUnifiedChatServer} from '../scripts/Run-Fun-Unified-Chat8798.mjs';
import {runAdaptiveDiagnostic} from '../scripts/Diagnose-Fun-Adaptive-V2.mjs';

const REA='http://127.0.0.1:8797',LOCAL='http://127.0.0.1:8796',PARENT='http://127.0.0.1:8789';
function samples(){
 const reaCatalogue={tools:Array.from({length:229},(_,i)=>({
  name:i===0?'read_binary':i===1?'inspect_analysis_settings':'rea_test_'+i,
  description:i===0?'Read an executable binary file with a configured provider':'Unknown REA provider-specific tool',
  inputSchema:i===0?{type:'object',properties:{path:{type:'string'}},required:['path']}:
   {type:'object',properties:{},required:[]}
 }))};
 const local=Array.from({length:19},(_,i)=>({
  type:'function',function:{
   name:i===0?'fi_graph_analyze':i===1?'fi_tensor_contract':'fi_other_'+i,
   description:i===0?'Analyze graph nodes and edges for connectivity':'Fun local platform tool',
   parameters:{type:'object',properties:{},required:[]}
  }
 }));
 const localRegistry={tools:[...local,...Array.from({length:229},(_,i)=>({
  type:'function',function:{name:'rea__rea_test_'+i,parameters:{type:'object'}}
 }))],local_tool_count:19};
 return {reaStatus:{liveMcpHealth:'ready',realReaToolCount:229},
  reaCatalogue,localStatus:{sidecar:true},localRegistry};
}
function fixture(){
 const data=samples(),calls=[];
 async function request(url,body){
  calls.push({url,body});
  if(url===REA+'/api/rea229/status')return data.reaStatus;
  if(url===REA+'/api/rea229/tools?limit=229')return data.reaCatalogue;
  if(url===LOCAL+'/api/ai/auto-local/status')return data.localStatus;
  if(url===PARENT+'/api/ai/tools')return data.localRegistry;
  throw Error('FORBIDDEN_UNEXPECTED_ENDPOINT_'+url);
 }
 return {...data,calls,request};
}
test('live discovery checks all 229 REA definitions and exactly 19 original local definitions',()=>{
 const snapshot=validateLiveRegistry(samples());
 assert.equal(snapshot.errors.length,0);
 assert.equal(snapshot.reaCount,229);
 assert.equal(snapshot.localCount,19);
 assert.equal(snapshot.records.length,248);
 assert.equal(snapshot.toolExecutionGrants,0);
 assert.ok(snapshot.records.every(x=>x.providerVerified===false&&x.executionAllowed===false));
});
test('concrete binary inspection ranks matching tool, records missing arguments and unverified provider',()=>{
 const p=buildAdaptivePlan({prompt:'Which tools can read Rust binary executables?',...samples()});
 assert.equal(p.state,'planned_no_execution');
 assert.equal(p.category,'rea_analysis');
 assert.equal(p.candidates[0].name,'read_binary');
 assert.deepEqual(p.candidates[0].requiredArguments,['path']);
 assert.equal(p.candidates[0].operatorApprovalRequired,true);
 assert.equal(p.candidates[0].executionAllowed,false);
 assert.equal(p.executedActions,0);
 assert.match(summarizeAdaptivePlan(p),/no execution/);
});
test('local graph task ranks live local definition without selecting REA effects',()=>{
 const p=buildAdaptivePlan({prompt:'Find tools for graph nodes and edges',...samples()});
 assert.equal(p.category,'local_compute');
 assert.equal(p.candidates[0].name,'fi_graph_analyze');
 assert.equal(p.candidates[0].source,'local');
 assert.equal(p.approvalGranted,false);
});
test('game title alone never promises a native port or real binary analysis',()=>{
 const p=buildAdaptivePlan({prompt:'Which tools can port my iPhone game?',...samples()});
 assert.equal(p.category,'game_app_feasibility');
 assert.ok(p.prerequisites.some(x=>/not provide executable binaries/.test(x)));
 assert.equal(p.executedActions,0);
});
test('unsupported queries return zero candidates, never a guessed fallback',()=>{
 const p=buildAdaptivePlan({prompt:'Find tools to achieve quantum teleportation of humans',...samples()});
 assert.equal(p.candidates.length,0);
 assert.match(p.nextStep,/concrete target/);
 assert.equal(p.executedActions,0);
});
test('catalogue name duplication and invalid schema never grant authority',()=>{
 const d=samples();
 d.reaCatalogue.tools[1]={...d.reaCatalogue.tools[0]};
 let r=validateLiveRegistry(d);
 assert.ok(r.errors.includes('REA_TOOL_DEFINITIONS_INVALID'));
 assert.equal(r.reaCount,0);
 const d2=samples();
 d2.localRegistry.tools[0].function.parameters=null;
 r=validateLiveRegistry(d2);
 assert.ok(r.errors.includes('LOCAL_TOOL_DEFINITIONS_INVALID'));
 assert.equal(r.localCount,0);
 assert.equal(r.toolExecutionGrants,0);
});
test('unknown and malformed required schema fields are reported as blockers',()=>{
 const d=samples();
 d.reaCatalogue.tools[0].inputSchema.required=['path',42];
 const r=buildAdaptivePlan({prompt:'Which tools read binary files?',...d});
 const c=r.candidates.find(x=>x.name==='read_binary');
 assert.equal(c.requiredArguments,null);
 assert.ok(c.prerequisites.includes('input_schema_requires_independent_validation'));
 assert.equal(c.executionAllowed,false);
});
test('partial network or provider failure is reported without invented registrations',async()=>{
 const f=fixture();
 const p=createAdaptivePlanner({request:async url=>{
  if(url===REA+'/api/rea229/status')throw Error('REA_CONNECTION_RESET');
  return f.request(url);
 }});
 const result=await p.plan('Find tools for Rust binary');
 assert.equal(result.state,'partial_discovery');
 assert.equal(result.catalogue.rea,0);
 assert.ok(result.discoveryErrors.includes('REA_PROVIDER_STATUS_NOT_VERIFIED'));
 assert.equal(result.executedActions,0);
});
test('read-only planner makes exactly four local GETs and no calls or model requests',async()=>{
 const f=fixture();
 const p=createAdaptivePlanner({request:f.request});
 const result=await p.plan('Find tools for graph analysis');
 assert.equal(result.catalogue.rea,229);
 assert.equal(result.catalogue.local,19);
 assert.equal(f.calls.length,4);
 assert.deepEqual(new Set(f.calls.map(x=>x.url)),new Set([
  REA+'/api/rea229/status',REA+'/api/rea229/tools?limit=229',
  PARENT+'/api/ai/tools',LOCAL+'/api/ai/auto-local/status'
 ]));
 assert.ok(f.calls.every(x=>x.body===undefined));
});
test('unified chat uses read-only discovery for a normal language tool-finding request',async()=>{
 const f=fixture();
 const app=createUnifiedTaskChat({request:f.request,fetchWeb:()=>{throw Error('NO_WEB_ALLOWED')}});
 assert.equal(routeUnifiedTask('Find tools to analyze a binary').kind,'capability_plan');
 const result=await app.chat({prompt:'Find tools to analyze a binary'});
 assert.equal(result.state,'capability_plan_ready');
 assert.equal(result.route,'capability_plan');
 assert.equal(result.source,'live_capability_catalogues');
 assert.equal(result.actions.length,0);
 assert.equal(result.capabilityPlan.catalogue.rea,229);
 assert.equal(result.capabilityPlan.candidates[0].name,'read_binary');
 assert.equal(f.calls.length,4);
});
test('existing explicit REA settings and public HTTPS classification are preserved',()=>{
 assert.equal(routeUnifiedTask('Inspect the REA MCP analysis settings').kind,'rea_readonly');
 assert.equal(routeUnifiedTask('Analyze https://example.org/').kind,'public_website');
 assert.equal(routeUnifiedTask('Run graph analysis using local compute').kind,'local_action_review');
});
test('operator approval route is not inferred from a capability discovery request',async()=>{
 const f=fixture();
 const app=createUnifiedTaskChat({request:f.request});
 await assert.rejects(app.executeRea({
  prompt:'Find tools to inspect a binary',operatorConfirmed:true
 }),/REA_TASK_NOT_MATCHED/);
 assert.equal(f.calls.length,0);
});
test('one-shot CLI parser remains inert without explicit --plan',()=>{
 const path=fileURLToPath(new URL('../scripts/Diagnose-Fun-Adaptive-V2.mjs',import.meta.url));
 const run=spawnSync(process.execPath,[path],{encoding:'utf8',timeout:12000});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/ADAPTIVE_V2=INACTIVE/);
});
test('one-shot diagnostic truthfully reports count and no authority',async()=>{
 const f=fixture(),logs=[];
 const result=await runAdaptiveDiagnostic({prompt:'Find tools for Rust binary',request:f.request,write:x=>logs.push(x)});
 assert.equal(result.executedActions,0);
 assert.equal(result.approvalGranted,false);
 assert.ok(logs.includes('REGISTERED_REA=229 REGISTERED_LOCAL=19'));
 assert.ok(logs.includes('ADAPTIVE_V2_EXECUTED_ACTIONS=0'));
 assert.ok(logs.some(x=>/CANDIDATE=.*read_binary/.test(x)));
 assert.equal(f.calls.length,4);
});
test('separate same-origin HTTP plan route does not execute a tool',async()=>{
 const f=fixture(),app=createUnifiedTaskChat({request:f.request});
 const server=createUnifiedChatServer({app,readClient:async()=>'(function(){})()'});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 try{
  const result=await new Promise((resolve,reject)=>{
   const post=JSON.stringify({prompt:'Find tools to analyze a Rust binary'});
   const r=http.request({hostname:'127.0.0.1',port:server.address().port,
    method:'POST',path:'/api/unified/capabilities/plan',headers:{
     host:'127.0.0.1:8798',origin:'http://127.0.0.1:8798',
     'x-fi-unified':'operator-click','content-type':'application/json'
    }},res=>{
     const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,
      body:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });r.once('error',reject);r.end(post);
  });
  assert.equal(result.status,200);
  assert.equal(result.body.executedActions,0);
  assert.equal(result.body.authorityGranted,false);
  assert.equal(result.body.noExecution,true);
  assert.equal(f.calls.length,4);
 }finally{await new Promise(r=>server.close(r))}
});
