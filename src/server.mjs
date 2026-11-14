import {executeCognitivePython} from "./cognition/python-runtime-adapter.mjs";
import http from "node:http";
import {californiaGrants} from "./california-public-data.mjs";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {loadConfig} from "./config.mjs";
import {createPlatform} from "./platform.mjs";
import {openAiToolDefinitions,getPlatformTool} from "./platform-tools.mjs";
import {createAutonomyActivator} from "./autonomy-activation.mjs";
import {createWebResearchActivator} from "./web-activation.mjs";
// FI_WEB_EVIDENCE_BUDGET_SERVER_PATCH_V2
import {enrichWebChat,addWebSources,webChatTokenMetrics} from "./intelligence/chat-web.mjs";
import {policySummary,evaluateSituation} from "./intelligence/rules.mjs";
import {memoryStatus,memoryStorageUsage,memoryAction} from "./intelligence/memory.mjs";
import {createAutomaticMemoryDecorator} from "./intelligence/automatic-memory.mjs";
import {createUnifiedAgent} from "./unified-agent.mjs";
import {mobileVoiceHandler} from "./voice/mobile-upload.mjs";
import {createOptimizationRunner} from "./optimization/runner.mjs";
import {createOptimizationAgent} from "./optimization/agent.mjs";
import {createLiveCognitionBridge} from "./cognition/live-bridge.mjs";
// FI_COGNITIVE_LIVE_PATCH_V1
import {createCapabilityIndex} from "./cognition/capability-index.mjs";
import {decorateCapabilityChat} from "./cognition/capability-chat.mjs";
// FI_CAPABILITY_INDEX_LIVE_V1
const root=path.dirname(fileURLToPath(import.meta.url));
const fiOptimization=createOptimizationRunner();
const fiOptimizationAgent=createOptimizationAgent({runner:fiOptimization});
try{process.loadEnvFile(path.join(root,"../.env"));}catch(error){if(error.code!=="ENOENT")throw error;}
const config=loadConfig({...process.env,APP_ROOT:path.resolve(root,"..")});
const platform=createPlatform(config),page=await readFile(path.join(root,"../public/index.html"));
const unifiedAgent=createUnifiedAgent({root:path.resolve(root,".."),config,platform,openAiToolDefinitions});
function json(res,code,data){res.writeHead(code,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(data));}
function localRequest(req,res){
 const host=req.headers.host||"";
 if(!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)){json(res,403,{error:"local host only"});return false;}
 const origin=req.headers.origin,allowed=["http://127.0.0.1:"+config.port,"http://localhost:"+config.port,"http://[::1]:"+config.port];
 if(origin&&!allowed.includes(origin)){json(res,403,{error:"origin rejected"});return false;}
 return true;
}
async function requireVpnGate(res){
 const status=await platform.status();
 if(status.vpn_policy.required&&status.vpn_policy.state!=="connected"){json(res,403,{error:"Fun Industrial is fail-closed: connect NetBird and its approved exit-node route before using AI, compute, or REA capabilities.",vpn_policy:status.vpn_policy});return false;}
 return true;
}
async function readBody(req,max=1000000){
 let body="";for await(const chunk of req){body+=chunk.toString("utf8");if(body.length>max)throw new Error("request too large");}
 if(!body)return {};try{return JSON.parse(body);}catch{throw new Error("invalid JSON body");}
}
async function proxyCompute(req,res,pathName,method="POST",body=null){
 try{
  const response=await fetch("http://127.0.0.1:"+config.compute.port+pathName,{method,headers:body===null?{}:{"content-type":"application/json"},body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  const raw=await response.text();res.writeHead(response.status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(raw);
 }catch(error){json(res,503,{error:"compute service unavailable",detail:error.message});}
}
const computeRoutes={"/api/compute/graph":"/graph/analyze","/api/compute/tensor":"/tensor/matmul","/api/compute/train":"/nn/train","/api/compute/predict":"/nn/predict"};
const aiRoutes={"/api/ai/status":{path:"/ai/runtime/llama-cpp",method:"GET"},"/api/ai/start":{path:"/ai/runtime/llama-cpp/start",method:"POST"},"/api/ai/stop":{path:"/ai/runtime/llama-cpp/stop",method:"POST"},"/api/ai/chat":{path:"/ai/chat",method:"POST"}};
const autonomyActivator=createAutonomyActivator();
const webResearchActivator=createWebResearchActivator();
let fiMemoryInFlight=false;
const fiAutomaticMemory=createAutomaticMemoryDecorator(query=>memoryAction("recall",{query}),{budgetMs:Math.max(15000,Math.min(180000,Number(process.env.FI_COGNEE_RECALL_BUDGET_MS)||90000))});
const fiCognitive=createLiveCognitionBridge({
 capabilityDefinitions:()=>openAiToolDefinitions([]),
 serviceStatus:()=>platform.status()
});
const fiCapabilityIndex=createCapabilityIndex({
 localDefinitions:()=>openAiToolDefinitions([]),
 reaCatalogue:()=>platform.reaCatalog()
});
const server=http.createServer(async(req,res)=>{try{
 // FI_GROUNDED_RESEARCH_ROUTE_V1
 if(req.method==="POST"&&req.url==="/api/research/grounded-answer"){
  if(!localRequest(req,res))return;
  if(!await requireVpnGate(res))return;
  const data=await readBody(req,12000);
  if(!data||typeof data!=="object"||Array.isArray(data))return json(res,400,{error:"GROUNDING_REQUEST_INVALID"});
  const database=process.env.FUN_EVIDENCE_DATABASE;
  const python=process.env.FUN_COGNITION_PYTHON;
  if(!database||!python)return json(res,503,{error:"GROUNDING_NOT_CONFIGURED"});
  try{
   const {answerWithGroundedClaim}=await import("./cognition/grounded-qwen-v1.mjs");
   const result=await answerWithGroundedClaim({database,python,claim_id:data.claim_id,question:data.question});
   return json(res,200,result);
  }catch(e){return json(res,422,{error:"GROUNDING_HOLD",detail:String(e.message||e).slice(0,300)});}
 }

if(req.method==="POST"&&["/api/cognition/runtime/rank","/api/cognition/runtime/verify"].includes(req.url)){if(!localRequest(req,res))return;const body=await readBody(req,250000);const action=req.url.endsWith("/rank")?"rank":"verify";if(!body||typeof body!=="object"||Array.isArray(body)||body.action&&body.action!==action)return json(res,400,{error:"COGNITIVE_ACTION_MISMATCH"});try{return json(res,200,await executeCognitivePython({...body,action}));}catch(error){return json(res,422,{error:"COGNITIVE_RUNTIME_HOLD",detail:String(error.message).slice(0,300)});}}

 if(req.method==="GET"&&req.url==="/api/public-data/california/client.js"){if(!localRequest(req,res))return;res.writeHead(200,{"content-type":"application/javascript; charset=utf-8","cache-control":"no-store"});return res.end(await readFile(path.join(root,"../public/california-public-data.js")))} if(req.method==="GET"&&req.url.startsWith("/api/public-data/california/grants?")){if(!localRequest(req,res))return;return californiaGrants(req,res)}
 // FI_CAPABILITY_INDEX_LIVE_V1: informational discovery, never a tool execution route.
 if(req.url==="/api/cognition/catalogue/status"&&req.method==="GET"){
  if(!localRequest(req,res))return;
  return json(res,200,fiCapabilityIndex.status());
 }
 if(req.url==="/api/cognition/catalogue/search"&&req.method==="POST"){
  if(!localRequest(req,res))return;
  const body=await readBody(req,2000);
  return json(res,200,fiCapabilityIndex.search(body));
 }
 if(req.url==="/api/cognition/catalogue/refresh-rea"&&req.method==="POST"){
  if(!localRequest(req,res))return;
  const body=await readBody(req,100);
  if(Object.keys(body).length!==0)return json(res,400,{error:"EMPTY_BODY_REQUIRED"});
  return json(res,200,await fiCapabilityIndex.refreshRea());
 }
 // FI_COGNITIVE_LIVE_PATCH_V1: data-only introspection and bounded cognitive operations.
 if(req.url==="/api/cognition/health"&&req.method==="GET"){
  if(!localRequest(req,res))return;
  const s=fiCognitive.status();
  return json(res,200,{version:s.version,liveChatDecorator:s.liveChatDecorator,
   reaExecutionGrants:s.reaExecutionGrants,source:"local_in_process",
   externalServicesVerified:false});
 }
 if(req.url==="/api/cognition/status"&&req.method==="GET"){
  if(!localRequest(req,res))return;
  return json(res,200,await fiCognitive.liveStatus());
 }
 if(req.url==="/api/cognition/capabilities"&&req.method==="GET"){
  if(!localRequest(req,res))return;
  return json(res,200,fiCognitive.capabilities());
 }
 if(req.method==="POST"&&Object.hasOwn(fiCognitive.routes,req.url)){
  if(!localRequest(req,res))return;
  const data=await readBody(req,5000);
  return json(res,200,fiCognitive.executeDataOperation(req.url,data));
 }
 // FI_WEB_CHAT_CLIENT_ROUTE_V1: CSP-compatible existing dashboard enhancement.
 if(req.method==="GET"&&req.url==="/api/ai/chat-web-client.js"){
  if(!localRequest(req,res))return;
  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
  return res.end(await readFile(path.join(root,"intelligence","chat-web-client.js")));
 }
 // FI_WEB_PLATFORM_ACTIVATION_V1 â€” observational health, no unauthenticated web-launch endpoint.
 if(req.method==="GET"&&req.url==="/api/web/status"){
  if(!localRequest(req,res))return;return json(res,200,await webResearchActivator.status());
 }
 // FI_OPTIMIZATION_AGENT_V1: local offline optimization only. REA execution remains disabled.
 if(req.method==="GET"&&req.url==="/api/optimization/agent/status"){
  if(!localRequest(req,res))return;
  return json(res,200,fiOptimizationAgent.status());
 }
 if(req.method==="GET"&&req.url==="/api/optimization/agent/client.js"){
  if(!localRequest(req,res))return;
  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
  return res.end(await readFile(path.join(root,"optimization","agent-client.js")));
 }
 if(req.method==="POST"&&(req.url==="/api/optimization/agent/analyze"||req.url==="/api/optimization/agent/approve")){
  if(!localRequest(req,res))return;
  if(req.headers["x-fi-optimization-approval"]!=="operator-reviewed"||
     req.headers["content-type"]!=="application/json"||req.headers["sec-fetch-site"]==="cross-site")
   return json(res,403,{error:"OPT_AGENT_OPERATOR_REVIEW_REQUIRED"});
  const body=await readBody(req,32768);
  if(!body||typeof body!=="object"||Array.isArray(body))return json(res,400,{error:"OPT_AGENT_INVALID_BODY"});
  try{
   if(req.url==="/api/optimization/agent/analyze"){
    if(Object.keys(body).some(k=>k!=="request"&&k!=="problem"))return json(res,400,{error:"OPT_AGENT_UNEXPECTED_FIELDS"});
    return json(res,200,await fiOptimizationAgent.analyze(body));
   }
   if(Object.keys(body).sort().join(",")!=="action,ticket")return json(res,400,{error:"OPT_AGENT_UNEXPECTED_FIELDS"});
   return json(res,200,await fiOptimizationAgent.approve(body));
  }catch(error){return json(res,400,{error:String(error.message||"OPT_AGENT_HOLD").slice(0,300)});}
 }
 // FI_OPTIMIZATION_PHASE23_V1: preserves existing REA, memory, voice and platform routes.
 if(req.method==="GET"&&req.url==="/api/optimization/client.js"){
  if(!localRequest(req,res))return;
  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
  return res.end(await readFile(path.join(root,"optimization","client.js")));
 }
 if(req.method==="GET"&&req.url==="/api/optimization/status"){
  if(!localRequest(req,res))return;
  return json(res,200,fiOptimization.status());
 }
 if(req.method==="POST"&&req.url==="/api/optimization/run"){
  if(!localRequest(req,res))return;
  if(req.headers["x-fi-optimization-approval"]!=="operator-reviewed"||
     req.headers["content-type"]!=="application/json"||
     req.headers["sec-fetch-site"]==="cross-site")
   return json(res,403,{error:"OPTIMIZATION_EXPLICIT_APPROVAL_REQUIRED"});
  const body=await readBody(req,32768);
  if(!body||typeof body!=="object"||Array.isArray(body)||
     Object.keys(body).sort().join(",")!=="action,problem")
   return json(res,400,{error:"OPTIMIZATION_INVALID_REQUEST"});
  try{return json(res,200,await fiOptimization.run(body.action,body.problem));}
  catch(error){return json(res,400,{error:String(error.message||"OPTIMIZATION_HOLD").slice(0,330)});}
 }
 // FI_VOICE_MOBILE_DASHBOARD_V1: preserves existing chat, REA, Cognee and service startup.
 if(req.method==="GET"&&req.url==="/api/voice/mobile/client.js"){
  if(!localRequest(req,res))return;
  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
  return res.end(await readFile(path.join(root,"voice","mobile-client.js")));
 }
 if(String(req.url||"").startsWith("/api/voice/mobile/")){
  if(!localRequest(req,res))return;
  if(await mobileVoiceHandler(req,res))return;
 }
 // FI_LOCAL_INTELLIGENCE_V1 â€” local deterministic decisions and operator-triggered Cognee.
 if(req.method==="GET"&&req.url==="/api/intelligence/status"){
  if(!localRequest(req,res))return;
  return json(res,200,{rules:policySummary(),memory:memoryStatus()});
 }
 if(req.method==="GET"&&req.url==="/api/intelligence/storage"){
  if(!localRequest(req,res))return;
  return json(res,200,await memoryStorageUsage());
 }
 if(req.method==="POST"&&req.url==="/api/intelligence/evaluate"){
  if(!localRequest(req,res))return;
  const facts=await readBody(req,3000);
  return json(res,200,await evaluateSituation(facts));
 }
 if(req.method==="POST"&&["/api/intelligence/memory/remember","/api/intelligence/memory/recall"].includes(req.url)){
  if(!localRequest(req,res))return;
  if(fiMemoryInFlight)return json(res,429,{error:"MEMORY_OPERATION_BUSY"});
  const action=req.url.endsWith("/remember")?"remember":"recall";
  const input=await readBody(req,5000);
  fiMemoryInFlight=true;
  try{const data=await memoryAction(action,input);return json(res,200,data);}
  finally{fiMemoryInFlight=false;}
 }
 // FI_AUTONOMY_8789_PROXY_V1: read-only same-origin routing; backend stays on loopback 8792.
 const autonomyPaths={"/api/autonomy/status":"/api/status","/api/autonomy/tasks":"/api/tasks","/api/autonomy/events":"/api/events","/api/autonomy/research":"/api/research","/api/autonomy/rea":"/api/rea"} /* FI_INTERNATIONAL_SOURCE_V1 */;
 // FI_SOURCING_RETIRED_V1: 410 on both retired sources, all other APIs unchanged.
 if(["/api/autonomy/scan","/api/autonomy/opportunities","/api/autonomy/international"].includes(req.url))return json(res,410,{error:"SOURCING_RETIRED",dataPreserved:true});
 if(req.method==="GET"&&Object.prototype.hasOwnProperty.call(autonomyPaths,req.url)){
   if(!localRequest(req,res))return;
   try{
     const r=await fetch("http://127.0.0.1:8792"+autonomyPaths[req.url],{signal:AbortSignal.timeout(6500),redirect:"error"});
     const raw=await r.text();
     if(raw.length>900000)throw Error("AUTONOMY_RESPONSE_TOO_LARGE");
     return json(res,r.status,JSON.parse(raw));
   }catch(error){return json(res,503,{error:"AUTONOMY_BACKEND_UNAVAILABLE",detail:String(error.message).slice(0,140)});}
 }
 if(req.method==="GET"&&req.url==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});return res.end(page);}
 if(req.url.startsWith("/api/unified/")){if(!localRequest(req,res))return;if(req.url==="/api/unified/chat"&&!await requireVpnGate(res))return;return unifiedAgent(req,res);}
 // FI_AUTONOMY_PLATFORM_ACTIVATION_V1: include current worker readiness in platform controls.
 if(req.method==="GET"&&req.url==="/api/status"){const status=await platform.status(),worker=await autonomyActivator.status();return json(res,200,{...status,services:[...(status.services||[]),{id:"web",name:"Web Research / DDGS",...(await webResearchActivator.status())},{id:"autonomy",name:"Autonomous Workers",state:worker.state,detail:worker.state==="running"?"Sidequest coordinator PID "+worker.pid:worker.detail}]});}
 if(req.method==="GET"&&req.url==="/api/ai/status"){if(!localRequest(req,res))return;const state=await platform.status();if(state.vpn_policy.required&&state.vpn_policy.state!=="connected")return json(res,200,{state:"blocked",detail:state.vpn_policy.detail});return proxyCompute(req,res,"/ai/runtime/llama-cpp","GET");}
 if(req.method==="GET"&&req.url==="/api/ai/tools"){
  if(!localRequest(req,res))return;
  let reaTools=[],reaError=null;
  try{reaTools=await platform.reaTools();}catch(error){reaError=error.message;}
  return json(res,200,{tools:openAiToolDefinitions(reaTools),local_tool_count:openAiToolDefinitions([]).length,rea_tool_count:reaTools.length,rea_error:reaError});
 }
 if(req.method==="POST"&&req.url==="/api/ai/tool-call"){
  if(!localRequest(req,res))return;
  if(!await requireVpnGate(res))return;
  const body=await readBody(req,1000000);
  if(typeof body.name!=="string"||body.name.length>128||!body.arguments||typeof body.arguments!=="object"||Array.isArray(body.arguments))return json(res,400,{error:"invalid tool name or arguments"});
  try{
   if(body.name.startsWith("rea__")){if(body.approved!==true)return json(res,403,{error:"Operator approval required"});return json(res,200,{tool:body.name,result:await platform.callReaTool(body.name.slice(5),body.arguments)});}
   if(body.name==="fi_web_search"){if(body.approved!==true)return json(res,403,{error:"Approval required"});const q=body.arguments.query;if(typeof q!=="string"||!q.trim()||q.length>300)return json(res,400,{error:"Invalid search query"});const n=body.arguments.max_results??5;if(!Number.isInteger(n)||n<1||n>5)return json(res,400,{error:"max_results must be between 1 and 5"});const u=new URL("http://127.0.0.1:4479/search/text");u.searchParams.set("query",q);u.searchParams.set("max_results",String(n));const r=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)return json(res,502,{error:"DDGS search failed",status:r.status});const d=await r.json();const results=(Array.isArray(d.results)?d.results:[]).slice(0,n).map(x=>({title:String(x.title||"").slice(0,300),href:String(x.href||"").slice(0,2048),body:String(x.body||"").slice(0,1000)}));return json(res,200,{tool:body.name,result:{results}});}
   const tool=getPlatformTool(body.name);if(!tool)return json(res,403,{error:"tool is not in the fixed Fun Industrial tool registry"});
   const args={...(body.arguments||{})};let pathName=tool.path||tool.pathTemplate;
   if(tool.pathTemplate){if(typeof args.universe_id!=="string"||!args.universe_id.length)throw new Error("universe_id is required");pathName=tool.pathTemplate.replace("{universe_id}",encodeURIComponent(args.universe_id));if(!["fi_universe_neural_state_set"].includes(tool.name))delete args.universe_id;}
   const method=tool.method||"POST";
   if(method==="GET"){const query=new URLSearchParams();if(args.neighbours!==undefined)query.set("neighbours",String(args.neighbours));if(query.size)pathName+="?"+query.toString();}
   const response=await fetch("http://127.0.0.1:"+config.compute.port+pathName,{method,headers:method==="GET"?{}:{"content-type":"application/json"},body:method==="GET"?undefined:JSON.stringify(args),signal:AbortSignal.timeout(180000)});
   const raw=await response.text();let result;try{result=JSON.parse(raw)}catch{result={raw:raw.slice(0,12000)}}
   if(!response.ok)return json(res,response.status,{error:result.detail||result.error||"platform tool failed",detail:result});
   return json(res,200,{tool:body.name,result});
  }catch(error){return json(res,403,{error:error.message});}
 }

 if(req.method==="POST"&&req.url==="/api/rea/start"){if(!localRequest(req,res))return;await readBody(req,1024);try{return json(res,200,await platform.startReaOnly());}catch(e){return json(res,403,{error:e.message});}}
 if(req.method==="GET"&&req.url==="/api/rea/catalog"){if(!localRequest(req,res))return;try{return json(res,200,{tools:await platform.reaCatalog()});}catch(e){return json(res,403,{error:e.message});}}
 if(req.method==="GET"&&req.url==="/api/rea/tools"){if(!localRequest(req,res))return;try{return json(res,200,{tools:await platform.reaTools()});}catch(e){return json(res,403,{error:e.message});}}
 if(req.method==="POST"&&req.url==="/api/rea/call"){if(!localRequest(req,res))return;const body=await readBody(req,1000000);if(body.approved!==true)return json(res,403,{error:"Operator approval required"});try{return json(res,200,{tool:body.name,result:await platform.callReaTool(body.name,body.arguments)});}catch(e){return json(res,403,{error:e.message});}}
 if(req.method==="POST"&&computeRoutes[req.url]){if(!localRequest(req,res))return;if(!await requireVpnGate(res))return;const body=await readBody(req);return proxyCompute(req,res,computeRoutes[req.url],"POST",body);}
 // FI_AUTO_COGNEE_CHAT_V1 â€” implicit read-only recall in EXISTING local chat (no new tools).
 if(req.method==="GET"&&req.url==="/api/ai/automatic-memory/status"){
  if(!localRequest(req,res))return;
  return json(res,200,{...fiAutomaticMemory.getStatus(),memoryAvailable:memoryStatus().enabled});
 }
 if(req.method==="POST"&&req.url==="/api/ai/chat"){
  if(!localRequest(req,res))return;
  if(!await requireVpnGate(res))return;
  const body=await readBody(req,1000000);
  // FI_WEB_CHAT_CONSOLIDATION_V1: normal chat keeps existing automatic read-only memory.
  let enriched=await fiAutomaticMemory(body,memoryStatus().enabled);
 // FI_COGNITIVE_CHAT_CONTEXT_V1: additive informational context, never tools.
 try{enriched={...enriched,payload:fiCognitive.enrichChat(enriched.payload,body)};}
 catch(_cognitiveError){/* no cognitive failure may break existing local AI chat */}
 // FI_CAPABILITY_INDEX_LIVE_V1: optional bounded reference data, never callable model tools.
 try{enriched={...enriched,payload:decorateCapabilityChat(enriched.payload,body,fiCapabilityIndex)};} catch(_capabilityError){/* informational catalogue cannot break existing chat */}
  let web;
  try{web=await enrichWebChat(body,{modelPayload:enriched.payload});}
  catch(e){return json(res,503,{error:"WEB_CHAT_SEARCH_HOLD",detail:String(e.message||e).slice(0,180)});}
  if(!web.applied)return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);
  if(web.sources.length===0)return json(res,200,{reply:"Web search returned no usable results. I cannot verify a current answer from this search.",tool_calls:[],web:{searched:true,source_count:0}});
  try{
   const upstream=await fetch("http://127.0.0.1:"+config.compute.port+"/ai/chat",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(web.payload),signal:AbortSignal.timeout(180000)
   });
   if(!upstream.ok)return json(res,503,{error:"WEB_CHAT_LOCAL_MODEL_HOLD",upstreamStatus:upstream.status});
   const result=await upstream.json();
   if(typeof result?.reply!=="string")return json(res,502,{error:"WEB_CHAT_REPLY_INVALID"});
   return json(res,200,{...result,reply:addWebSources(result.reply,web),tool_calls:[],
     web:{searched:true,source_count:web.sources.length,read_only:true,external_actions_executed:0,token_budget:webChatTokenMetrics(result,web)}});
  }catch(e){return json(res,503,{error:"WEB_CHAT_MODEL_UNAVAILABLE",detail:String(e.message||e).slice(0,150)});}
 }
 if(aiRoutes[req.url]&&req.method===aiRoutes[req.url].method){if(!localRequest(req,res))return;const route=aiRoutes[req.url];if((req.url==="/api/ai/chat"||req.url==="/api/ai/start")&&!await requireVpnGate(res))return;const body=route.method==="POST"?await readBody(req,1000000):null;return proxyCompute(req,res,route.path,route.method,body);}
 const actions=["/api/start","/api/activate","/api/stop","/api/vpn/connect","/api/vpn/disconnect","/api/shutdown"];
 if(req.method==="POST"&&actions.includes(req.url)){
  if(!localRequest(req,res))return;await readBody(req,1024);
  if(req.url==="/api/start"||req.url==="/api/activate"){let result={},platform_error=null;try{result=await platform.start()}catch(error){platform_error=String(error.message||error).slice(0,180)}const autonomy=await autonomyActivator.activate();
   const web=await webResearchActivator.activate();
   return json(res,200,{...result,...(platform_error?{platform_error}:{}),autonomy,web,
    results:[...(result.results||[]),{id:"web",name:"Web Research / DDGS",...web}],
    status:{...result.status,services:[...(result.status?.services||[]),
     {id:"web",name:"Web Research / DDGS",...web}]}});}
  if(req.url==="/api/stop"){
   const old=await platform.stop(),web=await webResearchActivator.stop();
   return json(res,200,{...old,web,results:[...(old.results||[]),{id:"web",name:"Web Research / DDGS",...web}],
    status:{...old.status,services:[...(old.status?.services||[]),
     {id:"web",name:"Web Research / DDGS",...(await webResearchActivator.status())}]}});
  }
  if(req.url==="/api/shutdown"){const result=await platform.stop();json(res,200,{state:"shutting-down",result});setTimeout(()=>server.close(()=>process.exit(0)),250);return;}
  if(req.url==="/api/vpn/connect")return json(res,200,{result:await platform.connectVpn(),status:await platform.status()});
  return json(res,200,{result:await platform.disconnectVpn(),status:await platform.status()});
 }
 return json(res,404,{error:"not found"});
}catch(error){return json(res,error.message==="request too large"?413:400,{error:error.message});}});
server.listen(config.port,config.host,()=>console.log("Fun Industrial Platform listening at http://"+config.host+":"+config.port));
const vpnMonitor=setInterval(()=>{platform.enforceVpnPolicy().catch(()=>{});},5000);vpnMonitor.unref();
const shutdown=async()=>{clearInterval(vpnMonitor);await platform.stop();server.close(()=>process.exit(0));};process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);

