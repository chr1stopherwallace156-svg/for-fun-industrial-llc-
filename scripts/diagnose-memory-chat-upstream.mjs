// Safe diagnostic for rolled-back Fun Industrial 8789 (memory chat NOT deployed).
// Calls existing read-only Cognee recall and one text-only local llama.cpp chat.
// No memory writes, REA tools, service restart, npm/pip install or Ollama.
import {composeMemoryChat} from "../src/intelligence/memory-chat.mjs";
const BASE="http://127.0.0.1:8789";
const input={messages:[{role:"user",content:"What is Fun Industrial policy about operator approval before executing external tools?"}],max_tokens:100,temperature:0};
async function getJson(path,options={},timeout=20000){
 const response=await fetch(BASE+path,{...options,signal:AbortSignal.timeout(timeout)});
 const raw=await response.text();let data;
 try{data=JSON.parse(raw)}catch{data={error:"NON_JSON_RESPONSE"}}
 return {status:response.status,data};
}
function errorHint(data){
 const value=[data?.error,data?.detail,data?.upstreamStatus].filter(x=>typeof x==="string"||typeof x==="number").join(" ");
 // Never print recalled text or a model response. Use only concise error metadata.
 return value.replace(/[\r\n\x00-\x1f]+/g," ").slice(0,320)||"NOT_REPORTED";
}
console.log("MEMORY_CHAT_UPSTREAM_DIAGNOSTIC=START NO_REMEMBER NO_TOOLS NO_RESTART");
try{
 const [memory,ai]=await Promise.all([
  getJson("/api/intelligence/status"),getJson("/api/ai/status")
 ]);
 console.log("INTELLIGENCE_STATUS_HTTP="+memory.status+" MEMORY_ENABLED="+String(memory.data?.memory?.enabled));
 console.log("AI_STATUS_HTTP="+ai.status+" AI_STATE="+String(ai.data?.state));
 if(memory.status!==200||memory.data?.memory?.enabled!==true){
  console.log("DIAGNOSTIC_HOLD=MEMORY_NOT_READY");process.exitCode=2;
 }else if(ai.status!==200||ai.data?.state!=="ready"){
  console.log("DIAGNOSTIC_HOLD=LLAMA_NOT_READY");process.exitCode=3;
 }else{
  let recallHTTP;
  const recall=async query=>{
   const r=await getJson("/api/intelligence/memory/recall",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({query})
   },240000);
   recallHTTP=r.status;
   console.log("RECALL_HTTP="+r.status);
   if(r.status!==200){console.log("RECALL_ERROR="+errorHint(r.data));throw Error("COGNEE_RECALL_HTTP_HOLD")}
   console.log("RECALL_STATE="+String(r.data?.state)+" RECALL_RESULT_COUNT="+String(Array.isArray(r.data?.results)?r.data.results.length:"invalid"));
   return r.data;
  };
  let prepared;
  try{
   prepared=await composeMemoryChat(input,recall);
   console.log("MEMORY_CONTEXT_COMPOSE=PASS EXCERPTS_INCLUDED="+prepared.metadata.excerptsIncluded+" MODEL_TOOLS_FORWARDED="+prepared.metadata.toolsForwarded);
  }catch(error){
   console.log("MEMORY_CONTEXT_COMPOSE=HOLD REASON="+String(error?.message||error).slice(0,250));
   process.exitCode=4;
  }
  if(prepared){
   // Equivalent to 8789's new memory-chat upstream, but via the existing
   // known-good /api/ai/chat proxy and without a tool definition.
   try{
    const upstream=await getJson("/api/ai/chat",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify(prepared.modelRequest)
    },195000);
    console.log("LLAMA_AUGMENTED_CHAT_HTTP="+upstream.status);
    if(upstream.status!==200){
     console.log("LLAMA_AUGMENTED_CHAT_ERROR="+errorHint(upstream.data));
     process.exitCode=5;
    }else{
     console.log("LLAMA_AUGMENTED_CHAT_REPLY_PRESENT="+String(typeof upstream.data?.reply==="string"&&upstream.data.reply.trim().length>0));
     console.log("LLAMA_AUGMENTED_CHAT_RESULT=PASS REPLY_CONTENT_NOT_PRINTED");
    }
   }catch(error){
    console.log("LLAMA_AUGMENTED_CHAT=HOLD ERROR_TYPE="+String(error?.name||"unknown")+" ERROR_MESSAGE="+String(error?.message||error).slice(0,260));
    process.exitCode=6;
   }
  }
 }
}catch(error){
 console.log("MEMORY_CHAT_UPSTREAM_DIAGNOSTIC=HOLD ERROR_TYPE="+String(error?.name||"unknown")+" ERROR_MESSAGE="+String(error?.message||error).slice(0,260));
 process.exitCode=7;
}
if(process.exitCode===undefined)console.log("MEMORY_CHAT_UPSTREAM_DIAGNOSTIC=PASS NO_MEMORY_WRITES NO_TOOL_EXECUTION");
else console.log("MEMORY_CHAT_UPSTREAM_DIAGNOSTIC=HOLD");
