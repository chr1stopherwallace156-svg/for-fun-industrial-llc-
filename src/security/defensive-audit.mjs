// FUN_SECURITY_PHASE4_V1
// Original English-only defensive checks. No Fscan source, payloads or dependencies.
// No OS command execution, credentials, exploits, process changes, REA or Ollama.
// Chat scope is fixed to this host's loopback and this platform's own source tree.
import {lstat,readFile,readdir} from "node:fs/promises";
import {resolve,relative,join,extname} from "node:path";
import {request as httpRequest} from "node:http";
import {scanApproved,DEFAULT_PORTS} from "./local-scan.mjs";
import {pathToFileURL} from "node:url";

const CODE_EXT=new Set([".mjs",".cjs",".js",".ts",".tsx",".py",".ps1"]);
const OMIT=new Set([".git","node_modules",".runtime","__pycache__",".venv","venv","build","dist",".cache",".pytest_cache"]);
const MAX_SOURCE_FILES=300;
const MAX_SOURCE_BYTES=6*1024*1024;
const MAX_SINGLE_FILE=128*1024;
const MAX_DEPTH=9;
const MIN_AUDIT_TIMEOUT=100;
const HTTP_PORTS=new Set([8088,8788,8789,8790,8791,8794]);
const PRIMARY_SECURITY_PORTS=Object.freeze([8088,8443,8788,8789,8790,8791,8794]);
const RULES=Object.freeze([
  {id:"DYNAMIC_EVALUATION",re:/(?<![.$\w])eval\s*\(|\bnew\s+Function\s*\(/i,description:"Dynamic code evaluation requires review",priority:"high"},
  {id:"SHELL_OR_PROCESS_EXECUTION",re:/\b(?:subprocess\.(?:Popen|run|call|check_output)\s*\(|os\.system\s*\(|(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\s*\(|Start-Process\b|Invoke-Expression\b)/i,description:"Executable process launch or shell invocation deserves authorization review",priority:"medium"},
  {id:"INSECURE_TLS_CONFIG",re:/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0\b|verify\s*=\s*False\b|check_hostname\s*=\s*False\b/i,description:"TLS verification might be disabled",priority:"high"},
  {id:"DOWNLOAD_AND_EXECUTE",re:/\b(?:curl|wget)\b.{0,160}\|\s*(?:sh|bash|pwsh|powershell)\b/i,description:"Remote download piped into execution needs review",priority:"high"},
  {id:"ENCODED_POWERSHELL",re:/\b(?:-EncodedCommand|-enc)\b/i,description:"Encoded script execution needs review",priority:"medium"}
]);

function boundedString(value,n=120) {
 return typeof value==="string"?value.replace(/[\u0000-\u001f\u007f]/g," ").slice(0,n):"";
}
function safeStat(path) {
 return lstat(path).then(s=>{
  if(s.isSymbolicLink())throw Error("SECURITY_SOURCE_SYMLINK_HOLD");
  return s;
 });
}
export async function auditOwnSource(root,{maxFiles=MAX_SOURCE_FILES}={}) {
 if(typeof root!=="string"||!root||!resolve(root))throw Error("SECURITY_SOURCE_ROOT_INVALID");
 const base=resolve(root);
 const stat=await safeStat(base);
 if(!stat.isDirectory())throw Error("SECURITY_SOURCE_NOT_DIRECTORY");
 if(!Number.isInteger(maxFiles)||maxFiles<1||maxFiles>MAX_SOURCE_FILES)throw Error("SECURITY_SOURCE_FILE_LIMIT_INVALID");
 let bytes=0,files=0,totalIndicators=0;
 const findings=[];
 async function walk(folder,depth) {
  if(depth>MAX_DEPTH)throw Error("SECURITY_SOURCE_DEPTH_LIMIT");
  const entries=await readdir(folder,{withFileTypes:true});
  entries.sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries) {
   if(entry.name.startsWith(".")&&entry.name!==".github")continue;
   if(OMIT.has(entry.name.toLowerCase()))continue;
   const full=join(folder,entry.name),info=await safeStat(full);
   if(info.isDirectory()) {await walk(full,depth+1);continue;}
   if(!info.isFile()||!CODE_EXT.has(extname(entry.name).toLowerCase()))continue;
   if(++files>maxFiles)throw Error("SECURITY_SOURCE_FILE_LIMIT");
   if(info.size>MAX_SINGLE_FILE)throw Error("SECURITY_SOURCE_SINGLE_FILE_LIMIT");
   bytes+=info.size;
   if(bytes>MAX_SOURCE_BYTES)throw Error("SECURITY_SOURCE_TOTAL_BYTES_LIMIT");
   const before=info;
   const data=await readFile(full);
   const after=await safeStat(full);
   if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.size!==data.length)
    throw Error("SECURITY_SOURCE_CHANGED_DURING_READ");
   const lines=data.toString("utf8").split("\n");
   const rel=relative(base,full).replaceAll("\\","/");
   for(let n=0;n<lines.length;n++) {
    // Skip whole-line comments and innocuous .eval() model methods. This is a
    // bounded heuristic, not a parser or a vulnerability confirmation.
    if(/^\s*(?:\/\/|#|\/\*|\*|<!--)/.test(lines[n]))continue;
    for(const rule of RULES) {
     if(rule.re.test(lines[n])) {
      totalIndicators++;
      if(findings.length<32)findings.push({file:rel,line:n+1,rule:rule.id,description:rule.description,severity:"review",priority:rule.priority});
     }
    }
   }
  }
 }
 await walk(base,0);
 return {state:"completed",files_inspected:files,bytes_inspected:bytes,
   indicators:findings,indicator_count:totalIndicators,indicator_limit:32,indicators_truncated:totalIndicators>findings.length,
   risk_summary:{high:findings.filter(x=>x.priority==="high").length,medium:findings.filter(x=>x.priority==="medium").length},
   note:"Heuristic review indicators, not confirmed malware. Comments and .eval() methods are excluded from the dynamic-evaluation rule. No files executed.",
   scan_scope:"SELECTED_SOURCE_TYPES_EXCLUDES_SECRETS_AND_DEPENDENCIES"};
}
export function classifyHttpHeaders({statusCode,headers}={}) {
 const raw=headers&&typeof headers==="object"?headers:{};
 const get=(key)=>boundedString(raw[key],100);
 const type=get("content-type");
 const hints=[];
 if(type.includes("text/html")){
  if(get("x-content-type-options").toLowerCase()!=="nosniff")hints.push("MISSING_NOSNIFF_HEADER");
  if(!get("content-security-policy"))hints.push("MISSING_CSP_HEADER");
 }
 return {http_status:Number.isInteger(statusCode)?statusCode:null,
  headers:{server:get("server"),content_type:type,x_content_type_options:get("x-content-type-options"),content_security_policy_present:!!get("content-security-policy")},
  advisory:hints};
}
export async function probeLoopbackHttp(port,{timeoutMs=800,probeImpl=httpRequest}={}) {
 if(!HTTP_PORTS.has(port))return {port,state:"NOT_A_CONFIGURED_HTTP_PORT"};
 if(!Number.isInteger(timeoutMs)||timeoutMs<MIN_AUDIT_TIMEOUT||timeoutMs>1500)
  throw Error("SECURITY_HTTP_TIMEOUT_INVALID");
 const endpoint=([8788,8789,8794].includes(port)?"/api/status":"/health");
 return new Promise(resolve=>{
  let done=false,client;
  const finish=(value)=>{
   if(done)return;
   done=true;
   if(client)client.destroy();
   resolve({port,...value});
  };
  try{
   client=probeImpl({host:"127.0.0.1",port,path:endpoint,method:"HEAD",agent:false,
    headers:{"user-agent":"FunIndustrial-DefensiveAudit/1","connection":"close"},
    timeout:timeoutMs,maxHeaderSize:8192},res=>{
     // HEAD does not read response body, redirects never followed, no authentication.
     res.resume();
     finish({state:"HTTP_RESPONDED",...classifyHttpHeaders(res)});
    });
   client.on("timeout",()=>finish({state:"TIMEOUT"}));
   client.on("error",()=>finish({state:"NO_HTTP_RESPONSE"}));
   client.end();
  }catch{finish({state:"NO_HTTP_RESPONSE"});}
 });
}
export async function runApprovedLocalDefensiveAudit({
 operatorApproved=false,projectRoot,ports=PRIMARY_SECURITY_PORTS,
 scanImpl=scanApproved,httpImpl=probeLoopbackHttp,sourceImpl=auditOwnSource
}={}) {
 if(operatorApproved!==true)throw Error("SECURITY_OPERATOR_APPROVAL_REQUIRED");
 if(typeof projectRoot!=="string"||!projectRoot)throw Error("SECURITY_PROJECT_ROOT_REQUIRED");
 if(!Array.isArray(ports)||ports.length<1||ports.length>8||
    ports.some(x=>!Number.isInteger(x)||x<1||x>65535)||new Set(ports).size!==ports.length)
  throw Error("SECURITY_PORT_LIST_INVALID");
 // All chat tool targets are pinned to this host, no model-supplied addresses.
 const tcp=await scanImpl({target:"127.0.0.1",ports,authorized:true,timeoutMs:500});
 if(tcp.host!=="127.0.0.1"||tcp.protocol!=="TCP_CONNECT_ONLY"||!Array.isArray(tcp.results))
  throw Error("SECURITY_TCP_RESULT_INVALID");
 const http=[];
 for(const entry of tcp.results){
  if(entry.status==="open"&&HTTP_PORTS.has(entry.port)){
   http.push(await httpImpl(entry.port));
  }
 }
 const source=await sourceImpl(projectRoot);
 if(source.state!=="completed"||!Array.isArray(source.indicators))throw Error("SECURITY_SOURCE_RESULT_INVALID");
 return {
  event:"FUN_ENGLISH_LOCAL_SECURITY_AUDIT_V2",
  state:"completed",
  mode:"OFFLINE_DEFENSIVE_LOOPBACK",
  tcp:tcp.results,
  http,
  source,
  gateway_note:"Port 8443 is checked only on 127.0.0.1. A gateway bound exclusively to a NetBird IP will not be visible through that check. HTTPS gateway access is preserved and not altered.",
  findings_are_untrusted:true,
  false_positive_warning:"Review indicators manually; these checks do not certify malware absence.",
  constraints:{target:"127.0.0.1",ports_checked:ports.length,rea_tools_executed:0,
   credential_attempts:0,exploits_executed:0,external_hosts_scanned:0,repairs_applied:0}
 };
}
const CLI=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(CLI){
 try{
  const [action,root,...rest]=process.argv.slice(2);
  if(action!=="preview"&&action!=="run")throw Error("USAGE: preview|run PROJECT_ROOT");
  if(rest.length||!root)throw Error("SECURITY_CLI_ARGUMENTS_INVALID");
  if(action==="preview"){
   console.log(JSON.stringify({event:"FUN_LOCAL_SECURITY_AUDIT_PLAN",state:"preview_only",target:"127.0.0.1",
    ports:[...PRIMARY_SECURITY_PORTS],source_root:resolve(root),connections_started:0,
    operator_approval_required:true}));
  }else console.log(JSON.stringify(await runApprovedLocalDefensiveAudit({operatorApproved:true,projectRoot:root})));
 }catch(e){console.error("FUN_LOCAL_SECURITY_AUDIT_HOLD="+boundedString(e.message,180));process.exitCode=1;}
}
