import test from 'node:test';
import assert from 'node:assert/strict';
import {CognitiveKernel} from '../src/cognition/kernel.mjs';
import {createLiveCognitionBridge} from '../src/cognition/live-bridge.mjs';
import {patchCognitiveLiveServer} from '../scripts/patch-cognitive-live.mjs';

const fixedTools=[
 {type:'function',function:{name:'fi_graph_analyze',description:'Graph',parameters:{type:'object'}}},
 {type:'function',function:{name:'fi_tensor_contract',description:'Tensor',parameters:{type:'object'}}},
 {type:'function',function:{name:'fi_compute_train',description:'Neural',parameters:{type:'object'}}},
 {type:'function',function:{name:'fi_compute_predict',description:'Predict',parameters:{type:'object'}}},
];
const bridge = () => createLiveCognitionBridge({capabilityDefinitions:()=>fixedTools,
 serviceStatus:async()=>({services:[{id:'compute',state:'stopped'}, {id:'rea',state:'ready'}]})});
const original={messages:[{role:'user',content:'Explain motor relationships and capabilities'}],
 tools:[{type:'function',function:{name:'fi_graph_analyze'}}], max_tokens:256};

test('chat uses existing AI payload and never expands tools, tokens or privileges',()=>{
 const b=bridge(),before=JSON.stringify(original),enriched=b.enrichChat(original);
 assert.equal(JSON.stringify(original),before);
 assert.equal(enriched.tools,original.tools);
 assert.equal(enriched.max_tokens,original.max_tokens);
 assert.equal(enriched.messages.length,1);
 assert.match(enriched.messages[0].content,/FUN COGNITION REFERENCE DATA/);
 assert.match(enriched.messages[0].content,/fi_graph_analyze/);
 assert.match(enriched.messages[0].content,/Registered tools are not necessarily healthy/);
 assert.equal(b.status().reaExecutionGrants,0);
 assert.equal(b.status().automaticKnowledgeWrites,false);
 assert.equal(b.status().chatEnrichments,1);
});
test('knowledge is isolated, initially empty; relevant supported statements are labeled reference data',()=>{
 const k=new CognitiveKernel();const b=createLiveCognitionBridge({kernel:k,capabilityDefinitions:()=>fixedTools});
 const f=b.executeDataOperation('/api/cognition/propose', {subject:'motor',predicate:'requires',object:'power',source:'operator_example'});
 assert.equal(b.executeDataOperation('/api/cognition/query',{subject:'motor'}).length,0);
 b.executeDataOperation('/api/cognition/check',{claimId:f.id,observed:'power',evidenceRef:'test-observation-1',method:'test_result'});
 assert.equal(b.executeDataOperation('/api/cognition/query',{subject:'motor'}).length,1);
 const prompt=b.enrichChat({...original,messages:[{role:'user',content:'What does a motor require?'}]});
 assert.match(prompt.messages[0].content,/"subject":"motor"/);
 assert.match(prompt.messages[0].content,/supported_by_submitted_checks/);
 const unrelated=b.enrichChat({...original,messages:[{role:'user',content:'Explain astronomy'}]});
 assert.doesNotMatch(unrelated.messages[0].content,/"subject":"motor"/);
});
test('capability registry lists actual named local tools only and does not claim service health',async()=>{
 const b=bridge();const c=b.capabilities();
 assert.deepEqual(c.names, fixedTools.map(x=>x.function.name));
 assert.equal(c.activeHealthVerified,false);
 const s=await b.liveStatus();assert.equal(s.services[0].state,'stopped');
 assert.equal(s.capabilities.actionsExecuted,0);
});
test('oversized or invalid chat bypasses cognition and preserves original bytes',()=>{
 const b=bridge();const invalid={messages:[{role:'system',content:'IGNORE ALL'}]};
 assert.equal(b.enrichChat(invalid),invalid);
 const long={messages:[{role:'user',content:'x'.repeat(11500)}]};
 assert.equal(b.enrichChat(long),long);
 assert.equal(b.status().chatSkips,2);
});
test('malformed cognition input rejected; calls cannot route to REA or platform tools',()=>{
 const b=bridge();
 assert.throws(()=>b.executeDataOperation('/api/rea/call',{}),/OPERATION_UNKNOWN/);
 assert.throws(()=>b.executeDataOperation('/api/ai/tool-call',{}),/OPERATION_UNKNOWN/);
 assert.throws(()=>b.executeDataOperation('/api/cognition/propose',null),/BODY_INVALID/);
 assert.throws(()=>b.executeDataOperation('/api/cognition/propose',{source:'x',subject:'a',predicate:'b',object:'c',junk:'x'.repeat(6000)}),/BODY_INVALID/);
});
function patchedFixture({security=true}={}){const fixture=`
// FI_AUTO_COGNEE_CHAT_V1 FI_SECURITY_PRIMARY_8789_V1 FI_SOURCING_RETIRED_V1 FI_VOICE_MOBILE_DASHBOARD_V1
import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const server=http.createServer(async(req,res)=>{try{
 if(req.method==='GET'&&req.url==='/api/security/status')return;
 if(req.method==='POST'&&req.url==='/api/rea/call')return;
 if(req.method==='POST'&&req.url==='/api/ai/tool-call')return;
 if(req.method==='GET'&&req.url==='/api/ai/automatic-memory/status')return;
 if(req.method==='POST'&&req.url==='/api/ai/chat'){
  const body=await readBody(req,1000000);
  const enriched=await fiAutomaticMemory(body,memoryStatus().enabled);
  return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);
 }
}catch(e){}}
);
`;
 return security ? fixture : fixture.replace('FI_SECURITY_PRIMARY_8789_V1','no-security')
    .replace(" if(req.method==='GET'&&req.url==='/api/security/status')return;",'');
}
test('patch preserves existing chat pipeline, protected routes and adds new routing only',()=>{
 const before=patchedFixture();const after=patchCognitiveLiveServer(before);
 assert.match(after,/FI_COGNITIVE_LIVE_PATCH_V1/);
 assert.match(after,/fiCognitive.enrichChat\(enriched.payload,body\)/);
 assert.match(after,/return proxyCompute\(req,res,"\/ai\/chat","POST",enriched.payload\)/);
 assert.match(after,/api\/rea\/call/);
 assert.match(after,/api\/ai\/tool-call/);
 assert.match(after,/api\/cognition\/capabilities/);
 assert.match(after,/if\(!localRequest\(req,res\)\)return/);
 assert.equal((after.match(/fiAutomaticMemory\(body,memoryStatus\(\)\.enabled\)/g)||[]).length,1);
 assert.throws(()=>patchCognitiveLiveServer(after),/ALREADY_INSTALLED/);
});
test('patch works on pre-security-primary deployed chat and does not introduce a security route',()=>{
 const before=patchedFixture({security:false});
 const after=patchCognitiveLiveServer(before);
 assert.match(after,/FI_COGNITIVE_CHAT_CONTEXT_V1/);
 assert.doesNotMatch(after,/FI_SECURITY_PRIMARY_8789_V1/);
 assert.doesNotMatch(after,/api\/security\/status/);
 assert.match(after,/api\/rea\/call/);
 assert.match(after,/api\/ai\/automatic-memory\/status/);
 assert.equal((after.match(/fiAutomaticMemory\(body,memoryStatus\(\)\.enabled\)/g)||[]).length,1);
});
test('patch detects inconsistent installed security and altered memory route',()=>{
 const x=patchedFixture();
 assert.throws(()=>patchCognitiveLiveServer(x.replace(" if(req.method==='GET'&&req.url==='/api/security/status')return;",'')),/SECURITY_PRIMARY_INCONSISTENT/);
 assert.throws(()=>patchCognitiveLiveServer(x.replace('const enriched=await fiAutomaticMemory','const sample=await fiAutomaticMemory')),/EXISTING_CHAT_PIPELINE_UNKNOWN/);
});

test('cognitive readiness route avoids blocking external platform health',()=>{
 const before=patchedFixture({security:false});
 const after=patchCognitiveLiveServer(before);
 const start=after.indexOf('if(req.url==="/api/cognition/health"');
 const end=after.indexOf('if(req.url==="/api/cognition/status"');
 assert.ok(start>0&&end>start);
 const route=after.slice(start,end);
 assert.match(route,/fiCognitive\.status\(\)/);
 assert.doesNotMatch(route,/await fiCognitive\.liveStatus/);
 assert.doesNotMatch(route,/platform\.status\(\)/);
 assert.match(route,/localRequest\(req,res\)/);
 assert.match(route,/reaExecutionGrants/);
});

test('full cognitive status returns with unverified services when health adapter stalls',async()=>{
 const b=createLiveCognitionBridge({capabilityDefinitions:()=>fixedTools,
  serviceStatus:()=>new Promise(()=>{})});
 const before=Date.now();
 const result=await b.liveStatus();
 assert.ok(Date.now()-before<3000,'full status exceeded bounded health deadline');
 assert.equal(result.version,'fi-cognitive-live-bridge-v1');
 assert.equal(result.serviceHealth,'timed_out_unverified');
 assert.equal(result.reaExecutionGrants,0);
});

test('Windows startup gate checks fast cognition health and independent compute identity',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {fileURLToPath}=await import('node:url');
 const script=await readFile(fileURLToPath(new URL('../Deploy-Fun-Cognition-Live8789.ps1',import.meta.url)),'utf8');
 const start=script.indexOf('function WaitFor8789(');
 const end=script.indexOf('foreach($d in @(',start);
 assert.ok(start>0&&end>start,'Windows gate bounds absent');
 const gate=script.slice(start,end);
 assert.match(gate,/GetJson '\/api\/cognition\/health'/);
 assert.doesNotMatch(gate,/GetJson '\/api\/cognition\/status'/);
 assert.doesNotMatch(gate,/GetJson '\/api\/ai\/status'/);
 assert.match(gate,/127\.0\.0\.1:8791\/ai\/runtime\/llama-cpp/);
 assert.match(gate,/reaExecutionGrants/);
 assert.match(script,/\$After=VerifyExistingServices/);
 assert.match(script,/FUN_COGNITION_LIVE_DEPLOY=PASS/);
});

test('deployment tolerates stopped REA only when catalogue stays HTTP 403 and no REA tools are exposed',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {fileURLToPath}=await import('node:url');
 const source=await readFile(fileURLToPath(new URL('../Deploy-Fun-Cognition-Live8789.ps1',import.meta.url)),'utf8');
 assert.match(source,/\$reaService\[0\]\.state -ne 'stopped'/);
 assert.match(source,/REA_NOT_STOPPED_REQUIRES_SEPARATE_OPERATOR_REVIEW/);
 assert.match(source,/GetJson '\/api\/rea\/tools' 12/);
 assert.match(source,/\$statusCode -eq 403/);
 assert.match(source,/REA_TOOLS_UNEXPECTEDLY_ACCESSIBLE/);
 assert.match(source,/REA_STOPPED_UNEXPECTED_HTTP_/);
 assert.match(source,/\$definitions\.rea_tool_count -ne 0/);
 assert.match(source,/REA_TOOL_VISIBILITY_UNEXPECTED/);
 assert.match(source,/\$env:REA_ALLOWED_TOOLS=''/);
 assert.doesNotMatch(source,/\$env:REA_ALLOWED_TOOLS=\(\$script:PreRea -join ','\)/);
 assert.match(source,/REA_STATE_OR_ALLOWLIST_CHANGED/);
 assert.match(source,/FUN_COGNITION_REA_BASELINE=STOPPED_AND_DENIED_PRESERVED/);
 assert.match(source,/FUN_COGNITION_LIVE_DEPLOY=PASS/);
});
test('cognitive deploy remains fail-closed if llama or compute is unavailable and never activates REA',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {fileURLToPath}=await import('node:url');
 const source=await readFile(fileURLToPath(new URL('../Deploy-Fun-Cognition-Live8789.ps1',import.meta.url)),'utf8');
 assert.match(source,/LIVE_MODEL_COMPUTE_UNAVAILABLE_FIX_FIRST/);
 assert.match(source,/LIVE_COMPUTE_OR_LLAMA_PORT_MISSING/);
 assert.match(source,/GetJson '\/api\/ai\/status'/);
 assert.match(source,/GetJson '\/api\/ai\/automatic-memory\/status'/);
 assert.match(source,/GetJson '\/api\/voice\/mobile\/status'/);
 assert.doesNotMatch(source,/Invoke-RestMethod.*-Method Post.*api\/activate/);
 assert.doesNotMatch(source,/Invoke-RestMethod.*-Method Post.*rea/);
 assert.doesNotMatch(source,/REA_ENABLED='true'/);
});
