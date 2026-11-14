// FIAL 5: cross-domain, active evidence and decision coordinator.
// A universal FIAL state/evidence layer; grants are one registered domain among many.
// Only fixed loopback GET probes. No arbitrary URLs, tool execution, REA calls,
// restarts, shell, model prompts, transactions, or modification of other modules.
import {createHash,randomUUID} from "node:crypto";
import {mkdir,lstat,readFile,writeFile,rename} from "node:fs/promises";
import {join,resolve} from "node:path";
import {homedir} from "node:os";
import {DatabaseSync} from "node:sqlite";
import {compileFialSystem} from "./system-compiler-v5.mjs";

export const FIAL5_RUNTIME="fial-system-runtime-v0.5";
export const FIAL5_DIR=join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),"FunIndustrial","FIAL5System");
export const FIAL5_REGISTRY=Object.freeze([
 {id:"qwen",domain:"ai",kind:"loopback",port:8088,path:"/health",identity:"qwen_llama"},
 {id:"compute",domain:"compute",kind:"loopback",port:8791,path:"/health",identity:"compute_unverified"},
 {id:"control_center",domain:"platform",kind:"loopback",port:8789,path:"/api/status",identity:"dashboard"},
 {id:"local_tools",domain:"tools",kind:"loopback",port:8796,path:"/api/ai/auto-local/status",identity:"local_tools"},
 {id:"rea",domain:"tools",kind:"loopback",port:8797,path:"/api/rea229/status",identity:"rea"},
 {id:"unified_chat",domain:"ai",kind:"loopback",port:8798,path:"/api/unified/status",identity:"unified_chat"},
 {id:"machine_learning",domain:"ml",kind:"loopback",port:8801,path:"/api/ml/status",identity:"machine_learning"},
 {id:"integrated_hub",domain:"platform",kind:"loopback",port:8802,path:"/api/fun/hub/status",identity:"integrated_hub"},
 {id:"commerce",domain:"commerce",kind:"loopback",port:8802,path:"/api/commerce/status",identity:"published_endpoint"},
 {id:"official_grants",domain:"public_data",kind:"loopback",port:8803,path:"/api/fial/live/health",identity:"fial_live"},
 {id:"persistent_memory",domain:"memory",kind:"registration_only"},
 {id:"optimization",domain:"optimization",kind:"registration_only"},
 {id:"workflows",domain:"workflows",kind:"registration_only"},
 {id:"voice",domain:"voice",kind:"registration_only"},
 {id:"security",domain:"security",kind:"registration_only"},
 {id:"engineering_inspection",domain:"engineering",kind:"registration_only"},
 {id:"ecommerce_operations",domain:"commerce",kind:"registration_only"},
 {id:"public_web",domain:"web",kind:"registration_only"}
]);
const hash=x=>createHash("sha256").update(x).digest("hex");
const errorText=x=>String(x??"unknown").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,130);
function classify(entry,value){
 if(!value||typeof value!=="object"||Array.isArray(value))
  return "HOLD_RESPONSE_UNVERIFIED";
 switch(entry.identity){
  case "qwen_llama":
   return value.status==="ok"?"OBSERVED_ENDPOINT":"HOLD_IDENTITY_UNVERIFIED";
  case "compute_unverified":
  case "published_endpoint":
   return "OBSERVED_ENDPOINT_IDENTITY_NOT_ATTESTED";
  case "dashboard":
   return typeof value.lifecycle==="string"?"IDENTITY_VERIFIED":"HOLD_IDENTITY_UNVERIFIED";
  case "local_tools":
   return value.sidecar===true&&value.port===8796?"IDENTITY_VERIFIED":"HOLD_IDENTITY_UNVERIFIED";
  case "rea":
   return value.realReaToolCount===229?"IDENTITY_VERIFIED":"HOLD_IDENTITY_UNVERIFIED";
  case "unified_chat":
   return value.version==="fi-unified-task-chat-8798-v1"?"IDENTITY_VERIFIED":"HOLD_IDENTITY_UNVERIFIED";
  case "machine_learning":
   return value.version==="fun-qwen-scikit-v2"?"IDENTITY_VERIFIED":"HOLD_IDENTITY_UNVERIFIED";
  case "integrated_hub":
   return value.version==="fi-ml-hub-v3"?"IDENTITY_VERIFIED":"HOLD_IDENTITY_UNVERIFIED";
  case "fial_live":
   return value.version==="fi-fial4-live-hub-v1"?"IDENTITY_VERIFIED":"HOLD_IDENTITY_UNVERIFIED";
  default:return "HOLD_IDENTITY_UNVERIFIED";
 }
}
function summarize(entry,value){
 if(!value||typeof value!=="object")return {};
 switch(entry.id){
  case "qwen":return {health:String(value.status||"unknown").slice(0,30)};
  case "compute":return {health:String(value.status||value.state||"observed").slice(0,30)};
  case "control_center":return {lifecycle:String(value.lifecycle).slice(0,55)};
  case "local_tools":return {sidecar:value.sidecar===true,port:value.port};
  case "rea":return {rea_count:value.realReaToolCount,mcp_health:String(value.liveMcpHealth||"unknown").slice(0,30)};
  case "unified_chat":return {version:value.version,state:String(value.state||"unknown").slice(0,30)};
  case "machine_learning":return {version:value.version,external_actions:value.externalActions??"unknown"};
  case "integrated_hub":return {version:value.version,state:String(value.state||"unknown").slice(0,30)};
  case "official_grants":return {version:value.version,state:String(value.state||"unknown").slice(0,30)};
  default:return {observed_status:String(value.state||value.status||"unverified").slice(0,45)};
 }
}
async function boundedJson(entry,fetchImpl){
 const url="http://127.0.0.1:"+entry.port+entry.path;
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),2300);
 try{
  const response=await fetchImpl(url,{method:"GET",redirect:"error",
   headers:{accept:"application/json"},signal:ctl.signal});
  if(!response.ok||!response.body)throw Error("HTTP_"+response.status);
  if(!String(response.headers.get("content-type")||"").toLowerCase().includes("json"))
   throw Error("NON_JSON_RESPONSE");
  if(Number(response.headers.get("content-length")||0)>100000)throw Error("RESPONSE_LIMIT");
  let bytes=0;const chunks=[];
  for await(const chunk of response.body){
   bytes+=chunk.length;if(bytes>100000)throw Error("RESPONSE_LIMIT");
   chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
 }finally{clearTimeout(timer)}
}
export async function observeModules({fetchImpl=fetch,registry=FIAL5_REGISTRY}={}){
 // Clients cannot provide arbitrary remote targets or enable code execution.
 for(const item of registry){
  if(!FIAL5_REGISTRY.some(x=>x.id===item.id&&
    x.kind===item.kind&&x.port===item.port&&x.path===item.path))
   throw Error("FIAL5_REGISTRY_UNAUTHORIZED_TARGET");
 }
 return Promise.all(registry.map(async entry=>{
  if(entry.kind==="registration_only")
   return {id:entry.id,domain:entry.domain,kind:entry.kind,
    state:"NOT_INSTRUMENTED",evidence_hash:null,observed:{},
    reason:"REGISTERED_CAPABILITY_WITHOUT_VERIFIED_RUNTIME_PROBE"};
  try{
   const value=await boundedJson(entry,fetchImpl);
   const state=classify(entry,value),summary=summarize(entry,value);
   const digest=hash(JSON.stringify(summary));
   return {id:entry.id,domain:entry.domain,kind:"loopback",state,
    evidence_hash:digest,observed:summary,
    reason:state.startsWith("HOLD")?"RUNTIME_RESPONSE_IDENTITY_NOT_CONFIRMED":null};
  }catch(e){
   return {id:entry.id,domain:entry.domain,kind:"loopback",
    state:"UNAVAILABLE_OR_UNVERIFIED",evidence_hash:null,observed:{},
    reason:errorText(e?.message||e)};
  }
 }));
}
export function decideModule(module,previous){
 const changed=previous?.evidence_hash!==undefined&&previous.evidence_hash!==null&&
  module.evidence_hash!==null&&previous.evidence_hash!==module.evidence_hash;
 const lost=previous?.state==="IDENTITY_VERIFIED"&&module.state!=="IDENTITY_VERIFIED";
 const decision=module.state==="NOT_INSTRUMENTED"?"INTEGRATION_NEEDED":
  module.state==="UNAVAILABLE_OR_UNVERIFIED"?"INVESTIGATE_LOCAL_DEPENDENCY":
  module.state.startsWith("HOLD")?"REVIEW_IDENTITY_BEFORE_USE":
  lost?"REVIEW_SERVICE_REGRESSION":
  changed?"REVIEW_OBSERVED_CHANGE":"CONTINUE_MONITORING";
 return {module_id:module.id,domain:module.domain,state:module.state,
  changed,regressed:lost,action:decision,
  execution_authorized:false,operator_review_required:decision!=="CONTINUE_MONITORING"};
}
function sqlInit(db){
 db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000");
 db.exec("CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,utc TEXT NOT NULL,module_count INTEGER NOT NULL,holds INTEGER NOT NULL,program_sha TEXT NOT NULL)");
 db.exec("CREATE TABLE IF NOT EXISTS observations(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,module_id TEXT NOT NULL,domain TEXT NOT NULL,state TEXT NOT NULL,evidence_hash TEXT,decision TEXT NOT NULL)");
}
async function loadPrevious(path){
 try{
  const st=await lstat(path);
  if(!st.isFile()||st.isSymbolicLink()||st.size>200000)
   throw Error("FIAL5_PREVIOUS_REPORT_UNTRUSTED");
  const value=JSON.parse(await readFile(path,"utf8"));
  if(value.version!==FIAL5_RUNTIME||!Array.isArray(value.modules)||
    value.modules.length>FIAL5_REGISTRY.length)
   throw Error("FIAL5_PREVIOUS_REPORT_UNTRUSTED");
  return value;
 }catch(e){
  if(e.code==="ENOENT")return null;
  throw e;
 }
}
async function safeDir(path){
 await mkdir(path,{recursive:true});
 const stat=await lstat(path);
 if(!stat.isDirectory()||stat.isSymbolicLink())throw Error("FIAL5_OUTPUT_DIR_UNTRUSTED");
}
export async function runFialSystem({source,directory=FIAL5_DIR,fetchImpl=fetch,
 registry=FIAL5_REGISTRY,now=new Date()}={}){
 const compiled=compileFialSystem(source);
 const stamp=new Date(now);if(!Number.isFinite(+stamp))throw Error("FIAL5_DATE_INVALID");
 const root=resolve(directory);
 await safeDir(root);
 const reports=join(root,"runs"),reportPath=join(root,"last-run.json");
 await safeDir(reports);
 const previous=await loadPrevious(reportPath);
 const modules=await observeModules({fetchImpl,registry});
 const prevMap=new Map((previous?.modules||[]).map(x=>[x.id,x]));
 const decisions=modules.map(x=>decideModule(x,prevMap.get(x.id)));
 const holdCount=decisions.filter(x=>x.action!=="CONTINUE_MONITORING").length;
 const receipt={version:FIAL5_RUNTIME,run_id:randomUUID(),
  program_sha256:hash(source),compiled_version:compiled.bytecode,
  utc:stamp.toISOString(),scope:"FUN_INDUSTRIAL_WHOLE_SYSTEM",
  modules,decisions,module_count:modules.length,
  verified_modules:modules.filter(x=>x.state==="IDENTITY_VERIFIED").length,
  observed_unattested:modules.filter(x=>x.state.startsWith("OBSERVED")).length,
  uninstrumented:modules.filter(x=>x.state==="NOT_INSTRUMENTED").length,
  held_or_pending_modules:holdCount,change_events:decisions.filter(x=>x.changed).length,
  external_tool_executions:0,rea_actions:0,model_calls:0,process_restarts:0,
  financial_actions:0,submissions:0,operational_permissions_added:0,
  state:"SYSTEM_WIDE_COORDINATOR_ACTIVE_EVIDENCE_ONLY",
  coverage_claim:"REGISTERED_MODULES_ONLY_NOT_FULL_INTEGRATION"};
 const dbPath=join(root,"fial-system-memory-v5.sqlite");
 try{
  const info=await lstat(dbPath);
  if(!info.isFile()||info.isSymbolicLink())throw Error("FIAL5_DB_PATH_UNTRUSTED");
 }catch(e){if(e.code!=="ENOENT")throw e}
 const db=new DatabaseSync(dbPath);
 try{
  sqlInit(db);db.exec("BEGIN IMMEDIATE");
  try{
   db.prepare("INSERT INTO runs VALUES(?,?,?,?,?)").run(receipt.run_id,receipt.utc,
    receipt.module_count,holdCount,receipt.program_sha256);
   const insert=db.prepare("INSERT INTO observations VALUES(?,?,?,?,?,?,?)");
   for(let i=0;i<modules.length;i++){
    const m=modules[i],d=decisions[i];
    insert.run(randomUUID(),receipt.run_id,m.id,m.domain,m.state,m.evidence_hash,d.action);
   }
   db.exec("COMMIT");
  }catch(e){try{db.exec("ROLLBACK")}catch{}throw e}
 }finally{db.close()}
 await writeFile(join(reports,receipt.run_id+".json"),JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
 const tmp=join(root,"last-run-"+receipt.run_id+".tmp");
 await writeFile(tmp,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
 await rename(tmp,reportPath);
 return receipt;
}
export async function fialSystemStatus({directory=FIAL5_DIR}={}){
 try{
  const value=await loadPrevious(join(resolve(directory),"last-run.json"));
  if(!value)return {version:FIAL5_RUNTIME,state:"not_run",scope:"FUN_INDUSTRIAL_WHOLE_SYSTEM"};
  if(value.external_tool_executions!==0||value.rea_actions!==0||value.model_calls!==0||
   value.process_restarts!==0||value.financial_actions!==0||value.submissions!==0||
   value.operational_permissions_added!==0)throw Error("FIAL5_REPORT_AUTHORITY_MISMATCH");
  return {version:value.version,state:value.state,scope:value.scope,
   utc:value.utc,module_count:value.module_count,verified_modules:value.verified_modules,
   observed_unattested:value.observed_unattested,uninstrumented:value.uninstrumented,
   pending:value.held_or_pending_modules,change_events:value.change_events,
   modules:value.modules.map((m,i)=>({id:m.id,domain:m.domain,state:m.state,
    reason:m.reason,summary:m.observed,decision:value.decisions[i]?.action,
    changed:value.decisions[i]?.changed})),
   execution_authority:"UNCHANGED_OPERATOR_REVIEW_REQUIRED"};
 }catch{
  return {version:FIAL5_RUNTIME,state:"hold",reason:"STATUS_UNTRUSTED_OR_UNAVAILABLE"};
 }
}
export function createFialSystemController({cycle=runFialSystem,status=fialSystemStatus,
 source=null}={}){
 let busy=false,lastError=null,lastAttempt=null;
 return Object.freeze({
  async run(){
   if(busy)return {state:"busy",reason:"FIAL5_EXISTING_CYCLE_RUNNING"};
   busy=true;lastAttempt=new Date().toISOString();
   try{
    if(typeof source!=="string")throw Error("FIAL5_PROGRAM_NOT_LOADED");
    const result=await cycle({source});
    lastError=null;
    return {version:FIAL5_RUNTIME,state:result.state,utc:result.utc,
     module_count:result.module_count,verified_modules:result.verified_modules,
     uninstrumented:result.uninstrumented,pending:result.held_or_pending_modules,
     change_events:result.change_events,actions_executed:0};
   }catch(e){
    lastError=errorText(e?.message||e);
    return {version:FIAL5_RUNTIME,state:"hold",reason:lastError,
     actions_executed:0};
   }finally{busy=false}
  },
  async status(){
   return {...await status(),cycle_running:busy,last_error:lastError,
    last_attempt_utc:lastAttempt};
  }
 });
}
