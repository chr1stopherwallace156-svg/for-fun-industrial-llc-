// FIAL 5 system-wide control surface. Isolated 127.0.0.1:8804 sidecar.
// Reuses existing 8803 UI when healthy but never modifies/restarts it.
import http from "node:http";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createFialSystemController} from "../src/fial/system-runtime-v5.mjs";
const PROGRAM=new URL("../src/fial/programs/system-coordination.fial",import.meta.url);
const CLIENT=new URL("../src/fial/system-widget-v5.js",import.meta.url);
const HOST="127.0.0.1",PORT=8804;
const UPSTREAM="http://127.0.0.1:8803";
const PANEL='<section id="fi-fial5-system" style="box-sizing:border-box;max-width:1100px;margin:18px auto;padding:17px;background:#152a3a;color:#e6f4fc;border:1px solid #4e7087;border-radius:12px;font:14px/1.5 system-ui">'+
 '<h2>FIAL 5 — Entire Fun Industrial System</h2>'+
 '<p>Active common evidence, module health and decision ledger. Grants are one of many modules. Service actions remain operator-approved.</p>'+
 '<button id="fi-fial5-check" type="button" style="background:#a2e7e2;color:#09202c;padding:10px 12px;border:0;border-radius:7px;font-weight:bold">Check entire system now</button>'+
 '<pre id="fi-fial5-status" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:900px;overflow:auto">Loading system status…</pre>'+
 '</section><script src="/api/fial/system/widget.js" defer></script>';
const FALLBACK="<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Fun Industrial FIAL System</title></head>"+
 "<body style='max-width:1100px;margin:auto;padding:24px;background:#0e141c;color:#e6f4fc;font:15px system-ui'><h1>Fun Industrial · Unified FIAL</h1><p>Existing dashboard unavailable; FIAL system observation is independently active.</p></body></html>";
function send(res,status,value,type="application/json; charset=utf-8"){
 const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==="string"?value:JSON.stringify(value));
 res.writeHead(status,{"content-type":type,"content-length":bytes.length,
  "cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});
 res.end(bytes);
}
export function injectSystemPanel(html){
 if(typeof html!=="string"||html.length>400000||
   !/<body\b[^>]*>/i.test(html)||!/<\/body>/i.test(html))
  throw Error("FIAL5_BAD_UPSTREAM_HTML");
 return html.replace(/<\/body>/i,PANEL+"</body>");
}
function originOK(req){
 return ["http://127.0.0.1:8804","http://localhost:8804"].includes(req.headers.origin);
}
export function authorizedSystemRun(req){
 return req.method==="POST"&&originOK(req)&&
  req.headers["x-fi-fial-system"]==="operator-click"&&
  req.headers["content-type"]==="application/json";
}
async function requestBody(req,max=64){
 let size=0;const chunks=[];
 for await(const chunk of req){
  size+=chunk.length;if(size>max)throw Error("FIAL5_INPUT_LIMIT");
  chunks.push(chunk);
 }
 return Buffer.concat(chunks).toString("utf8");
}
async function upstreamPage(path){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6000);
 try{
  const r=await fetch(UPSTREAM+path,{redirect:"error",signal:ctl.signal});
  if(!r.ok||!String(r.headers.get("content-type")).includes("text/html"))
   throw Error("FIAL5_UPSTREAM_UNAVAILABLE");
  const chunks=[];let size=0;
  for await(const block of r.body){
   size+=block.length;if(size>400000)throw Error("FIAL5_UPSTREAM_PAGE_LIMIT");
   chunks.push(block);
  }
  return {html:Buffer.concat(chunks).toString("utf8"),
   csp:r.headers.get("content-security-policy")||""};
 }finally{clearTimeout(timer)}
}
async function proxyTo8803(req,res){
 const path=req.url,parts=[];let size=0;
 for await(const chunk of req){
  size+=chunk.length;if(size>12*1024*1024)throw Error("FIAL5_PROXY_BODY_LIMIT");
  parts.push(chunk);
 }
 const bytes=Buffer.concat(parts);
 const headers={host:"127.0.0.1:8803",origin:"http://127.0.0.1:8803",
  "content-length":String(bytes.length)};
 for(const key of ["content-type","accept","x-fi-ml","x-fi-commerce","x-fi-unified",
  "x-fi-fial","x-fi-ui"]){
  if(typeof req.headers[key]==="string")headers[key]=req.headers[key];
 }
 await new Promise(done=>{
  let finished=false;
  const respond=(status,body,kind)=>{
   if(finished)return;finished=true;send(res,status,body,kind);done();
  };
  const upstream=http.request({hostname:"127.0.0.1",port:8803,
   path,method:req.method,headers,timeout:120000},r=>{
   let n=0;const data=[];
   r.on("data",b=>{
    n+=b.length;
    if(n>12*1024*1024){
     upstream.destroy();respond(502,{error:"FIAL5_PROXY_RESPONSE_LIMIT"});
    }else data.push(b);
   });
   r.on("end",()=>respond(r.statusCode||502,Buffer.concat(data),
    String(r.headers["content-type"]||"application/json; charset=utf-8")));
  });
  upstream.on("timeout",()=>upstream.destroy(Error("FIAL5_PROXY_TIMEOUT")));
  upstream.on("error",()=>respond(502,{error:"FIAL5_UPSTREAM_UNAVAILABLE"}));
  upstream.end(bytes);
 });
}
export function createFialSystemDashboard({controller,
 getPage=upstreamPage,proxy=proxyTo8803,
 readWidget=()=>readFile(CLIENT,"utf8")}={}){
 if(!controller||typeof controller.status!=="function"||typeof controller.run!=="function")
  throw Error("FIAL5_CONTROLLER_REQUIRED");
 return http.createServer(async(req,res)=>{
  try{
   if(!["127.0.0.1:8804","localhost:8804"].includes(req.headers.host))
    return send(res,403,{error:"FIAL5_HOST_DENIED"});
   if(!req.url||!req.url.startsWith("/")||req.url.startsWith("//")||req.url.includes("\\"))
    return send(res,400,{error:"FIAL5_INVALID_PATH"});
   const u=new URL(req.url,"http://127.0.0.1:8804");
   if(u.search.length>2048||u.pathname.includes(".."))
    return send(res,400,{error:"FIAL5_INVALID_PATH"});
   if(req.method==="GET"&&u.pathname==="/api/fial/system/status")
    return send(res,200,await controller.status());
   if(req.method==="POST"&&u.pathname==="/api/fial/system/run"){
    if(!authorizedSystemRun(req))
     return send(res,403,{error:"FIAL5_OPERATOR_CLICK_REQUIRED"});
    if((await requestBody(req)).trim()!=="{}")
     return send(res,400,{error:"FIAL5_EMPTY_JSON_REQUIRED"});
    return send(res,200,await controller.run());
   }
   if(req.method==="GET"&&u.pathname==="/api/fial/system/widget.js")
    return send(res,200,await readWidget(),"text/javascript; charset=utf-8");
   if(req.method==="GET"&&u.pathname==="/api/fial/system/health")
    return send(res,200,{version:"fi-fial-system-dashboard-v5",state:"ready",
     whole_system_registry:true,port:8804,schedule_minutes:15,
     external_tool_authority_added:false,services_restarted:0});
   if(req.method==="GET"&&["/","/unified/"].includes(u.pathname)){
    let page;
    try{page=await getPage(u.pathname)}
    catch{page={html:FALLBACK,csp:"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'"}}
    const html=injectSystemPanel(typeof page==="string"?page:page.html),b=Buffer.from(html);
    res.writeHead(200,{"content-type":"text/html; charset=utf-8",
     "content-length":b.length,"cache-control":"no-store",
     "content-security-policy":page.csp||
      "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"});
    return res.end(b);
   }
   if(u.pathname.startsWith("/api/fial/system/"))
    return send(res,404,{error:"FIAL5_ROUTE_UNKNOWN"});
   if(!["GET","POST"].includes(req.method))
    return send(res,405,{error:"FIAL5_METHOD_DENIED"});
   if(req.method==="POST"&&!originOK(req))
    return send(res,403,{error:"FIAL5_PROXY_ORIGIN_DENIED"});
   if(u.pathname.startsWith("/api/")||u.pathname.startsWith("/assets/"))
    return await proxy(req,res);
   return send(res,404,{error:"FIAL5_ROUTE_UNKNOWN"});
  }catch(e){
   if(!res.headersSent)send(res,422,{error:String(e?.message||e).slice(0,160)});
  }
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=="--serve"){
  console.error("FIAL5_EXPLICIT_--serve_REQUIRED");process.exitCode=2;
 }else{
  const program=await readFile(PROGRAM,"utf8");
  const controller=createFialSystemController({source:program});
  const server=createFialSystemDashboard({controller});
  server.on("error",e=>{console.error("FIAL5_SYSTEM_DASHBOARD_HOLD="+e.message);process.exitCode=1});
  server.listen(PORT,HOST,()=>{
   console.log("FIAL5_SYSTEM_ACTIVE=http://127.0.0.1:8804/");
   console.log("FIAL5_SCHEDULE=STARTUP_AND_EVERY_15_MINUTES");
   void controller.run().then(r=>console.log("FIAL5_FIRST_CYCLE="+r.state));
   const interval=setInterval(()=>{
    void controller.run().then(r=>console.log("FIAL5_SYSTEM_CYCLE="+r.state));
   },15*60*1000);
   interval.unref();
  });
 }
}
