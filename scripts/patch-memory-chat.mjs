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
export function patchMemoryChatDashboardFallback(source){
 if(source.includes('FI_OPT_IN_MEMORY_CHAT_STANDALONE_V1')||source.includes('id="chat-memory"'))throw Error("MEMORY_CHAT_UI_ALREADY_INSTALLED");
 for(const id of ['fi-cognee-memory-panel','chat-memory-input','chat-memory-send','chat-memory-clear','chat-memory-history','chat-memory-status']){
  if(source.includes('id="'+id+'"'))throw Error("MEMORY_CHAT_UI_ID_COLLISION:"+id);
 }
 const matches=[...source.matchAll(/<\/body\s*>/gi)];
 if(matches.length!==1)throw Error("MEMORY_CHAT_FALLBACK_BODY_ANCHOR_HOLD");
 const html="<!-- FI_OPT_IN_MEMORY_CHAT_STANDALONE_V1: safe UI compatibility path, existing chat untouched -->\n<section class=\"panel\" id=\"fi-cognee-memory-panel\" style=\"padding:16px;margin:16px 0;border:1px solid #40566c;border-radius:12px;background:#172331;color:#eaf1f8\">\n<h2>Local AI · Optional Cognee Memory</h2>\n<p>Separate text-only chat for this dashboard version. Check the box to retrieve memory; no REA tools or memory writes are ever performed here. The existing chat above is unchanged.</p>\n<label style=\"display:block;margin:10px 0\"><input id=\"chat-memory\" type=\"checkbox\"> Use Cognee memory (read-only, no tools)</label>\n<p id=\"chat-memory-status\" aria-live=\"polite\">Cognee memory OFF · normal text-only local chat</p>\n<div id=\"chat-memory-history\" aria-live=\"polite\" style=\"max-height:360px;overflow-y:auto;white-space:pre-wrap\"></div>\n<textarea id=\"chat-memory-input\" rows=\"3\" maxlength=\"4000\" placeholder=\"Ask Fun Industrial local llama.cpp...\" style=\"width:100%;box-sizing:border-box;background:#0d1722;color:#eaf1f8;padding:10px;border:1px solid #40566c\"></textarea>\n<div style=\"display:flex;gap:8px;margin-top:8px\"><button id=\"chat-memory-send\" type=\"button\">Send</button><button id=\"chat-memory-clear\" type=\"button\">Clear chat</button></div>\n</section>\n<script>\n(()=> {\n \"use strict\";\n const get=id=>document.getElementById(id);\n const checkbox=get(\"chat-memory\");\n const entry=get(\"chat-memory-input\");\n const send=get(\"chat-memory-send\");\n const clear=get(\"chat-memory-clear\");\n const status=get(\"chat-memory-status\");\n const history=get(\"chat-memory-history\");\n const messages=[];\n let inFlight=false;\n function note(role,value){\n  const line=document.createElement(\"div\");\n  line.style.cssText=\"padding:8px 0;border-bottom:1px solid #34485d;white-space:pre-wrap;overflow-wrap:anywhere\";\n  line.textContent=(role===\"assistant\"?\"Fun Industrial AI: \":\"You: \")+value;\n  history.appendChild(line);\n  history.scrollTop=history.scrollHeight;\n }\n checkbox.onchange=()=>{\n  status.textContent=checkbox.checked?\"Cognee memory ON · read-only · no tool execution\":\"Cognee memory OFF · normal text-only local chat\";\n };\n clear.onclick=()=>{\n  if(inFlight)return;\n  messages.length=0;\n  history.textContent=\"\";\n  status.textContent=\"Conversation cleared · memory storage unchanged\";\n };\n send.onclick=async()=>{\n  if(inFlight)return;\n  const text=entry.value.trim();\n  if(!text||text.length>4000){\n   status.textContent=\"Enter 1–4000 characters.\";\n   return;\n  }\n  const useMemory=checkbox.checked;\n  const msg={role:\"user\",content:text};\n  const recent=[...messages.slice(-7),msg];\n  // No tools or REA definitions are provided in either mode.\n  const endpoint=useMemory?\"/api/ai/memory-chat\":\"/api/ai/chat\";\n  inFlight=true;\n  send.disabled=true;\n  entry.value=\"\";\n  note(\"user\",text);\n  status.textContent=useMemory?\"Reading local Cognee memory…\":\"Asking local llama.cpp (without tools)…\";\n  try{\n   const r=await fetch(endpoint,{\n    method:\"POST\",\n    headers:{\"content-type\":\"application/json\"},\n    body:JSON.stringify({messages:recent,max_tokens:192,temperature:0.2})\n   });\n   const data=await r.json();\n   if(!r.ok)throw Error(String(data.error||data.detail||(\"HTTP \"+r.status)));\n   if(typeof data.reply!==\"string\")throw Error(\"Local AI reply missing\");\n   // Never render model text as markup or execute proposed calls.\n   messages.push(msg,{role:\"assistant\",content:data.reply});\n   note(\"assistant\",data.reply);\n   status.textContent=useMemory?\n    (\"Cognee used \"+Number(data.memory?.excerptsIncluded||0)+\" excerpts · zero tools · no memory writes\"):\n    \"Text-only llama.cpp chat · Cognee off · zero tools\";\n  }catch(error){\n   status.textContent=\"Chat not completed: \"+String(error.message||error).slice(0,180);\n  }finally{\n   send.disabled=false;\n   inFlight=false;\n  }\n };\n})();\n</script>";
 return source.slice(0,matches[0].index)+html+"\n"+source.slice(matches[0].index);
}

export function patchMemoryChatDashboard(source){
 if(source.includes('id="chat-memory"'))throw Error("MEMORY_CHAT_UI_ALREADY_INSTALLED");
 const anchor='<div class="actions"><button id="chat-send">Send message</button><button id="chat-clear" class="secondary">Clear conversation</button></div>';
 const replacement='<div class="actions"><label class="small"><input id="chat-memory" type="checkbox"> Use Cognee memory (read-only, no tools)</label><span id="chat-memory-status" class="muted small" aria-live="polite">Memory off · ordinary chat unchanged</span></div>'+anchor;
 if(!source.includes(anchor))return patchMemoryChatDashboardFallback(source);
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
  const changed=readFileSync(uiOutput,"utf8");
  console.log("MEMORY_CHAT_UI_COMPATIBILITY="+(changed.includes("FI_OPT_IN_MEMORY_CHAT_STANDALONE_V1")?"STANDALONE_PANEL_EXISTING_UI_PRESERVED":"INLINE_CHECKBOX"));
 }catch(e){console.error("MEMORY_CHAT_SOURCE_PATCH=HOLD "+e.message);process.exitCode=1}
}
