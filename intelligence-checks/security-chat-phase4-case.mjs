import test from "node:test";
import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {Script} from "node:vm";
import {mkdtemp,mkdir,writeFile,rm,readFile,symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {
 auditOwnSource,classifyHttpHeaders,probeLoopbackHttp,runApprovedLocalDefensiveAudit
} from "../src/security/defensive-audit.mjs";
import {openAiToolDefinitions,getPlatformTool} from "../src/platform-tools.mjs";

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),"fi-local-security-test-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 return dir;
}
test("chat audit refuses execution without operator approval",async()=>{
 let contacted=false;
 await assert.rejects(runApprovedLocalDefensiveAudit({
  operatorApproved:false,projectRoot:"ignored",
  scanImpl:async()=>{contacted=true}
 }),/SECURITY_OPERATOR_APPROVAL_REQUIRED/);
 assert.equal(contacted,false);
});
test("chat audit tool has strict empty schema and is registered",()=>{
 const tool=getPlatformTool("fi_security_local_audit");
 assert.equal(tool.localSecurity,true);
 assert.deepEqual(tool.parameters.required,[]);
 assert.deepEqual(tool.parameters.properties,{});
 assert.equal(tool.parameters.additionalProperties,false);
 assert.ok(openAiToolDefinitions().some(x=>x.function.name==="fi_security_local_audit"));
});
test("authorized orchestration is pinned to local host with zero REA/exploit actions",async()=>{
 const calls=[];
 const result=await runApprovedLocalDefensiveAudit({
  operatorApproved:true,projectRoot:"fixture",
  scanImpl:async args=>{
   calls.push({step:"tcp",...args});
   return {host:"127.0.0.1",protocol:"TCP_CONNECT_ONLY",results:[{port:8088,status:"open"},{port:8788,status:"closed"}]};
  },
  httpImpl:async port=>{calls.push({step:"http",port});return {port,state:"HTTP_RESPONDED",http_status:200}},
  sourceImpl:async root=>{calls.push({step:"source",root});return {state:"completed",indicators:[],files_inspected:2}}
 });
 assert.deepEqual(calls,[
  {step:"tcp",target:"127.0.0.1",ports:[8788,8790,8088,8791],authorized:true,timeoutMs:500},
  {step:"http",port:8088},
  {step:"source",root:"fixture"}
 ]);
 assert.equal(result.constraints.rea_tools_executed,0);
 assert.equal(result.constraints.credential_attempts,0);
 assert.equal(result.constraints.exploits_executed,0);
 assert.equal(result.constraints.external_hosts_scanned,0);
});
test("reject arbitrary user ports or unexpectedly public scan result",async()=>{
 for(const ports of [[],[65536],[80,80],Array.from({length:9},(_,i)=>i+1),["8088"]]){
  await assert.rejects(runApprovedLocalDefensiveAudit({operatorApproved:true,projectRoot:"x",ports,
   scanImpl:async()=>{throw Error("UNREACHABLE")}}),/SECURITY_PORT_LIST_INVALID/);
 }
 await assert.rejects(runApprovedLocalDefensiveAudit({operatorApproved:true,projectRoot:"x",
  scanImpl:async()=>({host:"8.8.8.8",protocol:"TCP_CONNECT_ONLY",results:[]})
 }),/SECURITY_TCP_RESULT_INVALID/);
});
test("source findings contain file/line only and exclude environment and dependencies",async t=>{
 const dir=await fixture(t);
 await writeFile(join(dir,"safe.mjs"),"export const a=1;\n");
 await writeFile(join(dir,"risky.py"),"def sample():\n    os.system('example')\n");
 await writeFile(join(dir,".env"),"API_KEY=secret-must-never-appear");
 await mkdir(join(dir,"node_modules"));
 await writeFile(join(dir,"node_modules","hidden.js"),"eval('secret')");
 const result=await auditOwnSource(dir);
 assert.equal(result.state,"completed");
 assert.equal(result.files_inspected,2);
 assert.ok(result.indicators.some(x=>x.rule==="SHELL_OR_PROCESS_EXECUTION"&&x.file==="risky.py"&&x.line===2));
 assert.ok(!JSON.stringify(result).includes("secret"));
 assert.ok(!JSON.stringify(result).includes("example"));
});
test("source scanner refuses symlinks",async t=>{
 const dir=await fixture(t),outside=join(dir,"outside.txt");
 await writeFile(outside,"private");
 try{await symlink(outside,join(dir,"link.py"));}catch(e){
  if(["EPERM","EACCES","ENOTSUP"].includes(e.code))return t.skip("Symlink unavailable");
  throw e;
 }
 await assert.rejects(auditOwnSource(dir),/SECURITY_SOURCE_SYMLINK_HOLD/);
});
test("header observations are advisory, not malware labels",()=>{
 assert.deepEqual(classifyHttpHeaders({statusCode:200,headers:{"content-type":"text/html"}}).advisory,["MISSING_NOSNIFF_HEADER","MISSING_CSP_HEADER"]);
 assert.deepEqual(classifyHttpHeaders({statusCode:200,headers:{"content-type":"application/json"}}).advisory,[]);
});
test("HTTP probe is loopback-only, HEAD-only, with no redirects followed",async()=>{
 let called;
 const fakeRequest=(opts,handler)=>{
  called=opts;
  const req=new EventEmitter();
  req.destroy=()=>{};
  req.end=()=>handler({statusCode:200,headers:{"content-type":"text/html","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'"},resume(){}});
  return req;
 };
 const r=await probeLoopbackHttp(8088,{probeImpl:fakeRequest});
 assert.equal(called.host,"127.0.0.1");
 assert.equal(called.method,"HEAD");
 assert.equal(called.path,"/health");
 assert.equal(called.port,8088);
 assert.equal(called.agent,false);
 assert.equal(r.state,"HTTP_RESPONDED");
 assert.deepEqual(r.advisory,[]);
});
test("unsupported HTTP ports are not connected",async()=>{
 let called=0;
 const r=await probeLoopbackHttp(80,{probeImpl:()=>{called++;throw Error("FAIL")}});
 assert.equal(r.state,"NOT_A_CONFIGURED_HTTP_PORT");
 assert.equal(called,0);
});
test("server-side handler rejects model arguments and never routes security through compute",async()=>{
 const file=fileURLToPath(new URL("../src/server.mjs",import.meta.url));
 const server=await readFile(file,"utf8");
 assert.match(server,/if\(body\.name==="fi_security_local_audit"\)/);
 assert.match(server,/Object\.keys\(body\.arguments\)\.length!==0/);
 assert.match(server,/operatorApproved:true,projectRoot:process\.env\.FI_SECURITY_SOURCE_ROOT\|\|config\.cwd/);
 assert.match(server,/if\(body\.name\.startsWith\("rea__"\)\)/);
});

test("existing dashboard chat includes an explicit approval confirmation before local security execution",async()=>{
 const html=await readFile(fileURLToPath(new URL("../public/index.html",import.meta.url)),"utf8");
 assert.match(html,/id="security-scan"/);
 assert.match(html,/confirm\("Authorize a loopback-only TCP\/HTTP inspection/);
 assert.match(html,/api\("\/api\/ai\/tool-call",\{name:"fi_security_local_audit",arguments:\{\}\}\)/);
});

test("browser inline chat script compiles and preview does not install to live runtime",async()=>{
 const html=await readFile(fileURLToPath(new URL("../public/index.html",import.meta.url)),"utf8");
 const body=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(body,"inline browser JavaScript required");
 assert.doesNotThrow(()=>new Script(body[1],{filename:"security-chat-inline.js"}));
 const launcher=await readFile(fileURLToPath(new URL("../Start-Fun-SecurityChat-Preview.ps1",import.meta.url)),"utf8");
 assert.match(launcher,/\$env:PORT='8794'/);
 assert.match(launcher,/\$env:REA_ENABLED='false'/);
 assert.match(launcher,/\$env:AI_AUTOSTART='false'/);
 assert.doesNotMatch(launcher,/Stop-Process|Terminate-Process|Remove-Item|Invoke-WebRequest/);
});
