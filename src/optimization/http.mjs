// FI_OPTIMIZATION_PHASE23_HTTP_V1 — same-origin, loopback-only module.
// Its caller MUST apply the existing dashboard localRequest gate first.
// No second web listener, no dashboard/REA/llama.cpp/Cognee mutations.
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const CLIENT=path.join(path.dirname(fileURLToPath(import.meta.url)),"client.js");
const MAX_INPUT_BYTES=32768;
function respond(res,code,body){
 res.writeHead(code,{"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store","x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"});
 res.end(JSON.stringify(body));return true;
}
async function parseBody(req){
 const length=req.headers["content-length"];
 if(length!==undefined&&(!/^\d{1,8}$/.test(String(length))||
    Number(length)>MAX_INPUT_BYTES))throw Error("OPTIMIZATION_INPUT_TOO_LARGE");
 let bytes=0;const chunks=[];
 for await(const chunk of req){
  bytes+=chunk.length;
  if(bytes>MAX_INPUT_BYTES)throw Error("OPTIMIZATION_INPUT_TOO_LARGE");
  chunks.push(chunk);
 }
 if(bytes<2)throw Error("OPTIMIZATION_EMPTY_INPUT");
 let body;
 try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"))}
 catch{throw Error("OPTIMIZATION_INVALID_JSON")}
 if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).sort().join(",")!=="action,problem")
  throw Error("OPTIMIZATION_INPUT_SCHEMA_HOLD");
 if(!["inventory","allocation","route"].includes(body.action)||
    !body.problem||typeof body.problem!=="object"||Array.isArray(body.problem))
  throw Error("OPTIMIZATION_INPUT_SCHEMA_HOLD");
 return body;
}
export async function optimizationHandler(req,res,runner){
 const route=String(req.url||"").split("?")[0];
 if(!route.startsWith("/api/optimization/"))return false;
 if(route==="/api/optimization/status"&&req.method==="GET")
  return respond(res,200,runner.status());
 if(route==="/api/optimization/client.js"&&req.method==="GET"){
  try{
   const bytes=await readFile(CLIENT);
   res.writeHead(200,{"content-type":"text/javascript; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff"});
   res.end(bytes);return true;
  }catch{return respond(res,503,{error:"OPTIMIZATION_CLIENT_UNAVAILABLE"});}
 }
 if(route==="/api/optimization/run"&&req.method==="POST"){
  if(req.headers["x-fi-optimization-approval"]!=="operator-reviewed"||
     !/^application\/json(?:;\s*charset=utf-8)?$/i.test(String(req.headers["content-type"]||""))||
     req.headers["sec-fetch-site"]==="cross-site")
   return respond(res,403,{error:"OPTIMIZATION_EXPLICIT_APPROVAL_REQUIRED"});
  try{
   const {action,problem}=await parseBody(req);
   const result=await runner.run(action,problem);
   return respond(res,200,result);
  }catch(e){
   const msg=String(e?.message||"OPTIMIZATION_FAILED").slice(0,250);
   const code=/ALREADY_RUNNING|COOLDOWN/.test(msg)?429:
    /INPUT|INVALID|SCHEMA/.test(msg)?422:503;
   return respond(res,code,{error:msg});
  }
 }
 return respond(res,405,{error:"OPTIMIZATION_METHOD_DENIED"});
}
