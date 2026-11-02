import https from "node:https";
import http from "node:http";
import {readFile} from "node:fs/promises";
import {timingSafeEqual,createHash} from "node:crypto";
import {URL} from "node:url";
import {isIP} from "node:net";

function required(env,key){const v=env[key];if(!v||!String(v).trim())throw new Error(key+" is required");return String(v).trim();}
function normalizeIp(ip){return String(ip||"").replace(/^::ffff:/i,"").replace(/^\[|\]$/g,"");}
export function createGatewayConfig(env=process.env){
 const bindIp=required(env,"FI_GATEWAY_BIND_IP"),clientList=required(env,"FI_GATEWAY_ALLOWED_CLIENT_IPS").split(",").map(normalizeIp).filter(Boolean),allowed=new Set(clientList);
 const port=Number(env.FI_GATEWAY_PORT||8443),backendPort=Number(env.PORT||8787),username=required(env,"FI_GATEWAY_USERNAME"),password=required(env,"FI_GATEWAY_PASSWORD");
 const keyPath=required(env,"FI_GATEWAY_TLS_KEY"),certPath=required(env,"FI_GATEWAY_TLS_CERT"),publicHost=required(env,"FI_GATEWAY_PUBLIC_HOST").toLowerCase();
 if(isIP(bindIp)!==4||bindIp.startsWith("127.")||bindIp==="0.0.0.0")throw new Error("FI_GATEWAY_BIND_IP must be an explicit non-loopback IPv4 address (use the NetBird interface address).");
 if(!Number.isInteger(port)||port<1||port>65535||!Number.isInteger(backendPort)||backendPort<1||backendPort>65535)throw new Error("Invalid gateway/backend TCP port.");
 if(!allowed.size||allowed.has("*")||clientList.some(ip=>isIP(ip)!==4||ip.startsWith("127.")||ip==="0.0.0.0"))throw new Error("Explicit valid IPv4 VPN client allowlist required; wildcards and non-client addresses are forbidden.");
 if(!/^[a-zA-Z0-9._-]{1,64}$/.test(username)||password.length<24)throw new Error("Gateway username must be simple and password must be at least 24 characters.");
 const hostOnly=publicHost.replace(/:\d+$/,"");
 if(!(isIP(hostOnly)===4||/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostOnly)))throw new Error("FI_GATEWAY_PUBLIC_HOST must be the exact public VPN DNS name or IPv4 address with optional port.");
 return Object.freeze({bindIp,allowed,port,backendPort,username,password,keyPath,certPath,publicHost,origin:"https://"+publicHost});
}
export function createGatewayServer(config,{readFileImpl=readFile,clock=()=>Date.now()}={}){
 const failures=new Map();
 const authDigest=createHash("sha256").update(config.username+":"+config.password).digest();
 const tlsReady=Promise.all([readFileImpl(config.keyPath),readFileImpl(config.certPath)]);
 const handler=async(req,res)=>{
  const ip=normalizeIp(req.socket.remoteAddress);
  if(!config.allowed.has(ip)){res.writeHead(403,{"cache-control":"no-store"});return res.end("VPN client address not allowed");}
  const bucket=failures.get(ip)||{count:0,until:0};
  if(bucket.until>clock()&&bucket.count>=10){res.writeHead(429,{"retry-after":"300","cache-control":"no-store"});return res.end("Too many authentication failures");}
  const auth=req.headers.authorization||"";
  let valid=false;
  if(auth.startsWith("Basic ")){
   try{
    const decoded=Buffer.from(auth.slice(6),"base64").toString("utf8"),sep=decoded.indexOf(":");
    const candidate=createHash("sha256").update(decoded).digest();
    valid=sep>0&&decoded.slice(0,sep)===config.username&&timingSafeEqual(candidate,authDigest);
   }catch{}
  }
  if(!valid){bucket.count++;bucket.until=clock()+300000;failures.set(ip,bucket);res.writeHead(401,{"www-authenticate":'Basic realm="Fun Industrial", charset="UTF-8"',"cache-control":"no-store"});return res.end("Authentication required");}
  failures.delete(ip);
  const host=(req.headers.host||"").toLowerCase();
  if(host!==config.publicHost){res.writeHead(421,{"cache-control":"no-store"});return res.end("Unexpected Host");}
  const origin=req.headers.origin;
  if((origin&&origin!==config.origin)||(!["GET","HEAD","OPTIONS"].includes(req.method)&&origin!==config.origin)){res.writeHead(403,{"cache-control":"no-store"});return res.end("Origin rejected");}
  if(!req.url||!req.url.startsWith("/")||req.url.startsWith("//")||req.url.includes(String.fromCharCode(92))){res.writeHead(400,{"cache-control":"no-store"});return res.end("Invalid request target");}
  if(!["GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"].includes(req.method)){res.writeHead(405,{"allow":"GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"});return res.end("Method not allowed");}
  const headers={...req.headers,host:"127.0.0.1:"+config.backendPort};
  delete headers.authorization;delete headers.origin;delete headers.cookie;
  headers["x-forwarded-host"]=config.publicHost;headers["x-forwarded-proto"]="https";headers["x-forwarded-for"]=ip;
  const upstream=http.request({host:"127.0.0.1",port:config.backendPort,path:req.url,method:req.method,headers,timeout:180000},up=>{
   res.writeHead(up.statusCode||502,{"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","content-security-policy":"frame-ancestors 'none'; base-uri 'self'" ,...up.headers});
   up.pipe(res);
  });
  upstream.on("timeout",()=>upstream.destroy(new Error("Backend timeout")));
  upstream.on("error",()=>{if(!res.headersSent){res.writeHead(502,{"cache-control":"no-store"});res.end("Fun Industrial backend unavailable");}else res.destroy();});
  req.pipe(upstream);
 };
 const secureServer=https.createServer;
 return tlsReady.then(([key,cert])=>{
  const s=secureServer({key,cert,minVersion:"TLSv1.2",requestCert:false},handler);
  s.requestTimeout=180000;s.headersTimeout=10000;s.keepAliveTimeout=5000;
  return s;
 });
}
if(import.meta.url===new URL(process.argv[1]||"", "file:").href){
 try{
  try{process.loadEnvFile(new URL("../.env",import.meta.url));}catch(error){if(error.code!=="ENOENT")throw error;}
  const config=createGatewayConfig();
  const server=await createGatewayServer(config);
  server.listen(config.port,config.bindIp,()=>console.log("FUN_INDUSTRIAL_GATEWAY_LISTENING=https://"+config.publicHost+" BIND="+config.bindIp+":"+config.port));
  const shutdown=()=>server.close(()=>process.exit(0));
  process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
 }catch(error){console.error("FUN_INDUSTRIAL_GATEWAY_START=HOLD "+error.message);process.exitCode=1;}
}
