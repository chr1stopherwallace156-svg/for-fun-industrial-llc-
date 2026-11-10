// FI_WEB_CHAT_CONSOLIDATION_V1 — staged, additive patch of the deployed dashboard.
// No new page, search panel, model tools, or REA execution authority.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_WEB_CHAT_CONSOLIDATION_V1";
function once(s,needle,replacement){
 const n=s.split(needle).length-1;
 if(n!==1)throw Error("WEB_CHAT_PATCH_ANCHOR_HOLD COUNT="+n+" "+needle.slice(0,65));
 return s.replace(needle,()=>replacement);
}
export function patchChatServer(input){
 if(input.includes(MARK))throw Error("WEB_CHAT_ALREADY_PATCHED");
 for(const marker of ["FI_WEB_PLATFORM_ACTIVATION_V1","FI_OPTIMIZATION_AGENT_V1",
                       "FI_AUTO_COGNEE_CHAT_V1","FI_VOICE_MOBILE_DASHBOARD_V1","FI_SOURCING_RETIRED_V1"]){
  if(!input.includes(marker))throw Error("WEB_CHAT_BASELINE_MISSING_"+marker);
 }
 let result=once(input,
  'import {createWebResearchActivator} from "./web-activation.mjs";',
  'import {createWebResearchActivator} from "./web-activation.mjs";\n'+
  'import {enrichWebChat,addWebSources} from "./intelligence/chat-web.mjs";');
 const original=[
  '  const enriched=await fiAutomaticMemory(body,memoryStatus().enabled);',
  '  return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);'
 ].join("\n");
 const replacement=[
  '  // '+MARK+': normal chat keeps existing automatic read-only memory.',
  '  const enriched=await fiAutomaticMemory(body,memoryStatus().enabled);',
  '  let web;',
  '  try{web=await enrichWebChat(body,{modelPayload:enriched.payload});}',
  '  catch(e){return json(res,503,{error:"WEB_CHAT_SEARCH_HOLD",detail:String(e.message||e).slice(0,180)});}',
  '  if(!web.applied)return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);',
  '  if(web.sources.length===0)return json(res,200,{reply:"Web search returned no usable results. I cannot verify a current answer from this search.",tool_calls:[],web:{searched:true,source_count:0}});',
  '  try{',
  '   const upstream=await fetch("http://127.0.0.1:"+config.compute.port+"/ai/chat",{',
  '    method:"POST",headers:{"content-type":"application/json"},',
  '    body:JSON.stringify(web.payload),signal:AbortSignal.timeout(180000)',
  '   });',
  '   if(!upstream.ok)return json(res,503,{error:"WEB_CHAT_LOCAL_MODEL_HOLD",upstreamStatus:upstream.status});',
  '   const result=await upstream.json();',
  '   if(typeof result?.reply!=="string")return json(res,502,{error:"WEB_CHAT_REPLY_INVALID"});',
  '   return json(res,200,{...result,reply:addWebSources(result.reply,web),tool_calls:[],',
  '     web:{searched:true,source_count:web.sources.length,read_only:true,external_actions_executed:0}});',
  '  }catch(e){return json(res,503,{error:"WEB_CHAT_MODEL_UNAVAILABLE",detail:String(e.message||e).slice(0,150)});}'
 ].join("\n");
 result=once(result,original,replacement);
 const serverAnchor='const server=http.createServer(async(req,res)=>{try{';
 result=once(result,serverAnchor,serverAnchor+"\n"+[
  ' // FI_WEB_CHAT_CLIENT_ROUTE_V1: CSP-compatible existing dashboard enhancement.',
  ' if(req.method==="GET"&&req.url==="/api/ai/chat-web-client.js"){',
  '  if(!localRequest(req,res))return;',
  '  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});',
  '  return res.end(await readFile(path.join(root,"intelligence","chat-web-client.js")));',
  ' }'
 ].join("\n"));
 const csp=[...result.matchAll(/script-src\s+([^;]+);/g)];
 if(csp.length!==1||!/(?:^|\s)'self'(?:\s|$)/.test(csp[0][1]))
  throw Error("WEB_CHAT_CSP_HOLD");
 // Mobile voice status is dispatched through a shared prefix handler, not
 // a literal /api/voice/mobile/status route inside server.mjs.
 // Require the same import + dispatch wiring in input and staged output.
 for(const voiceAnchor of [
  'import {mobileVoiceHandler} from "./voice/mobile-upload.mjs";',
  'if(String(req.url||"").startsWith("/api/voice/mobile/")){',
  'if(await mobileVoiceHandler(req,res))return;'
 ]){
  if(!input.includes(voiceAnchor)||!result.includes(voiceAnchor))
   throw Error("WEB_CHAT_VOICE_DISPATCH_MISSING_"+voiceAnchor.slice(0,55));
 }
 for(const route of ["/api/optimization/agent/analyze","/api/rea/call",
  "/api/ai/automatic-memory/status","/api/activate","/api/web/status"]){
  if(!input.includes(route)||!result.includes(route))
   throw Error("WEB_CHAT_PROTECTED_ROUTE_MISSING_"+route);
 }
 return result;
}
export function patchChatUi(source){
 if(source.includes("FI_WEB_CHAT_CONSOLIDATION_UI_V1"))throw Error("WEB_CHAT_UI_ALREADY_PATCHED");
 for(const marker of ["FI_VOICE_MOBILE_PANEL_V1","FI_OPTIMIZATION_PHASE23_PANEL_V1"]){
  if(!source.includes(marker))throw Error("WEB_CHAT_UI_BASELINE_MISSING_"+marker);
 }
 const close=[...source.matchAll(/<\/body\s*>/gi)];
 if(close.length!==1)throw Error("WEB_CHAT_UI_BODY_ANCHOR_HOLD");
 const snippet='\n<!-- FI_WEB_CHAT_CONSOLIDATION_UI_V1: web search in regular chat only -->\n'+
  '<script src="/api/ai/chat-web-client.js" defer></script>\n';
 return source.slice(0,close[0].index)+snippet+source.slice(close[0].index);
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const [serverIn,uiIn,serverOut,uiOut]=process.argv.slice(2);
  if([serverIn,uiIn,serverOut,uiOut].some(x=>!x)||
     new Set([serverIn,uiIn,serverOut,uiOut].map(x=>resolve(x))).size!==4)
   throw Error("WEB_CHAT_UNIQUE_STAGING_PATHS_REQUIRED");
  writeFileSync(serverOut,patchChatServer(readFileSync(serverIn,"utf8")),"utf8");
  writeFileSync(uiOut,patchChatUi(readFileSync(uiIn,"utf8")),"utf8");
  console.log("FUN_WEB_CHAT_CONSOLIDATION_STAGE=PASS EXISTING_CHAT_AND_SERVICES_PRESERVED=TRUE");
 }catch(e){console.error("FUN_WEB_CHAT_CONSOLIDATION_STAGE_HOLD="+String(e.message||e));process.exitCode=1;}
}
