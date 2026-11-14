// FIAL 5.2 grounded Qwen + Cognee. New loopback 8806 only, no restarts.
import http from "node:http";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createGroundedChat,GROUNDED_CHAT_VERSION} from "../src/fial/grounded-chat-v5-2.mjs";
export const PORT=8806,HOST="127.0.0.1",SERVICE="fial5.2-grounded-qwen-sidecar-v1";
const PAGE='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fun Industrial — Grounded Qwen Chat</title>'+
'<style>:root{color-scheme:dark}body{max-width:860px;margin:auto;padding:20px;background:#0e1722;color:#eaf4f9;font:15px/1.5 system-ui}a{color:#a0dff3}article{border:1px solid #38506a;border-radius:12px;padding:20px;background:#192b3a}textarea{width:100%;box-sizing:border-box;min-height:110px;background:#102131;color:#fff;border:1px solid #476378;border-radius:8px;padding:10px}button{background:#8fe3d4;color:#082c29;padding:10px 14px;font:inherit;font-weight:bold;border:0;border-radius:7px}button:disabled{opacity:.5}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}</style></head>'+
'<body><h1>Fun Industrial · Grounded Qwen Chat</h1><p>Read-only automatic Cognee context, one local Qwen response and <b>no model tool definitions</b>. Existing services stay unchanged.</p>'+
'<p><a href="http://127.0.0.1:8805/">FIAL 5.1 whole system</a> · <a href="http://127.0.0.1:8802/">Integrated dashboard</a></p>'+
'<article><label for="question">Ask a question</label><textarea id="question">What approval is required before external tool execution at Fun Industrial?</textarea>'+
'<p><button id="ask" type="button">Ask Qwen with memory</button></p>'+
'<pre id="result" aria-live="polite">Ready.</pre><p>Unverified memory passages are labeled; an empty Qwen answer is not misreported as a tool call. No automatic retry or execution.</p></article>'+
'<script src="/api/fial/grounded/widget.js" defer></script></body></html>';
const CLIENT='(()=>{"use strict";const b=document.getElementById("ask"),q=document.getElementById("question"),o=document.getElementById("result");if(!b||!q||!o)return;b.addEventListener("click",async()=>{b.disabled=true;o.textContent="Requesting local memory and Qwen…";try{const r=await fetch("/api/fial/grounded/chat",{method:"POST",headers:{"content-type":"application/json","x-fi-chat-click":"one-local-model-response"},body:JSON.stringify({question:q.value})});const x=await r.json();o.textContent="State: "+String(x.state||"HOLD")+"\\nMemory: "+String(x.memory_state||"unknown")+"\\nExcerpts: "+String(x.memory_excerpts_included||0)+"\\nSource: "+String(x.source||"none")+"\\nTools executed: 0\\n\\n"+String(x.answer||x.error||x.reason||x.warning||"No text returned")+(x.warning?"\\n\\nNote: "+String(x.warning):"");}catch(e){o.textContent="HOLD: "+String(e.message||e)}finally{b.disabled=false}})})();';
function send(res,status,value,type="application/json; charset=utf-8"){
 const buf=Buffer.from(typeof value==="string"?value:JSON.stringify(value));
 res.writeHead(status,{"content-type":type,"content-length":buf.length,
  "cache-control":"no-store","x-content-type-options":"nosniff",
  "content-security-policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  "referrer-policy":"no-referrer"});res.end(buf);
}
function approved(req){
 return req.method==="POST"&&["http://127.0.0.1:8806","http://localhost:8806"].includes(req.headers.origin)&&
  req.headers["x-fi-chat-click"]==="one-local-model-response"&&req.headers["content-type"]==="application/json";
}
async function requestBody(req){
 let chunks=[],size=0;
 for await(const chunk of req){size+=chunk.length;if(size>2048)throw Error("FIAL52_REQUEST_TOO_LARGE");chunks.push(chunk)}
 const value=JSON.parse(Buffer.concat(chunks).toString("utf8"));
 if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).length!==1||typeof value.question!=="string")
  throw Error("FIAL52_QUESTION_BODY_INVALID");
 return value;
}
export function createGroundedChatServer({chat=createGroundedChat()}={}){
 return http.createServer(async(req,res)=>{
  try{
   if(!["127.0.0.1:8806","localhost:8806"].includes(req.headers.host))
    return send(res,403,{error:"FIAL52_HOST_REJECTED"});
   if(!req.url||req.url.startsWith("//")||req.url.includes("?")||req.url.includes("\\"))
    return send(res,404,{error:"FIAL52_BAD_PATH"});
   if(req.method==="GET"&&req.url==="/")
    return send(res,200,PAGE,"text/html; charset=utf-8");
   if(req.method==="GET"&&req.url==="/api/fial/grounded/widget.js")
    return send(res,200,CLIENT,"text/javascript; charset=utf-8");
   if(req.method==="GET"&&req.url==="/api/fial/grounded/health")
    return send(res,200,{version:SERVICE,model:GROUNDED_CHAT_VERSION,
     status:"ready",port:PORT,model_starts:0,tool_executions:0,
     source_modifications:0,rea_permissions_added:false});
   if(req.method==="GET"&&req.url==="/api/fial/grounded/status")
    return send(res,200,chat.status());
   if(req.method==="POST"&&req.url==="/api/fial/grounded/chat"){
    if(!approved(req))return send(res,403,{error:"FIAL52_OPERATOR_CLICK_REQUIRED"});
    return send(res,200,await chat.chat(await requestBody(req)));
   }
   return send(res,404,{error:"FIAL52_ROUTE_UNKNOWN"});
  }catch(e){if(!res.headersSent)return send(res,422,{error:String(e?.message||e).slice(0,160)})}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=="--serve"){
  console.error("FIAL52_EXPLICIT_SERVE_REQUIRED");process.exitCode=2;
 }else{
  const server=createGroundedChatServer();
  server.on("error",e=>{console.error("FIAL52_SERVER_HOLD="+e.message);process.exitCode=1});
  server.listen(PORT,HOST,()=>console.log("FIAL52_GROUNDED_CHAT_ACTIVE=http://127.0.0.1:8806/"));
 }
}
