// Standalone Fun Industrial live-grants dashboard on 127.0.0.1:8803.
// Adopts existing 8802 interface; does not restart 8802, Qwen, REA or Elektron.
import http from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {createLiveController,currentLiveStatus} from "../src/fial/live-official-v4.mjs";
export const LIVE_HOST="127.0.0.1",LIVE_PORT=8803;
const WIDGET=new URL("../src/fial/live-widget-v4.js",import.meta.url);
const UPSTREAM="http://127.0.0.1:8802",MAX_PAGE=260000,MAX_PROXY=12*1024*1024;
const PANEL='<section id="fi-fial4-live" style="box-sizing:border-box;margin:18px auto;padding:17px;max-width:1100px;background:#152a3a;border:1px solid #4e7087;border-radius:12px;color:#e6f4fc;font:14px/1.5 system-ui">'+
 '<h2>FIAL 4 — Live Official Grant Verification</h2>'+
 '<p>Official California Grants Portal feed · refresh automatically every 6 hours. Check published changes and current status. Eligibility is not certified.</p>'+
 '<button id="fi-fial4-live-refresh" type="button" style="padding:10px 12px;background:#a2e7e2;border:0;border-radius:7px;color:#09202c;font-weight:bold">Verify official source now</button>'+
 '<pre id="fi-fial4-live-output" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:700px;overflow:auto">Loading official source status…</pre></section>'+
 '<script src="/api/fial/live/widget.js" defer></script>';
export function injectLivePanel(page){
 if(typeof page!=="string"||!/<body\b[^>]*>/i.test(page)||
   !/<\/body>/i.test(page)||page.length>MAX_PAGE)throw Error("FIAL4_LIVE_UPSTREAM_HTML_INVALID");
 return page.replace(/<\/body>/i,PANEL+"</body>");
}
function send(res,status,value,kind="application/json; charset=utf-8"){
 const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==="string"?value:JSON.stringify(value));
 res.writeHead(status,{"content-type":kind,"content-length":bytes.length,
  "cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});
 res.end(bytes);
}
function hostValid(req){return ["127.0.0.1:8803","localhost:8803"].includes(req.headers.host)}
export function actionValid(req){
 return req.method==="POST"&&hostValid(req)&&
 ["http://127.0.0.1:8803","http://localhost:8803"].includes(req.headers.origin)&&
 req.headers["x-fi-fial"]==="operator-click"&&
 req.headers["content-type"]==="application/json";
}
async function readBody(req,max=64){
 let n=0;const parts=[];
 for await(const chunk of req){n+=chunk.length;if(n>max)throw Error("FIAL4_LIVE_BODY_LIMIT");parts.push(chunk)}
 return Buffer.concat(parts).toString("utf8");
}
async function pageFrom8802(path){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6000);
 try{
  const response=await fetch(UPSTREAM+path,{method:"GET",redirect:"error",signal:ctl.signal});
  if(!response.ok||!String(response.headers.get("content-type")).includes("text/html"))
   throw Error("FIAL4_LIVE_8802_PAGE_UNAVAILABLE");
  let size=0;const blocks=[];
  for await(const chunk of response.body){
   size+=chunk.length;if(size>MAX_PAGE)throw Error("FIAL4_LIVE_UPSTREAM_PAGE_LIMIT");
   blocks.push(chunk);
  }
  return {html:Buffer.concat(blocks).toString("utf8"),
   csp:String(response.headers.get("content-security-policy")||"")};
 }finally{clearTimeout(timer)}
}
async function proxy8802(req,res){
 const target=req.url;
 const body=[];
 let size=0;
 for await(const chunk of req){
  size+=chunk.length;
  if(size>MAX_PROXY)throw Error("FIAL4_LIVE_PROXY_BODY_LIMIT");
  body.push(chunk);
 }
 const bytes=Buffer.concat(body);
 const headers={host:"127.0.0.1:8802",
  origin:"http://127.0.0.1:8802",
  "content-length":String(bytes.length)};
 for(const key of ["content-type","accept","x-fi-ml","x-fi-commerce",
  "x-fi-unified","x-fi-ui"])if(typeof req.headers[key]==="string")
   headers[key]=req.headers[key];
 return new Promise(done=>{
  let resolved=false;
  const end=(status,content,kind)=>{
   if(resolved)return;resolved=true;send(res,status,content,kind);done();
  };
  const up=http.request({hostname:"127.0.0.1",port:8802,path:target,
   method:req.method,headers,timeout:120000},reply=>{
   const blocks=[];let n=0;
   reply.on("data",chunk=>{
    n+=chunk.length;
    if(n>MAX_PROXY){up.destroy();end(502,{error:"FIAL4_LIVE_PROXY_RESPONSE_LIMIT"})}
    else blocks.push(chunk);
   });
   reply.on("end",()=>{
    if(resolved)return;
    const kind=String(reply.headers["content-type"]||"application/json; charset=utf-8");
    end(reply.statusCode||502,Buffer.concat(blocks),kind);
   });
  });
  up.on("timeout",()=>up.destroy(Error("FIAL4_LIVE_PROXY_TIMEOUT")));
  up.on("error",()=>end(502,{error:"FIAL4_LIVE_8802_PROXY_UNAVAILABLE"}));
  up.end(bytes);
 });
}
export function createLiveDashboard({controller=createLiveController(),
 readPage=pageFrom8802,proxy=proxy8802,readWidget=()=>readFile(WIDGET,"utf8")}={}){
 return http.createServer(async(req,res)=>{
  try{
   if(!hostValid(req))return send(res,403,{error:"FIAL4_LIVE_HOST_REJECTED"});
   if(typeof req.url!=="string"||!req.url.startsWith("/")||
      req.url.startsWith("//")||req.url.includes("\\"))
    return send(res,400,{error:"FIAL4_LIVE_PATH_INVALID"});
   const url=new URL(req.url,"http://127.0.0.1:8803");
   if(url.search.length>2048||url.pathname.includes(".."))
    return send(res,400,{error:"FIAL4_LIVE_PATH_INVALID"});
   if(req.method==="GET"&&url.pathname==="/api/fial/live/status")
    return send(res,200,await controller.status());
   if(req.method==="POST"&&url.pathname==="/api/fial/live/refresh"){
    if(!actionValid(req))return send(res,403,{error:"FIAL4_LIVE_APPROVAL_OR_ORIGIN_REQUIRED"});
    if((await readBody(req)).trim()!=="{}")
     return send(res,400,{error:"FIAL4_LIVE_EMPTY_JSON_REQUIRED"});
    return send(res,200,await controller.refresh());
   }
   if(req.method==="GET"&&url.pathname==="/api/fial/live/widget.js")
    return send(res,200,await readWidget(),"text/javascript; charset=utf-8");
   if(req.method==="GET"&&url.pathname==="/api/fial/live/health")
    return send(res,200,{version:"fi-fial4-live-hub-v1",state:"ready",
     host:LIVE_HOST,port:LIVE_PORT,source:"OFFICIAL_CALIFORNIA_GRANTS_PORTAL",
     auto_refresh_hours:6,existing_services_restarted:0,rea_permissions_added:0});
   if(req.method==="GET"&&["/","/unified/"].includes(url.pathname)){
    const page=await readPage(url.pathname);
    const html=injectLivePanel(typeof page==="string"?page:page.html);
    // Preserve strict upstream CSP when present; the new widget loads as same-origin script.
    const csp=typeof page==="object"&&page.csp?page.csp:
     "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'";
    const bytes=Buffer.from(html);
    res.writeHead(200,{"content-type":"text/html; charset=utf-8",
     "content-length":bytes.length,"cache-control":"no-store",
     "content-security-policy":csp,"x-content-type-options":"nosniff"});
    return res.end(bytes);
   }
   if(url.pathname.startsWith("/api/fial/live/"))
    return send(res,404,{error:"FIAL4_LIVE_ROUTE_UNKNOWN"});
   if(!["GET","POST"].includes(req.method))return send(res,405,{error:"FIAL4_LIVE_METHOD_DENIED"});
   if(req.method==="POST"&&
    !["http://127.0.0.1:8803","http://localhost:8803"].includes(req.headers.origin))
    return send(res,403,{error:"FIAL4_LIVE_PROXY_ORIGIN_REQUIRED"});
   if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/assets/"))
    return await proxy(req,res);
   return send(res,404,{error:"FIAL4_LIVE_ROUTE_UNKNOWN"});
  }catch(e){
   if(!res.headersSent)send(res,422,{error:String(e?.message||e).slice(0,220)});
  }
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=="--serve"){
  console.error("FIAL4_LIVE_START_REQUIRES_EXPLICIT_--serve");process.exitCode=2;
 }else{
  const controller=createLiveController(),server=createLiveDashboard({controller});
  server.on("error",e=>{console.error("FIAL4_LIVE_HOLD="+e.message);process.exitCode=1});
  server.listen(LIVE_PORT,LIVE_HOST,()=>{
   console.log("FIAL4_LIVE_DASHBOARD_READY=http://127.0.0.1:8803/");
   console.log("FIAL4_LIVE_SCHEDULE=STARTUP_AND_EVERY_6_HOURS");
   // First refresh starts immediately after verified dashboard activation.
   void controller.refresh().then(r=>console.log("FIAL4_LIVE_INITIAL="+r.state));
   const schedule=setInterval(()=>void controller.refresh()
    .then(r=>console.log("FIAL4_LIVE_REFRESH="+r.state)),6*60*60*1000);
   schedule.unref();
  });
 }
}
