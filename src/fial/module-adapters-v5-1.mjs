// FIAL 5.1: REAL existing-module adapters. No grants special case.
// Per-cycle snapshots observe actual API/library state. No tools executed on status.
// Every operation is operator-click initiated, single-step, bounded and audited separately.
import {createHash,randomUUID} from "node:crypto";
import {existsSync,lstatSync} from "node:fs";
import {lstat,readdir,readFile,writeFile,mkdir,rename} from "node:fs/promises";
import {join,resolve,basename} from "node:path";
import {fileURLToPath} from "node:url";
import {homedir} from "node:os";
import {DatabaseSync} from "node:sqlite";
import {memoryStatus,memoryAction} from "../intelligence/memory.mjs";
import {createOptimizationRunner} from "../optimization/runner.mjs";
import {createOptimizationAgent} from "../optimization/agent.mjs";
import {createWorkflowCoordinator} from "../workflows/coordinator.mjs";
import {isVoiceMobileEnabled,mobileVoicePaths,validateVoiceWav} from "../voice/mobile-upload.mjs";
import {conversationPaths} from "../voice/conversation.mjs";
import {auditOwnSource} from "../security/defensive-audit.mjs";
import {createVerifiedFileV31} from "../experimental/verified-file-v3-1.mjs";
import {createVerifiedPeInspectionV34,PE_TOOLS} from "../experimental/verified-pe-inspection-v3-4.mjs";
import {createCommerceIntelligence} from "../commerce/trends-commerce-v1.mjs";
import {fetchPublicWebText,validatePublicHttps} from "../experimental/unified-public-web.mjs";

export const V51="fial-eight-module-integration-v5.1";
export const IDS=Object.freeze(["persistent_memory","optimization","workflows","voice","security",
 "engineering_inspection","ecommerce_operations","public_web"]);
export const OPERATIONS=Object.freeze({
 persistent_memory:["recall"],
 optimization:["analyze","save_report"],
 workflows:["create","get","advance","review"],
 voice:["validate_saved_wav"],
 security:["audit_own_source"],
 engineering_inspection:["pe_preflight","file_preflight"],
 ecommerce_operations:["cached_opportunities"],
 public_web:["fetch_static_text"]
});
export const BASE=join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),
 "FunIndustrial","FIAL51Integrations");
const ROOT=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const FIAL_STATUS=Object.freeze({state:"ADAPTER_CONNECTED"});
const digest=x=>createHash("sha256").update(x).digest("hex");
const clamp=(x,n=100)=>String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,n);
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const GUID=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const WAV=/^iphone-\d{8}T\d{6}Z-[a-f0-9]{12}\.wav$/;
const REA_URLS=new Set([
 "http://127.0.0.1:8797/api/rea229/status",
 "http://127.0.0.1:8797/api/rea229/tools?limit=229"
]);
const loopJson=async (url,fetchImpl)=>{
 if(!REA_URLS.has(url) && url!=="http://127.0.0.1:8802/api/commerce/opportunities")
  throw Error("FIAL51_URL_NOT_APPROVED");
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),5000);
 try{
  const r=await fetchImpl(url,{method:"GET",redirect:"error",
   headers:{accept:"application/json"},signal:ctl.signal});
  if(!r.ok)throw Error("FIAL51_LOCAL_HTTP_"+r.status);
  if(!String(r.headers.get("content-type")||"").includes("json"))
   throw Error("FIAL51_LOCAL_JSON_REQUIRED");
  let n=0;const chunks=[];
  for await(const part of r.body){
   n+=part.length;if(n>180000)throw Error("FIAL51_LOCAL_RESPONSE_TOO_LARGE");
   chunks.push(part);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
 }finally{clearTimeout(timeout)}
};
const storageRoot=()=>join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),
 "FunIndustrial","WorkflowRuntime","checkpoints");
async function inspectWorkflowStore(root=storageRoot()){
 try{
  const st=await lstat(root);
  if(!st.isDirectory()||st.isSymbolicLink())throw Error("WORKFLOW_STORAGE_UNTRUSTED");
  const names=(await readdir(root)).filter(x=>GUID.test(x.replace(/\.json$/,""))&&x.endsWith(".json"));
  return {storage:"present",checkpoint_count:names.length,capabilities:["create","get","advance","review"]};
 }catch(e){
  if(e.code==="ENOENT")return {storage:"not_initialized",checkpoint_count:0,
   capabilities:["create","get","advance","review"]};
  throw e;
 }
}
function statusAdapter(id,state,details,reason=null){
 return {id,domain:id==="public_web"?"web":id==="engineering_inspection"?"engineering":
  id==="ecommerce_operations"?"commerce":id==="persistent_memory"?"memory":id,
  integration:"REAL_MODULE_INTERFACE",state,details,reason,authority:"OPERATOR_APPROVAL_REQUIRED_FOR_OPERATIONS",
  operations:OPERATIONS[id]};
}
export function createFial51Adapters({
 fetchImpl=fetch,memoryStatusFn=memoryStatus,memoryActionFn=memoryAction,
 optimizationRunner=createOptimizationRunner(),workflowCoordinator=createWorkflowCoordinator(),
 voiceEnabled=isVoiceMobileEnabled,voicePaths=mobileVoicePaths,
 commerce=createCommerceIntelligence(),webFetch=fetchPublicWebText,
 audit=auditOwnSource,repositoryRoot=ROOT,now=()=>new Date()
}={}){
 const agent=createOptimizationAgent({runner:optimizationRunner});
 const req=async url=>loopJson(url,fetchImpl);
 const engineeringPe=createVerifiedPeInspectionV34({request:req});
 const engineeringFile=createVerifiedFileV31({request:req});
 let operationBusy=false;
 async function inspectOne(id){
  try{
   switch(id){
    case "persistent_memory":{
     const s=memoryStatusFn();
     return statusAdapter(id,s.enabled?"AVAILABLE_CONFIGURED":"INSTALLED_OR_DISABLED",
      {engine:s.engine,available:s.available===true,enabled:s.enabled===true,
       writesEnabled:s.writesEnabled===true,automaticIngestion:s.automaticIngestion===true});
    }
    case "optimization":{
     const s=optimizationRunner.status();
     return statusAdapter(id,s.state==="ready"?"AVAILABLE_CONFIGURED":"RUNTIME_NOT_CONFIGURED",
      {schema:s.schema,engine_state:s.state,engines:s.engines,
       capabilities:s.capabilities,pythonAvailable:s.pythonAvailable===true,
       sourceAvailable:s.sourceAvailable===true,running:s.running===true});
    }
    case "workflows":{
     const w=await inspectWorkflowStore();
     return statusAdapter(id,w.storage==="present"?"AVAILABLE_CONFIGURED":"NOT_INITIALIZED",
      w);
    }
    case "voice":{
     const p=voicePaths(),c=conversationPaths();
     const enabled=voiceEnabled();
     const items=[c.python,c.transcriber,c.modelDir];
     const configured=items.every(x=>existsSync(x)&&!lstatSync(x).isSymbolicLink());
     return statusAdapter(id,enabled?"AVAILABLE_CONFIGURED":"NOT_ENABLED",
      {recording_enabled:enabled,offline_conversation_files:configured,
       supports:["saved_wav_validation","existing_voice_conversation"]});
    }
    case "security":{
     if(!existsSync(resolve(repositoryRoot,"src","security","defensive-audit.mjs")))
      throw Error("SECURITY_MODULE_MISSING");
     return statusAdapter(id,"AVAILABLE_CONFIGURED",
      {engine:"fun-security-phase4",scanner:"bounded_local_source_audit",
       network:"loopback_only",evidence_flags_are_provisional:true});
    }
    case "engineering_inspection":{
     const pe=engineeringPe.status(),file=engineeringFile.status();
     return statusAdapter(id,"AVAILABLE_CONFIGURED",
      {pe_version:pe.version,file_version:file.version,pe_tools:PE_TOOLS,
       requiresSeparateOperatorConfirmation:true,rea_tools_executed:0});
    }
    case "ecommerce_operations":{
     const s=await commerce.status();
     const cache=await req("http://127.0.0.1:8802/api/commerce/opportunities")
      .catch(e=>({state:"unavailable",error:clamp(e.message,80)}));
     return statusAdapter(id,cache.version==="fun-commerce-opportunities-v1.1"?
      "AVAILABLE_CONFIGURED":"CACHE_ENDPOINT_UNAVAILABLE",
      {intelligence_schema:s.version,shopify_configured:s.shopify?.configured===true,
       cached_opportunity_version:cache.version||null,
       cached_opportunity_state:clamp(cache.state,70),
       verified_sales_proof:cache.qualifies_as_verified_sales_opportunity===true});
    }
    case "public_web":{
     validatePublicHttps("https://example.com/");
     return statusAdapter(id,"AVAILABLE_CONFIGURED",
      {engine:"fi-unified-public-web-v1",protocol:"https_public_only",
       max_text_chars:7000,dns_pinned:true,sourceTrust:"untrusted",
       network_fetch_on_status:false});
    }
   }
   throw Error("FIAL51_MODULE_UNKNOWN");
  }catch(e){return statusAdapter(id,"HOLD_INTEGRATION",{},
    clamp(e.message||e,120))}
 }
 async function inspectAll(){
  const checks=await Promise.all(IDS.map(inspectOne));
  return {version:V51,scope:"ALL_EIGHT_PREVIOUSLY_UNINSTRUMENTED_MODULES",
   at_utc:now().toISOString(),count:checks.length,
   ready:checks.filter(x=>x.state==="AVAILABLE_CONFIGURED").length,
   needs_configuration:checks.filter(x=>["NOT_ENABLED","RUNTIME_NOT_CONFIGURED","NOT_INITIALIZED",
    "INSTALLED_OR_DISABLED","CACHE_ENDPOINT_UNAVAILABLE"].includes(x.state)).length,
   holds:checks.filter(x=>x.state==="HOLD_INTEGRATION").length,
   modules:checks,permissions_granted:0,automatic_tool_calls:0,
   no_auto_execution:true};
 }
 async function runApproved({module,operation,input={}}={}){
  if(!IDS.includes(module)||!OPERATIONS[module]?.includes(operation))
   throw Error("FIAL51_UNSUPPORTED_ADAPTER_OPERATION");
  if(!obj(input)||Buffer.byteLength(JSON.stringify(input),"utf8")>35000)
   throw Error("FIAL51_INPUT_INVALID");
  if(operationBusy)throw Error("FIAL51_OPERATION_ALREADY_RUNNING");
  operationBusy=true;
  try{
   let result;
   switch(module){
    case "persistent_memory":
     if(operation!=="recall"||typeof input.query!=="string"||
      input.query.trim().length<2||input.query.length>500||
      Object.keys(input).some(x=>x!=="query"))
      throw Error("FIAL51_MEMORY_RECALL_INPUT_INVALID");
     result=await memoryActionFn("recall",{query:input.query});break;
    case "optimization":
     if(operation==="analyze"){
      if(typeof input.request!=="string"||!obj(input.problem)||input.request.length>2400)
       throw Error("FIAL51_OPTIMIZATION_INPUT_INVALID");
      result=await agent.analyze({request:input.request,problem:input.problem});
     }else{
      if(typeof input.ticket!=="string"||Object.keys(input).some(x=>x!=="ticket"))
       throw Error("FIAL51_OPTIMIZATION_APPROVAL_INVALID");
      result=await agent.approve({ticket:input.ticket,action:"save-report"});
     }
     break;
    case "workflows":
     if(operation==="get"||operation==="advance"){
      if(!GUID.test(input.id||"")||Object.keys(input).some(x=>x!=="id"))
       throw Error("FIAL51_WORKFLOW_ID_INVALID");
      result=operation==="get"?await workflowCoordinator.get(input.id):
       await workflowCoordinator.advance(input.id);
     }else if(operation==="create"){
      if(!obj(input.spec)||Object.keys(input).some(x=>x!=="spec"))
       throw Error("FIAL51_WORKFLOW_SPEC_REQUIRED");
      result=await workflowCoordinator.create(input.spec);
     }else{
      if(!GUID.test(input.id||"")||!["approve","reject"].includes(input.decision)||
       Object.keys(input).some(x=>!["id","decision"].includes(x)))
       throw Error("FIAL51_WORKFLOW_REVIEW_INVALID");
      result=await workflowCoordinator.review(input.id,input.decision);
     }
     break;
    case "voice":{
     if(operation!=="validate_saved_wav"||!WAV.test(input.filename||"")||
      Object.keys(input).some(x=>x!=="filename")||!voiceEnabled())
      throw Error("FIAL51_VOICE_INPUT_OR_ENABLEMENT_HOLD");
     const path=join(voicePaths().recordings,input.filename);
     const st=await lstat(path);
     if(!st.isFile()||st.isSymbolicLink()||st.size>1100000)
      throw Error("FIAL51_VOICE_UNTRUSTED_FILE");
     const wav=await readFile(path);
     result={schema:"fun.voice.validation.v1",state:"validated",
      ...validateVoiceWav(wav),transcribed:false,recording_written:false};
     break;
    }
    case "security":
     if(operation!=="audit_own_source"||Object.keys(input).length)
      throw Error("FIAL51_SECURITY_INPUT_INVALID");
     result=await audit(join(repositoryRoot,"src"),{maxFiles:300});
     break;
    case "engineering_inspection":
     if(operation==="pe_preflight"){
      if(!PE_TOOLS.includes(input.name)||Object.keys(input).some(x=>x!=="name"))
       throw Error("FIAL51_PE_TOOL_NOT_ALLOWLISTED");
      result=await engineeringPe.preflight({name:input.name});
     }else{
      if(Object.keys(input).length)throw Error("FIAL51_FILE_PREFLIGHT_INPUT_INVALID");
      result=await engineeringFile.preflight();
     }
     break;
    case "ecommerce_operations":
     if(operation!=="cached_opportunities"||Object.keys(input).length)
      throw Error("FIAL51_COMMERCE_INPUT_INVALID");
     result=await req("http://127.0.0.1:8802/api/commerce/opportunities");
     if(result.version!=="fun-commerce-opportunities-v1.1"||
      result.qualifies_as_verified_sales_opportunity!==false||
      result.order_authority!==false)
      throw Error("FIAL51_COMMERCE_DATA_OR_AUTHORITY_INVALID");
     break;
    case "public_web":
     if(operation!=="fetch_static_text"||typeof input.url!=="string"||
      Object.keys(input).some(x=>x!=="url"))
      throw Error("FIAL51_WEB_INPUT_INVALID");
     validatePublicHttps(input.url);
     result=await webFetch(input.url);
     if(result.sourceTrust!=="untrusted"||result.noScriptsExecuted!==true||
      result.redirectsFollowed!==0||result.kind!=="public_web_static_text")
      throw Error("FIAL51_WEB_RESULT_UNTRUSTED");
     break;
   }
   if(!result||typeof result!=="object")throw Error("FIAL51_ADAPTER_BAD_RESULT");
   return {version:V51,module,operation,state:"completed",result,
    actions_auto_executed:0,rea_execution_authorized:false,
    business_changes_authorized:false};
  }finally{operationBusy=false}
 }
 return Object.freeze({inspectAll,inspectOne,runApproved,
  state:()=>({operation_busy:operationBusy,version:V51})});
}
export async function saveIntegrationEvidence(receipt,{directory=BASE}={}){
 if(!receipt||receipt.version!==V51)throw Error("FIAL51_EVIDENCE_INPUT_INVALID");
 const root=resolve(directory);await mkdir(root,{recursive:true});
 const st=await lstat(root);if(!st.isDirectory()||st.isSymbolicLink())
  throw Error("FIAL51_EVIDENCE_DIRECTORY_UNTRUSTED");
 const log=join(root,"integration-events.sqlite");
 try{const x=await lstat(log);if(!x.isFile()||x.isSymbolicLink())throw Error("FIAL51_LEDGER_UNTRUSTED")}
 catch(e){if(e.code!=="ENOENT")throw e}
 const result=receipt.result||receipt.modules||{},size=JSON.stringify(result).length;
 const hash=digest(JSON.stringify(result));
 const id=randomUUID(),at=new Date().toISOString();
 const db=new DatabaseSync(log);
 try{
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL");
  db.exec("CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,utc TEXT NOT NULL,kind TEXT NOT NULL,module TEXT,operation TEXT,result_hash TEXT NOT NULL,result_size INTEGER NOT NULL)");
  db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?,?)").run(id,at,
   receipt.operation?"operator_action":"status_cycle",
   receipt.module||null,receipt.operation||null,hash,size);
 }finally{db.close()}
 // No transcript, memory excerpt, voice data, secrets, or full web page persisted.
 const compact={version:V51,event_id:id,utc:at,module:receipt.module||null,
  operation:receipt.operation||"status_cycle",result_sha256:hash,result_size:size,
  state:receipt.state||"recorded",raw_content_persisted:false};
 const tmp=join(root,"latest-"+id+".tmp");
 await writeFile(tmp,JSON.stringify(compact,null,2)+"\n",{flag:"wx"});
 await rename(tmp,join(root,"last-evidence.json"));
 return compact;
}
