import http from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {loadConfig} from "./config.mjs";
import {createPlatform} from "./platform.mjs";
const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,"../.env"));}catch(error){if(error.code!=="ENOENT")throw error;}
const config=loadConfig({ ...process.env, APP_ROOT:path.resolve(root,"..") });
const platform=createPlatform(config),page=await readFile(path.join(root,"../public/index.html"));
function json(res,code,data){res.writeHead(code,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(data));}
async function proxyCompute(req,res,pathName){
 const target="http://127.0.0.1:"+config.compute.port+pathName;
 try{const response=await fetch(target,{method:"POST",headers:{"content-type":"application/json"},body:await new Promise((resolve,reject)=>{let body="";req.setEncoding("utf8");req.on("data",c=>{body+=c;if(body.length>1000000)reject(new Error("request too large"));});req.on("end",()=>resolve(body));req.on("error",reject);}),signal:AbortSignal.timeout(30000)});const body=await response.text();res.writeHead(response.status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(body);}catch(error){json(res,503,{error:"compute service unavailable",detail:error.message});}
}
const server=http.createServer(async(req,res)=>{try{
 if(req.method==="GET"&&req.url==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});return res.end(page);}
 if(req.method==="GET"&&req.url==="/api/status")return json(res,200,await platform.status());
 const computeRoutes={"/api/compute/graph":"/graph/analyze","/api/compute/tensor":"/tensor/matmul","/api/compute/train":"/nn/train","/api/compute/predict":"/nn/predict"};
 if(req.method==="POST"&&computeRoutes[req.url]){const host=req.headers.host||"";if(!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host))return json(res,403,{error:"local host only"});return proxyCompute(req,res,computeRoutes[req.url]);}
 const actions=["/api/start","/api/activate","/api/stop","/api/vpn/connect","/api/vpn/disconnect"];
 if(req.method==="POST"&&actions.includes(req.url)){
  const host=req.headers.host||"";if(!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host))return json(res,403,{error:"local host only"});
  const origin=req.headers.origin,allowed=["http://127.0.0.1:"+config.port,"http://localhost:"+config.port,"http://[::1]:"+config.port];if(origin&&!allowed.includes(origin))return json(res,403,{error:"origin rejected"});
  let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024)return json(res,413,{error:"request too large"});}
  if(req.url==="/api/start"||req.url==="/api/activate")return json(res,200,await platform.start());
  if(req.url==="/api/stop")return json(res,200,await platform.stop());
  if(req.url==="/api/vpn/connect")return json(res,200,{result:await platform.connectVpn(),status:await platform.status()});
  return json(res,200,{result:await platform.disconnectVpn(),status:await platform.status()});
 }
 return json(res,404,{error:"not found"});
}catch(error){return json(res,500,{error:"internal error",detail:error.message});}});
server.listen(config.port,config.host,()=>console.log("Fun Industrial Platform listening at http://"+config.host+":"+config.port));
const shutdown=async()=>{await platform.stop();server.close(()=>process.exit(0));};process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
