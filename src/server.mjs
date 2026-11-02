import http from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {loadConfig} from "./config.mjs";
import {createPlatform} from "./platform.mjs";
const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,"../.env"));}catch(error){if(error.code!=="ENOENT")throw error;}
const config=loadConfig({...process.env,APP_ROOT:path.resolve(root,"..")});
const platform=createPlatform(config),page=await readFile(path.join(root,"../public/index.html"));
function json(res,code,data){res.writeHead(code,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(data));}
function localRequest(req,res){
 const host=req.headers.host||"";
 if(!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)){json(res,403,{error:"local host only"});return false;}
 const origin=req.headers.origin,allowed=["http://127.0.0.1:"+config.port,"http://localhost:"+config.port,"http://[::1]:"+config.port];
 if(origin&&!allowed.includes(origin)){json(res,403,{error:"origin rejected"});return false;}
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
const server=http.createServer(async(req,res)=>{try{
 if(req.method==="GET"&&req.url==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});return res.end(page);}
 if(req.method==="GET"&&req.url==="/api/status")return json(res,200,await platform.status());
 if(req.method==="GET"&&req.url==="/api/rea/catalog"){if(!localRequest(req,res))return;try{return json(res,200,{tools:await platform.reaCatalog()});}catch(e){return json(res,403,{error:e.message});}}
 if(req.method==="GET"&&req.url==="/api/rea/tools"){if(!localRequest(req,res))return;try{return json(res,200,{tools:await platform.reaTools()});}catch(e){return json(res,403,{error:e.message});}}
 if(req.method==="POST"&&req.url==="/api/rea/call"){if(!localRequest(req,res))return;const body=await readBody(req,65536);if(typeof body.name!=="string"||body.name.length>128)return json(res,400,{error:"invalid tool name"});try{return json(res,200,await platform.callReaTool(body.name,body.arguments||{}));}catch(e){return json(res,403,{error:e.message});}}
 if(req.method==="POST"&&computeRoutes[req.url]){if(!localRequest(req,res))return;const body=await readBody(req);return proxyCompute(req,res,computeRoutes[req.url],"POST",body);}
 if(aiRoutes[req.url]&&req.method===aiRoutes[req.url].method){if(!localRequest(req,res))return;const route=aiRoutes[req.url];const body=route.method==="POST"?await readBody(req,1000000):null;return proxyCompute(req,res,route.path,route.method,body);}
 const actions=["/api/start","/api/activate","/api/stop","/api/vpn/connect","/api/vpn/disconnect"];
 if(req.method==="POST"&&actions.includes(req.url)){
  if(!localRequest(req,res))return;await readBody(req,1024);
  if(req.url==="/api/start"||req.url==="/api/activate")return json(res,200,await platform.start());
  if(req.url==="/api/stop")return json(res,200,await platform.stop());
  if(req.url==="/api/vpn/connect")return json(res,200,{result:await platform.connectVpn(),status:await platform.status()});
  return json(res,200,{result:await platform.disconnectVpn(),status:await platform.status()});
 }
 return json(res,404,{error:"not found"});
}catch(error){return json(res,error.message==="request too large"?413:400,{error:error.message});}});
server.listen(config.port,config.host,()=>console.log("Fun Industrial Platform listening at http://"+config.host+":"+config.port));
const shutdown=async()=>{await platform.stop();server.close(()=>process.exit(0));};process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
