import http from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {loadConfig} from "./config.mjs";
import {createPlatform} from "./platform.mjs";
const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,"../.env"));}catch(error){if(error.code!=="ENOENT")throw error;}
const config=loadConfig(),platform=createPlatform(config),page=await readFile(path.join(root,"../public/index.html"));
function json(res,code,data){res.writeHead(code,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{try{
 if(req.method==="GET"&&req.url==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});return res.end(page);}
 if(req.method==="GET"&&req.url==="/api/status")return json(res,200,await platform.status());
 const actions=["/api/start","/api/stop","/api/vpn/connect","/api/vpn/disconnect"];
 if(req.method==="POST"&&actions.includes(req.url)){
  const host=req.headers.host||"";if(!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host))return json(res,403,{error:"local host only"});
  const origin=req.headers.origin,allowed=["http://127.0.0.1:"+config.port,"http://localhost:"+config.port,"http://[::1]:"+config.port];if(origin&&!allowed.includes(origin))return json(res,403,{error:"origin rejected"});
  let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024)return json(res,413,{error:"request too large"});}
  if(req.url==="/api/start")return json(res,200,await platform.start());
  if(req.url==="/api/stop")return json(res,200,await platform.stop());
  if(req.url==="/api/vpn/connect")return json(res,200,{result:await platform.connectVpn(),status:await platform.status()});
  return json(res,200,{result:await platform.disconnectVpn(),status:await platform.status()});
 }
 return json(res,404,{error:"not found"});
}catch(error){return json(res,500,{error:"internal error",detail:error.message});}});
server.listen(config.port,config.host,()=>console.log("Fun Industrial Platform listening at http://"+config.host+":"+config.port));
const shutdown=async()=>{await platform.stop();server.close(()=>process.exit(0));};process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
