import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {patchPrimaryServer,patchPrimaryTools,patchPrimaryUi} from "../scripts/patch-security-primary-8789.mjs";
import {auditOwnSource,runApprovedLocalDefensiveAudit} from "../src/security/defensive-audit.mjs";

const SERVER=[
 'import http from "node:http";',
 'import path from "node:path";',
 'import {fileURLToPath} from "node:url";',
 'import {readFile} from "node:fs/promises";',
 'const FI_AUTO_COGNEE_CHAT_V1=true;',
 'const FI_VOICE_MOBILE_DASHBOARD_V1=true;',
 'const FI_SOURCING_RETIRED_V1=true;',
 'const root=path.dirname(fileURLToPath(import.meta.url));',
 'const config={port:8789,cwd:"C:\\\\FunIndustrial"};',
 'function localRequest(){return true}',
 'function json(){return null}',
 'function readBody(){return {name:"x",arguments:{}}}',
 'const server=http.createServer(async(req,res)=>{try{',
 ' if(req.method==="GET"&&req.url==="/api/ai/tools"){}',
 ' if(req.method==="POST"&&req.url==="/api/ai/tool-call"){',
 '  const body=await readBody(req,1000000);',
 '  if(typeof body.name!=="string")return;',
 ' }',
 ' if(req.method==="GET"&&req.url==="/api/rea/catalog"){}',
 ' if(req.method==="POST"&&req.url==="/api/rea/call"){}',
 ' if(req.url==="/api/ai/automatic-memory/status"){}',
 ' if(req.url==="/api/ai/chat"){}',
 ' if(req.url==="/api/voice/mobile/"){}',
 ' }catch{} });',
 'const csp="script-src \'self\';"',
].join("\n");
const TOOLS=[
 'const platformTools=[];',
 'export function openAiToolDefinitions(reaTools=[]){return platformTools}',
 'export function getPlatformTool(name){return platformTools.find(t=>t.name===name)||null}',
].join("\n");
const UI='<html><body><!-- FI_VOICE_MOBILE_PANEL_V1 FI_OPTIMIZATION_PHASE23_PANEL_V1 --><div id="chat-input"></div><p>existing chat retained</p></body></html>';

test("surgical server patch preserves installed voice, memory and REA and inserts approval-only tool",()=>{
 const out=patchPrimaryServer(SERVER);
 assert.match(out,/FI_SECURITY_PRIMARY_8789_V1/);
 for(const marker of ["FI_AUTO_COGNEE_CHAT_V1","FI_VOICE_MOBILE_DASHBOARD_V1","FI_SOURCING_RETIRED_V1","/api/rea/call","/api/ai/automatic-memory/status"]){
  assert.ok(out.includes(marker));
 }
 assert.match(out,/x-fi-security-approval/);
 assert.match(out,/operator-reviewed/);
 assert.match(out,/SECURITY_ARGUMENTS_NOT_ALLOWED/);
 assert.match(out,/runApprovedLocalDefensiveAudit/);
 assert.match(out,/\/api\/security\/client.js/);
 assert.match(out,/\/api\/security\/status/);
 assert.doesNotMatch(out,/REAPERMIT_ALL|NODE_TLS_REJECT_UNAUTHORIZED/);
});
test("tool registry has zero user/model arguments and no REA policy change",()=>{
 const s=patchPrimaryTools(TOOLS);
 assert.match(s,/fi_security_local_audit/);
 assert.match(s,/additionalProperties:false/);
 assert.doesNotMatch(s,/allowedTools=|REA_ALLOWED_TOOLS=/);
 assert.throws(()=>patchPrimaryTools(s),/SECURITY_TOOLS_ALREADY_PATCHED/);
});
test("UI inserts one external script while preserving existing chat",()=>{
 const s=patchPrimaryUi(UI);
 assert.match(s,/existing chat retained/);
 assert.match(s,/FI_VOICE_MOBILE_PANEL_V1/);
 assert.match(s,/FI_OPTIMIZATION_PHASE23_PANEL_V1/);
 assert.equal((s.match(/\/api\/security\/client.js/g)||[]).length,1);
 assert.throws(()=>patchPrimaryUi(s),/SECURITY_UI_ALREADY_PATCHED/);
});
test("missing live patch markers fails closed and never edits input",()=>{
 assert.throws(()=>patchPrimaryServer(SERVER.replace("FI_AUTO_COGNEE_CHAT_V1","OLD_MEMORY")),/SECURITY_PROTECTED_SERVER_MARKER_MISSING/);
 assert.throws(()=>patchPrimaryServer(SERVER.replace("script-src 'self'","script-src 'unsafe-inline'")),/SECURITY_CSP_EXTERNAL_SELF_SCRIPTS_REQUIRED/);
 assert.throws(()=>patchPrimaryUi(UI.replace("FI_VOICE_MOBILE_PANEL_V1","OLD_VOICE")),/SECURITY_UI_PROTECTED_MARKER_MISSING/);
});
test("missing tool body or ambiguous anchors fails closed",()=>{
 assert.throws(()=>patchPrimaryServer(SERVER.replace("const body=await readBody(req,1000000);","const bad=1;")),/SECURITY_TOOL_BODY_ANCHOR_HOLD/);
 assert.throws(()=>patchPrimaryServer(SERVER.replace("const root=path.dirname(fileURLToPath(import.meta.url));","const root='bad';")),/SECURITY_PATCH_ANCHOR_HOLD_IMPORT_ROOT/);
});
test("false positive reductions skip PyTorch .eval() and comments",async t=>{
 const dir=await mkdtemp(join(tmpdir(),"fi-phase5-security-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 await writeFile(join(dir,"a.py"),[
  "# do not call eval(",
  "    model.eval()",
  "    neural_model.eval()",
  "    result = eval('bad')",
  "    subprocess.run(['safe_program'],shell=False)",
 ].join("\n"));
 await writeFile(join(dir,"b.mjs"),[
  "// eval('innocuous comment')",
  "const x=engine.eval()",
  "const y=eval(userInput)",
 ].join("\n"));
 const r=await auditOwnSource(dir);
 assert.equal(r.state,"completed");
 assert.deepEqual(r.indicators.map(x=>x.rule),["DYNAMIC_EVALUATION","SHELL_OR_PROCESS_EXECUTION","DYNAMIC_EVALUATION"]);
 assert.equal(r.risk_summary.high,2);
 assert.equal(r.risk_summary.medium,1);
 assert.equal(r.indicator_count,3);
});
test("fixed primary audit inspects 8789 and 8443 but does not HTTP-probe NetBird gateway on localhost",async()=>{
 const ports=[];
 const http=[];
 const result=await runApprovedLocalDefensiveAudit({
  operatorApproved:true,projectRoot:"fixture",
  scanImpl:async args=>{
   ports.push(...args.ports);
   return {host:"127.0.0.1",protocol:"TCP_CONNECT_ONLY",results:args.ports.map(port=>({port,status:"open"}))};
  },
  httpImpl:async port=>{http.push(port);return {port,state:"HTTP_RESPONDED",http_status:200}},
  sourceImpl:async()=>({state:"completed",indicators:[],risk_summary:{high:0,medium:0},files_inspected:1})
 });
 assert.deepEqual(ports,[8088,8443,8788,8789,8790,8791,8794]);
 assert.ok(http.includes(8789));
 assert.ok(!http.includes(8443));
 assert.equal(result.event,"FUN_ENGLISH_LOCAL_SECURITY_AUDIT_V2");
 assert.equal(result.constraints.external_hosts_scanned,0);
});
test("primary security browser client mounts inside existing local chat and asks approval",async()=>{
 const client=await readFile(fileURLToPath(new URL("../src/security/security-chat-client.js",import.meta.url)),"utf8");
 assert.match(client,/getElementById\("chat-input"\)/);
 assert.match(client,/window\.confirm/);
 assert.match(client,/x-fi-security-approval/);
 assert.match(client,/textContent=message/);
 assert.doesNotMatch(client,/innerHTML\s*=/);
});
