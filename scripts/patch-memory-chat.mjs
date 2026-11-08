// Additive source patch for deployed Fun Industrial chat + Cognee memory.
// Requires the already-installed local intelligence and retired sourcing markers.
// Never replaces existing local chat, sourcing routes, or REA permission handling.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_OPT_IN_MEMORY_CHAT_V1";
function once(s,a,b){
 if(s.split(a).length!==2)throw Error("MEMORY_CHAT_PATCH_ANCHOR_HOLD:"+a.slice(0,95));
 return s.replace(a,b);
}
export function patchMemoryChatServer(source){
 if(source.includes(MARK))throw Error("MEMORY_CHAT_ALREADY_INSTALLED");
 if(!source.includes("FI_LOCAL_INTELLIGENCE_V1")||!source.includes("FI_SOURCING_RETIRED_V1"))
  throw Error("MEMORY_CHAT_INTELLIGENCE_OR_RETIREMENT_MISSING");
 let s=once(source,
  'import {memoryStatus,memoryStorageUsage,memoryAction} from "./intelligence/memory.mjs";',
  'import {memoryStatus,memoryStorageUsage,memoryAction} from "./intelligence/memory.mjs";\n'+
  'import {composeMemoryChat,memoryChatStatus} from "./intelligence/memory-chat.mjs";');
 const anchor=' // FI_LOCAL_INTELLIGENCE_V1 — local deterministic decisions and operator-triggered Cognee.';
 const routes=[
  ' // '+MARK+' — opt-in Cognee recall, no memory writes or tool execution.',
  ' if(req.method==="GET"&&req.url==="/api/ai/memory-chat/status"){',
  '  if(!localRequest(req,res))return;',
  '  return json(res,200,{...memoryChatStatus(),memoryAvailable:memoryStatus().enabled});',
  ' }',
  ' if(req.method==="POST"&&req.url==="/api/ai/memory-chat"){',
  '  if(!localRequest(req,res))return;',
  '  if(!await requireVpnGate(res))return;',
  '  if(fiMemoryInFlight)return json(res,429,{error:"MEMORY_OPERATION_BUSY"});',
  '  const input=await readBody(req,33000);',
  '  fiMemoryInFlight=true;',
  '  try{',
  '   let prepared;',
  '   try{prepared=await composeMemoryChat(input,query=>memoryAction("recall",{query}));}',
  '   catch(e){',
  '    if(String(e.message||"").startsWith("MEMORY_CHAT_"))return json(res,400,{error:e.message});',
  '    return json(res,503,{error:"MEMORY_RECALL_UNAVAILABLE",detail:"No chat was sent to llama.cpp. Check the local Cognee memory service."});',
  '   }',
  '   const upstream=await fetch("http://127.0.0.1:"+config.compute.port+"/ai/chat",{',
  '    method:"POST",headers:{"content-type":"application/json"},',
  '    body:JSON.stringify(prepared.modelRequest),signal:AbortSignal.timeout(180000)',
  '   });',
  '   if(!upstream.ok)return json(res,503,{error:"LOCAL_LLAMA_CHAT_UNAVAILABLE",upstreamStatus:upstream.status});',
  '   const response=await upstream.json();',
  '   if(!response||typeof response.reply!=="string")return json(res,502,{error:"LOCAL_LLAMA_RESPONSE_INVALID"});',
  '   return json(res,200,{reply:response.reply,tool_calls:[],model:response.model||"local-model",',
  '    usage:response.usage||{},memory:prepared.metadata,toolExecutionAuthorized:false});',
  '  }catch(e){return json(res,503,{error:"MEMORY_CHAT_MODEL_UNAVAILABLE"});}',
  '  finally{fiMemoryInFlight=false;}',
  ' }'
 ].join("\n");
 s=once(s,anchor,routes+"\n"+anchor);
 return s;
}
export function patchMemoryChatDashboard(source){
 if(source.includes('id="chat-memory"'))throw Error("MEMORY_CHAT_UI_ALREADY_INSTALLED");
 const anchor='<div class="actions"><button id="chat-send">Send message</button><button id="chat-clear" class="secondary">Clear conversation</button></div>';
 const replacement='<div class="actions"><label class="small"><input id="chat-memory" type="checkbox"> Use Cognee memory (read-only, no tools)</label><span id="chat-memory-status" class="muted small" aria-live="polite">Memory off · ordinary chat unchanged</span></div>'+anchor;
 let s=once(source,anchor,replacement);
 s=once(s,
  'async function sendChat(){if(!availableAiTools.length)await refreshRea();',
  'async function sendChat(){if(!el("chat-memory").checked&&!availableAiTools.length)await refreshRea();');
 const original='const d=await api("/api/ai/chat",{messages:chatMessages.slice(-20),max_tokens:512,temperature:0.7,tools:openAITools()});';
 const modified=[
  'const useMemory=el("chat-memory").checked;',
  'const d=await api(useMemory?"/api/ai/memory-chat":"/api/ai/chat",',
  ' useMemory?{messages:chatMessages.slice(-20),max_tokens:512,temperature:0.7}',
  ' :{messages:chatMessages.slice(-20),max_tokens:512,temperature:0.7,tools:openAITools()});',
  'el("chat-memory-status").textContent=useMemory?',
  ' ("Read-only memory · "+(d.memory?.excerptsIncluded??0)+" excerpts · no tools executed")',
  ' :"Memory off · ordinary chat unchanged";'
 ].join("");
 s=once(s,original,modified);
 s=once(s,'el("chat-send").onclick=sendChat;',
  'el("chat-memory").onchange=()=>{el("chat-memory-status").textContent=el("chat-memory").checked?"Memory on · read-only · no tools":"Memory off · ordinary chat unchanged";};\n'+
  'el("chat-send").onclick=sendChat;');
 return s;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [serverInput,serverOutput,uiInput,uiOutput]=process.argv.slice(2);
  if(!serverInput||!serverOutput||!uiInput||!uiOutput)throw Error("FOUR_SOURCE_AND_STAGE_PATHS_REQUIRED");
  if(resolve(serverInput)===resolve(serverOutput)||resolve(uiInput)===resolve(uiOutput))
   throw Error("STAGE_OUTPUT_MUST_BE_SEPARATE");
  writeFileSync(serverOutput,patchMemoryChatServer(readFileSync(serverInput,"utf8")),"utf8");
  writeFileSync(uiOutput,patchMemoryChatDashboard(readFileSync(uiInput,"utf8")),"utf8");
  console.log("MEMORY_CHAT_SOURCE_PATCH=PASS ORIGINALS_UNCHANGED=TRUE");
 }catch(e){console.error("MEMORY_CHAT_SOURCE_PATCH=HOLD "+e.message);process.exitCode=1}
}
