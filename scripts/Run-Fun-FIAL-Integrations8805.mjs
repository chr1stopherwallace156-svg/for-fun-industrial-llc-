// FIAL 5.1: independent whole-system integration hub on 127.0.0.1:8805.
// Aggregates existing 8804 FIAL5 telemetry and eight real local module APIs.
// Strict separate operator approval on each bounded action. No autonomous tool calls.
import http from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {createFial51Adapters,IDS,OPERATIONS,saveIntegrationEvidence,V51} from "../src/fial/module-adapters-v5-1.mjs";
import {compileFialSystem} from "../src/fial/system-compiler-v5.mjs";

export const HOST="127.0.0.1",PORT=8805;
export const FIAL51_HUB="fial5.1-integrated-hub-v1";
const PROGRAM=new URL("../src/fial/programs/system-coordination.fial",import.meta.url);
const WIDGET=new URL("../src/fial/module-widget-v5-1.js",import.meta.url);
const MAX_BODY=36000;
const html="<!doctype html><html lang='en'><head><meta charset='utf-8'>"+
 "<meta name='viewport' content='width=device-width,initial-scale=1'>"+
 "<meta name='referrer' content='no-referrer'>"+
 "<title>Fun Industrial | FIAL 5.1 Whole-System Integration</title>"+
 "<style>:root{color-scheme:dark}body{background:#0d1521;color:#e4f2fa;font:15px/1.5 system-ui;max-width:1150px;margin:auto;padding:20px}"+
 "a{color:#9ee4f2}nav{display:flex;gap:15px;flex-wrap:wrap;margin:12px 0 24px}"+
 "article{border:1px solid #314b63;background:#172637;border-radius:12px;padding:18px;margin:16px 0}"+
 "button,select,textarea{font:inherit}button{border:0;border-radius:7px;background:#91e0d8;color:#102932;padding:10px 13px;font-weight:700}"+
 "button:disabled{opacity:.5}select,textarea{box-sizing:border-box;width:100%;padding:10px;color:#fff;background:#0e1928;border:1px solid #4c6980;border-radius:7px}"+
 "textarea{min-height:116px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:820px;overflow:auto}"+
 ".muted{color:#abc1d1}.warn{color:#fed9a5}.group{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:15px}"+
 "label{display:block;margin:9px 0 5px}h1{font-size:1.8rem;margin-bottom:4px}h2{font-size:1.25rem}</style></head><body>"+
 "<h1>Fun Industrial · FIAL 5.1</h1>"+
 "<p class='muted'>System-wide integration for AI, compute, REA, memory, optimization, workflows, voice, security, engineering, commerce and public-web capabilities.</p>"+
 "<nav><a href='http://127.0.0.1:8804/'>FIAL 5 core (8804)</a>"+
 "<a href='http://127.0.0.1:8803/'>Official data (8803)</a>"+
 "<a href='http://127.0.0.1:8802/'>Integrated Hub (8802)</a></nav>"+
 "<article><h2>Unified coverage</h2><p>18 registered capabilities, with real adapter observations for the previous eight gaps. Unconfigured modules retain their state; no simulated readiness.</p>"+
 "<button type='button' id='fi51-check'>Recheck the entire system</button>"+
 "<pre id='fi51-overview'>Loading real system status…</pre></article>"+
 "<article><h2>Eight connected module adapters</h2><pre id='fi51-modules'>Loading adapters…</pre></article>"+
 "<article><h2>Run one reviewed module operation</h2>"+
 "<p class='warn'>A click authorizes only the selected bounded local operation. REA execution, purchases, sending messages, external business changes and process restarts are not authorized.</p>"+
 "<label for='fi51-module'>Module</label><select id='fi51-module'></select>"+
 "<label for='fi51-operation'>Operation</label><select id='fi51-operation'></select>"+
 "<label for='fi51-input'>Input JSON for the selected operation</label>"+
 "<textarea id='fi51-input' spellcheck='false'>{}</textarea>"+
 "<label><input type='checkbox' id='fi51-consent'> I approve this exact module operation and its local side effects, if any.</label>"+
 "<button type='button' id='fi51-run'>Execute selected approved operation</button>"+
 "<pre id='fi51-result'>No operation requested.</pre></article>"+
 "<script src='/api/fial/modules/widget.js' defer></script></body></html>";

const clean=(x,n=180)=>String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,n);
function send(res,status,value,type="application/json; charset=utf-8"){
 const text=Buffer.isBuffer(value)?value:Buffer.from(typeof value==="string"?value:JSON.stringify(value));
 res.writeHead(status,{"content-type":type,"content-length":text.length,
  "cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer",
  "content-security-policy":"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});
 res.end(text);
}
function hostOkay(req){return ["127.0.0.1:8805","localhost:8805"].includes(req.headers.host)}
export function actionOkay(req){
 return req.method==="POST"&&hostOkay(req)&&
  ["http://127.0.0.1:8805","http://localhost:8805"].includes(req.headers.origin)&&
  req.headers["x-fi-fial-operator"]==="approved-exact-action"&&
  req.headers["content-type"]==="application/json";
}
async function parseBody(req){
 const parts=[];let length=0;
 for await(const chunk of req){
  length+=chunk.length;if(length>MAX_BODY)throw Error("FIAL51_BODY_TOO_LARGE");
  parts.push(chunk);
 }
 const value=JSON.parse(Buffer.concat(parts).toString("utf8"));
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw Error("FIAL51_OBJECT_BODY_REQUIRED");
 return value;
}
async function coreStatus(fetchImpl){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),3500);
 try{
  const r=await fetchImpl("http://127.0.0.1:8804/api/fial/system/status",{
   method:"GET",redirect:"error",signal:ctl.signal,
   headers:{accept:"application/json"}});
  if(!r.ok||!r.body||!String(r.headers.get("content-type")||"").includes("json"))
   throw Error("FIAL5_CORE_STATUS_UNAVAILABLE");
  const chunks=[];let size=0;
  for await(const chunk of r.body){
   size+=chunk.length;if(size>250000)throw Error("FIAL5_CORE_STATUS_TOO_LARGE");
   chunks.push(chunk);
  }
  const s=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(s.version!=="fial-system-runtime-v0.5"||!Array.isArray(s.modules)||
   s.module_count!==18||s.modules.length!==18)
   throw Error("FIAL5_CORE_IDENTITY_INVALID");
  return s;
 }finally{clearTimeout(timer)}
}
export function reconcileCore(core,adapters){
 if(!core||!Array.isArray(core.modules)||!adapters||
  adapters.version!==V51||!Array.isArray(adapters.modules)||
  adapters.count!==8||adapters.modules.length!==8||
  new Set(adapters.modules.map(x=>x.id)).size!==8||
  IDS.some(id=>!adapters.modules.some(x=>x.id===id)))
  throw Error("FIAL51_COVERAGE_SCHEMA_INVALID");
 const byId=new Map(adapters.modules.map(x=>[x.id,x]));
 const modules=core.modules.map(x=>{
  const local=byId.get(x.id);
  if(!local)return {id:x.id,domain:x.domain,
   integration:"FIAL5_OBSERVED_EXISTING_SERVICE",state:x.state,
   decision:x.decision,reason:x.reason||null,details:x.summary||{}};
  if(x.state!=="NOT_INSTRUMENTED")throw Error("FIAL51_ADAPTER_OVERRIDE_CONFLICT");
  return {id:local.id,domain:local.domain,integration:local.integration,
   state:local.state,decision:local.state==="AVAILABLE_CONFIGURED"?
    "OPERATOR_INVOCATION_AVAILABLE":local.state==="HOLD_INTEGRATION"?
    "REVIEW_INTEGRATION_HOLD":"MODULE_CONFIGURATION_REQUIRED",
   reason:local.reason||null,details:local.details,
   operations:local.operations};
 });
 const covered=modules.filter(m=>m.integration==="REAL_MODULE_INTERFACE").length;
 const ready=modules.filter(m=>m.state==="AVAILABLE_CONFIGURED").length;
 return {version:FIAL51_HUB,state:"SYSTEM_WIDE_ADAPTERS_CONNECTED",
  register_count:modules.length,real_adapters_connected:covered,
  real_adapters_configured:ready,
  core_identity_verified:core.verified_modules,
  core_unattested:core.observed_unattested,
  missing_or_unconfigured:modules.filter(m=>
   ["UNAVAILABLE_OR_UNVERIFIED","NOT_INITIALIZED","NOT_ENABLED",
    "RUNTIME_NOT_CONFIGURED","INSTALLED_OR_DISABLED",
    "CACHE_ENDPOINT_UNAVAILABLE","HOLD_INTEGRATION"].includes(m.state)).length,
  modules,authority:"PER_OPERATION_OPERATOR_APPROVAL",
  rea_tools_executed:0,unattended_module_actions:0,
  evidence_integrity:"PERSISTED_METADATA_AND_SHA256"};
}
export function createFial51Hub({adapters=createFial51Adapters(),
 fetchImpl=fetch,evidence=saveIntegrationEvidence,readWidget=()=>readFile(WIDGET,"utf8")}={}){
 let busy=false,last=null,lastError=null;
 async function observe(){
  if(busy)return {version:FIAL51_HUB,state:"busy",reason:"CYCLE_ALREADY_RUNNING"};
  busy=true;
  try{
   const [core,local]=await Promise.all([coreStatus(fetchImpl),adapters.inspectAll()]);
   const result=reconcileCore(core,local);
   await evidence({...local,state:result.state});
   last=result;lastError=null;return result;
  }catch(e){
   lastError=clean(e.message||e,160);
   return {version:FIAL51_HUB,state:"hold",reason:lastError,
    stored_snapshot_available:last!==null};
  }finally{busy=false}
 }
 const server=http.createServer(async(req,res)=>{
  try{
   if(!hostOkay(req))return send(res,403,{error:"FIAL51_HOST_DENIED"});
   if(!req.url||!req.url.startsWith("/")||req.url.startsWith("//")||
    req.url.includes("\\")||req.url.length>2048)
    return send(res,400,{error:"FIAL51_BAD_PATH"});
   const u=new URL(req.url,"http://127.0.0.1:8805");
   if(u.search||u.pathname.includes(".."))
    return send(res,400,{error:"FIAL51_BAD_PATH"});
   if(req.method==="GET"&&u.pathname==="/")
    return send(res,200,html,"text/html; charset=utf-8");
   if(req.method==="GET"&&u.pathname==="/api/fial/modules/widget.js")
    return send(res,200,await readWidget(),"text/javascript; charset=utf-8");
   if(req.method==="GET"&&u.pathname==="/api/fial/modules/health")
    return send(res,200,{version:FIAL51_HUB,state:"ready",
     port:PORT,mode:"system_wide",standalone:true,auto_status_minutes:15,
     actions_without_user_click:0,rea_authority_added:false});
   if(req.method==="GET"&&u.pathname==="/api/fial/modules/status"){
    if(!last)return send(res,200,{version:FIAL51_HUB,state:"not_run",
     configured_operations:OPERATIONS,last_error:lastError});
    return send(res,200,{...last,observed_at_utc:last.observed_at_utc||null,
     configured_operations:OPERATIONS,last_error:lastError});
   }
   if(req.method==="POST"&&u.pathname==="/api/fial/modules/check"){
    if(!actionOkay(req))return send(res,403,{error:"FIAL51_OPERATOR_APPROVAL_REQUIRED"});
    const body=await parseBody(req);
    if(Object.keys(body).length)throw Error("FIAL51_EMPTY_CHECK_BODY_REQUIRED");
    return send(res,200,await observe());
   }
   if(req.method==="POST"&&u.pathname==="/api/fial/modules/operation"){
    if(!actionOkay(req))return send(res,403,{error:"FIAL51_OPERATOR_APPROVAL_REQUIRED"});
    const body=await parseBody(req);
    if(body.approved!==true||typeof body.module!=="string"||
     typeof body.operation!=="string"||
     !Object.hasOwn(body,"input")||Object.keys(body).some(x=>!
     ["approved","module","operation","input"].includes(x)))
     throw Error("FIAL51_EXACT_OPERATOR_APPROVAL_REQUIRED");
    // Separate from automatic observation. One bounded operation per POST.
    const receipt=await adapters.runApproved({module:body.module,
     operation:body.operation,input:body.input});
    await evidence(receipt);
    const payload=JSON.stringify(receipt);
    if(Buffer.byteLength(payload)>180000)
     throw Error("FIAL51_RESULT_TOO_LARGE_FOR_UI");
    return send(res,200,receipt);
   }
   if(u.pathname.startsWith("/api/fial/modules/"))
    return send(res,404,{error:"FIAL51_UNKNOWN_ROUTE"});
   return send(res,404,{error:"FIAL51_UNKNOWN_ROUTE"});
  }catch(e){
   if(!res.headersSent)return send(res,422,{error:clean(e.message||e,180)});
  }
 });
 return Object.freeze({server,observe,initialize:async()=>{const r=await observe();
   if(r.state!=="SYSTEM_WIDE_ADAPTERS_CONNECTED")throw Error("FIAL51_INITIAL_CYCLE_HOLD_"+r.reason);
   return r;},state:()=>({busy,last_error:lastError,has_result:last!==null})});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=="--serve"){
  console.error("FIAL51_EXPLICIT_SERVE_REQUIRED");process.exitCode=2;
 }else{
  const program=await readFile(PROGRAM,"utf8");
  compileFialSystem(program);
  const app=createFial51Hub();
  app.server.on("error",e=>{console.error("FIAL51_SERVER_HOLD="+e.message);process.exitCode=1});
  app.server.listen(PORT,HOST,()=>{
   console.log("FIAL51_DASHBOARD=http://127.0.0.1:8805/");
   console.log("FIAL51_AUTOMATIC_STATUS=STARTUP_AND_EVERY_15_MINUTES");
   void app.observe().then(r=>console.log("FIAL51_FIRST_CYCLE="+r.state));
   const interval=setInterval(()=>void app.observe()
    .then(r=>console.log("FIAL51_STATUS_CYCLE="+r.state)),15*60*1000);
   interval.unref();
  });
 }
}
