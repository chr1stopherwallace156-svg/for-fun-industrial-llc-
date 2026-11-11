// FI_SECURITY_PRIMARY_8789_V1 — stage-only patch of the real deployed dashboard.
// This code never edits its input files. No model, REA, credential, shell, or
// external-network capability is granted to the security audit.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_SECURITY_PRIMARY_8789_V1";
const once=(s,old,repl,label)=>{
 const n=s.split(old).length-1;
 if(n!==1)throw Error("SECURITY_PATCH_ANCHOR_HOLD_"+label+"_COUNT_"+n);
 return s.replace(old,()=>repl);
};
export function patchPrimaryServer(source){
 if(typeof source!=="string"||source.includes(MARK))throw Error("SECURITY_SERVER_ALREADY_PATCHED_OR_INVALID");
 for(const label of ["FI_AUTO_COGNEE_CHAT_V1","FI_VOICE_MOBILE_DASHBOARD_V1",
  "FI_SOURCING_RETIRED_V1","/api/ai/tools","/api/ai/tool-call","/api/rea/call"]){
  if(!source.includes(label))throw Error("SECURITY_PROTECTED_SERVER_MARKER_MISSING_"+label);
 }
 const extra='import {runApprovedLocalDefensiveAudit} from "./security/defensive-audit.mjs";\n';
 let s=once(source,'const root=path.dirname(fileURLToPath(import.meta.url));',
  extra+'// '+MARK+'\nconst root=path.dirname(fileURLToPath(import.meta.url));',"IMPORT_ROOT");
 const route='const server=http.createServer(async(req,res)=>{try{';
 const routes=[
  ' if(req.method==="GET"&&req.url==="/api/security/client.js"){',
  '  if(!localRequest(req,res))return;',
  '  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});',
  '  return res.end(await readFile(path.join(root,"security","security-chat-client.js")));',
  ' }',
  ' if(req.method==="GET"&&req.url==="/api/security/status"){',
  '  if(!localRequest(req,res))return;',
  '  return json(res,200,{state:"ready",mode:"operator_approved_loopback_only",port:config.port,',
  '   tool:"fi_security_local_audit",rea_tools_executed:0,model_authority_to_execute:false});',
  ' }'
 ].join("\n");
 s=once(s,route,route+"\n"+routes,"ROUTES");
 // Avoid preempting existing tool-call handlers; insert an exact special-case
 // directly after their existing parsed JSON body, before standard platform
 // tool dispatch. Never read the HTTP request body twice.
 const handle='if(req.method==="POST"&&req.url==="/api/ai/tool-call"){';
 const start=s.indexOf(handle);
 if(start<0||s.indexOf(handle,start+1)>=0)throw Error("SECURITY_TOOL_ROUTE_NOT_UNIQUE");
 const next=s.indexOf('const body=await readBody(req,1000000);',start);
 const rea=s.indexOf('if(req.method==="GET"&&req.url==="/api/rea/catalog")',start);
 if(next<0||rea<0||next>rea)throw Error("SECURITY_TOOL_BODY_ANCHOR_HOLD");
 const body='const body=await readBody(req,1000000);';
 const suffix=[
  ' // Approved local security tool is handled separately; never forward to compute or REA.',
  ' if(body?.name==="fi_security_local_audit"){',
  '  if(req.headers["x-fi-security-approval"]!=="operator-reviewed")',
  '   return json(res,403,{error:"SECURITY_EXPLICIT_OPERATOR_APPROVAL_REQUIRED"});',
  '  if(!body.arguments||typeof body.arguments!=="object"||Array.isArray(body.arguments)||',
  '     Object.keys(body.arguments).length!==0)return json(res,400,{error:"SECURITY_ARGUMENTS_NOT_ALLOWED"});',
  '  const report=await runApprovedLocalDefensiveAudit({operatorApproved:true,projectRoot:config.cwd});',
  '  return json(res,200,{tool:"fi_security_local_audit",result:report});',
  ' }'
 ].join("\n");
 s=s.slice(0,next)+body+"\n"+suffix+s.slice(next+body.length);
 // Explicitly preserve important call patterns, and never loosen CSP.
 for(const a of ["/api/rea/call","/api/ai/automatic-memory/status",
  "FI_VOICE_MOBILE_DASHBOARD_V1","FI_SOURCING_RETIRED_V1",
  "FI_AUTO_COGNEE_CHAT_V1"]){
  if(!s.includes(a))throw Error("SECURITY_PROTECTED_SERVER_ROUTE_LOST_"+a);
 }
 const csp=[...s.matchAll(/script-src\s+([^;]+);/g)];
 if(csp.length!==1||!/(?:^|\s)'self'(?:\s|$)/.test(csp[0][1]))
  throw Error("SECURITY_CSP_EXTERNAL_SELF_SCRIPTS_REQUIRED");
 return s;
}
export function patchPrimaryTools(source){
 if(typeof source!=="string"||source.includes(MARK))throw Error("SECURITY_TOOLS_ALREADY_PATCHED_OR_INVALID");
 const anchor='export function openAiToolDefinitions(reaTools=[]){';
 // Older Fun Industrial installations already include a bounded zero-arg
 // local audit entry. Reuse that entry instead of adding a duplicate name.
 // Never overwrite/upgrade a pre-existing tool with unexpected parameters.
 const occurrences=[...source.matchAll(/name\s*:\s*["']fi_security_local_audit["']/g)];
 if(occurrences.length>1)throw Error("SECURITY_TOOL_REGISTRY_DUPLICATE_EXISTING");
 let insert;
 if(occurrences.length===1){
  const start=occurrences[0].index;
  const chunk=source.slice(start,start+800);
  if(!/parameters\s*:\s*object\(\s*\{\s*\}\s*,\s*\[\s*\]\s*\)/.test(chunk)||
     !/localSecurity\s*:\s*true/.test(chunk)){
   throw Error("SECURITY_EXISTING_TOOL_NOT_BOUNDED");
  }
  insert='// '+MARK+' — preserve existing zero-argument local audit; REA permissions unchanged.';
 }else{
  insert=[
   '// '+MARK+' — fixed zero-argument local audit; REA permissions unchanged.',
   'platformTools.push({name:"fi_security_local_audit",',
   ' description:"Propose local Fun Industrial security inspection. Operator must approve.",',
   ' parameters:{type:"object",properties:{},required:[],additionalProperties:false},',
   ' localSecurity:true});'
  ].join("\n");
 }
 const out=once(source,anchor,insert+"\n"+anchor,"REGISTRY");
 if(!out.includes('export function getPlatformTool(name)'))throw Error("SECURITY_TOOL_LOOKUP_MISSING");
 return out;
}
export function patchPrimaryUi(source){
 if(typeof source!=="string"||source.includes(MARK))throw Error("SECURITY_UI_ALREADY_PATCHED_OR_INVALID");
 for(const label of ["FI_VOICE_MOBILE_PANEL_V1","FI_OPTIMIZATION_PHASE23_PANEL_V1"]){
  if(!source.includes(label))throw Error("SECURITY_UI_PROTECTED_MARKER_MISSING_"+label);
 }
 // The deployed operator dashboard is not the older GitHub example.
 // Validate its protected voice panel and same-origin script rather than
 // requiring the optional sample chat-input/chat-send element IDs.
 if(!source.includes('id="fi-voice-mobile"')||
    !source.includes('src="/api/voice/mobile/client.js"')){
  throw Error("SECURITY_PRIMARY_VOICE_ANCHOR_NOT_VERIFIED");
 }
 const closing=[...source.matchAll(/<\/body\s*>/gi)];
 if(closing.length!==1)throw Error("SECURITY_UI_BODY_ANCHOR_HOLD");
 const addition='\n<!-- '+MARK+': local chat security button only -->\n'+
  '<script src="/api/security/client.js" defer></script>\n';
 return source.slice(0,closing[0].index)+addition+source.slice(closing[0].index);
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const [liveServer,liveHtml,liveTools,stagedServer,stagedHtml,stagedTools]=process.argv.slice(2);
  const paths=[liveServer,liveHtml,liveTools,stagedServer,stagedHtml,stagedTools];
  if(paths.some(x=>!x)||new Set(paths.map(x=>resolve(x))).size!==6)throw Error("SECURITY_UNIQUE_STAGE_PATHS_REQUIRED");
  const server=patchPrimaryServer(readFileSync(liveServer,"utf8"));
  const html=patchPrimaryUi(readFileSync(liveHtml,"utf8"));
  const tools=patchPrimaryTools(readFileSync(liveTools,"utf8"));
  writeFileSync(stagedServer,server,"utf8");
  writeFileSync(stagedHtml,html,"utf8");
  writeFileSync(stagedTools,tools,"utf8");
  console.log("FUN_SECURITY_PRIMARY_PATCH=STAGED LIVE_FILES_UNCHANGED=TRUE");
 }catch(error){console.error("FUN_SECURITY_PRIMARY_PATCH_HOLD="+String(error.message||error).slice(0,250));process.exitCode=1;}
}
