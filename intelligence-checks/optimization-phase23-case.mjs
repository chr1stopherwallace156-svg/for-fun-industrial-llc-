import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {createOptimizationRunner} from "../src/optimization/runner.mjs";
import {patchOptimizationServer,patchOptimizationUi} from "../scripts/patch-optimization-dashboard.mjs";

const repo=new URL("../",import.meta.url);
const source=file=>readFileSync(new URL(file,repo),"utf8");
const fixture=[
  'import path from "node:path";',
  'const root=path.dirname(fileURLToPath(import.meta.url));',
  'const csp="default-src \x27self\x27; script-src \x27self\x27 \x27nonce-abc\x27; frame-ancestors \x27none\x27;";',
  'const FI_AUTO_COGNEE_CHAT_V1=true;',
  'const FI_SOURCING_RETIRED_V1=true;',
  'const FI_VOICE_MOBILE_DASHBOARD_V1=true;',
  'const server=http.createServer(async(req,res)=>{try{',
  ' // Existing REA calls, voice route, memory recall and chat untouched.',
  ' if(req.method==="POST"&&req.url==="/api/rea/call")return json(res,403,{error:"disabled"});',
  ' if(req.method==="POST"&&req.url==="/api/ai/chat")return oldChat(req,res);'
].join("\n");

test("phase 2/3 patch preserves existing customized server and prevents duplicate deployment",()=>{
 const patched=patchOptimizationServer(fixture);
 assert.match(patched,/FI_OPTIMIZATION_PHASE23_V1/);
 assert.match(patched,/createOptimizationRunner/);
 assert.match(patched,/OPTIMIZATION_EXPLICIT_APPROVAL_REQUIRED/);
 assert.match(patched,/req.headers\["x-fi-optimization-approval"\]/);
 assert.match(patched,/readBody\(req,32768\)/);
 assert.match(patched,/\/api\/optimization\/run/);
 assert.match(patched,/\/api\/optimization\/client.js/);
 assert.match(patched,/FI_AUTO_COGNEE_CHAT_V1/);
 assert.match(patched,/FI_VOICE_MOBILE_DASHBOARD_V1/);
 assert.match(patched,/\/api\/rea\/call/);
 assert.match(patched,/frame-ancestors \x27none\x27/);
 assert.throws(()=>patchOptimizationServer(patched),/ALREADY_PATCHED/);
 assert.throws(()=>patchOptimizationServer(fixture.replace("FI_AUTO_COGNEE_CHAT_V1","UNKNOWN")) ,/BASELINE_MISSING/);
});
test("patch refuses to weaken CSP",()=>{
 assert.throws(()=>patchOptimizationServer(fixture.replace("script-src \x27self\x27 \x27nonce-abc\x27;","script-src \x27nonce-abc\x27;")),/CSP/);
});
test("UI patch inserts only new panel at body end, preserving original voice/chat",()=>{
 const ui='<html><body><h1>Custom operator dashboard</h1><div id="old-voice">Existing mic</div><script>const chat="keep";</script></body></html>';
 const panel=source("src/optimization/panel.html");
 const staged=patchOptimizationUi(ui,panel);
 const addition='\n'+panel+'\n<script src="/api/optimization/client.js" defer></script>\n';
 assert.equal(staged.replace(addition,""),ui);
 assert.match(staged,/FI_OPTIMIZATION_PHASE23_PANEL_V1/);
 assert.throws(()=>patchOptimizationUi(staged,panel),/ALREADY_PATCHED/);
 assert.throws(()=>patchOptimizationUi("<html><main>no body</main></html>",panel),/BODY_ANCHOR/);
});
test("AI drafts never automatically execute solvers or REA, operator reviews required",()=>{
 const client=source("src/optimization/client.js");
 assert.match(client,/tools:\[\]/);
 assert.match(client,/review-draft/);
 assert.match(client,/window\.confirm/);
 assert.match(client,/x-fi-optimization-approval/);
 assert.match(client,/askAI\(prompt/);
 assert.match(client,/textContent/);
 assert.doesNotMatch(client,/innerHTML\s*=/);
 const server=source("scripts/patch-optimization-dashboard.mjs");
 assert.doesNotMatch(server,/\/api\/rea\/call.*POST/);
});
test("unconfigured runner fails closed, no listeners, no child spawned",async()=>{
 let called=false;
 const runner=createOptimizationRunner({
  checkout:path.join(tmpdir(),"missing-opt-repo-unused"),
  python:path.join(tmpdir(),"missing-opt-python-unused"),
  spawnProcess:()=>{called=true;throw Error("unexpected spawn");}
 });
 assert.equal(runner.status().state,"not-configured");
 assert.equal(runner.status().reaToolsExecuted,0);
 await assert.rejects(runner.run("allocation",{budget:2}),/RUNTIME_MISSING/);
 await assert.rejects(runner.run("shell",{command:"stop"}),/INPUT_HOLD/);
 assert.equal(called,false);
});
test("runner requires bounded input even with a configured but non-executing test fixture",async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),"fi-opt-runner-"));
 try{
  const checkout=path.join(dir,"code");mkdirSync(path.join(checkout,"fun_optimization"),{recursive:true});
  for(const p of ["__init__.py","bridge.py","core.py"])
   writeFileSync(path.join(checkout,"fun_optimization",p),"# fixture\n");
  const fakePython=path.join(dir,"python.exe");writeFileSync(fakePython,"fixture");
  const runner=createOptimizationRunner({checkout,python:fakePython,
   spawnProcess:()=>{throw Error("fake process invoked");}});
  assert.equal(runner.status().state,"ready");
  await assert.rejects(runner.run("allocation",{huge:"x".repeat(33000)}),/TOO_LARGE/);
  await assert.rejects(runner.run("rea__command",{}),/INPUT_HOLD/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("bridge is bounded and cannot mutate services",()=>{
 const bridge=source("fun_optimization/bridge.py");
 assert.match(bridge,/MAX_BYTES = 32_768/);
 assert.match(bridge,/ACTION[S] =/);
 assert.match(bridge,/external_actions_executed/);
 assert.doesNotMatch(bridge,/subprocess|os\.system|requests\.post|urllib/);
});
