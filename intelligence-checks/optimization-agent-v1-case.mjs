import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,readdirSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {createOptimizationAgent} from "../src/optimization/agent.mjs";
import {patchOptimizationAgentServer,patchOptimizationAgentUi} from "../scripts/patch-optimization-agent.mjs";
const f=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
function runner(){
 const calls=[];
 return {calls,status(){return {state:"ready"}},
  async run(action,problem){
   calls.push({action,problem});
   return {schema:"fun.optimization.result.v1",action,decision_support_only:true,
    rea_tools_executed:0,external_actions_executed:0,result:{solution_found:true}};
  }
 };
}
const fixture=[
 'import {createOptimizationRunner} from "./optimization/runner.mjs";',
 'const fiOptimization=createOptimizationRunner();',
 'const FI_AUTO_COGNEE_CHAT_V1=true;',
 'const FI_SOURCING_RETIRED_V1=true;',
 'const FI_VOICE_MOBILE_DASHBOARD_V1=true;',
 'const FI_OPTIMIZATION_PHASE23_V1=true;',
 'const csp="script-src \'self\' \'nonce-abc\'; frame-ancestors \'none\';";',
 'const server=http.createServer(async(req,res)=>{try{',
 'if(req.url==="/api/rea/call")return json(res,403,{error:"disabled"});'
].join("\n");
const sample={budget:10,labor_capacity:5,projects:[{id:"job",cost:3,labor:2,value:7,max_units:2}]};
test("phase4 patch keeps existing server, no REA execution and refuses duplicates",()=>{
 const patched=patchOptimizationAgentServer(fixture);
 assert.match(patched,/FI_OPTIMIZATION_AGENT_V1/);
 assert.match(patched,/createOptimizationAgent/);
 assert.match(patched,/OPT_AGENT_OPERATOR_REVIEW_REQUIRED/);
 assert.match(patched,/\/api\/optimization\/agent\/analyze/);
 assert.match(patched,/\/api\/rea\/call/);
 assert.match(patched,/frame-ancestors/);
 assert.throws(()=>patchOptimizationAgentServer(patched),/ALREADY_PATCHED/);
 assert.throws(()=>patchOptimizationAgentServer(fixture.replace("FI_AUTO_COGNEE_CHAT_V1","none")),/BASELINE_MISSING/);
});
test("phase4 patch keeps CSP safe",()=>{
 assert.throws(()=>patchOptimizationAgentServer(fixture.replace("script-src \'self\'","script-src \'nonce-only\'")),/CSP/);
});
test("agent UI is additive without deleting voice/chat or existing optimizer",()=>{
 const ui='<html><body><div>FI_VOICE_MOBILE_PANEL_V1</div><div>FI_OPTIMIZATION_PHASE23_PANEL_V1</div><div id="existing-chat"></div></body></html>';
 const panel=f("src/optimization/agent-panel.html");
 const result=patchOptimizationAgentUi(ui,panel);
 assert.ok(result.includes('id="existing-chat"'));
 assert.ok(result.includes("FI_OPTIMIZATION_AGENT_PANEL_V1"));
 assert.throws(()=>patchOptimizationAgentUi(result,panel),/ALREADY_PATCHED/);
});
test("unknown or missing numbers fail closed without invoking optimizer",async()=>{
 const r=runner(),agent=createOptimizationAgent({runner:r});
 assert.equal((await agent.analyze({request:"Find improvements"})).state,"needs_input");
 assert.equal((await agent.analyze({request:"Optimize my routes"})).state,"needs_input");
 assert.equal((await agent.analyze({request:"Optimize budget",problem:{budget:20}})).state,"needs_input");
 assert.equal(r.calls.length,0);
 await assert.rejects(agent.analyze({request:"x".repeat(2500),problem:sample}),/REQUEST_INVALID/);
 await assert.rejects(agent.analyze({request:"budget",problem:{projects:[],blob:"x".repeat(33000),budget:5,labor_capacity:6}}),/TOO_LARGE/);
});
test("local solver actually executes with automatic selection and proposes separate approval",async()=>{
 const r=runner(),agent=createOptimizationAgent({runner:r});
 const d=await agent.analyze({request:"Select the most valuable projects",problem:sample});
 assert.equal(d.state,"computed");assert.equal(d.engine,"google-or-tools");
 assert.equal(d.local_optimizer_executed,undefined);
 assert.equal(d.execution_plan.local_optimizer_executed,true);
 assert.equal(d.execution_plan.external_actions_executed,0);
 assert.equal(d.execution_plan.rea_tools_executed,0);
 assert.equal(r.calls.length,1);assert.equal(r.calls[0].action,"allocation");
 assert.ok(d.execution_plan.next_steps.some(x=>x.id==="apply-business-changes"&&x.automatically_executable===false));
});
test("only one bounded local save operation can be approved once",async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),"fi-opt-agent-"));
 const old=process.env.LOCALAPPDATA;process.env.LOCALAPPDATA=dir;
 try{
  const agent=createOptimizationAgent({runner:runner(),saveDirectory:path.join(dir,"FunIndustrial","OptimizationRuntime","approved-plans")});
  const d=await agent.analyze({request:"Allocate projects",problem:sample});
  await assert.rejects(agent.approve({ticket:d.approval_ticket,action:"buy-materials"}),/NOT_ALLOWLISTED/);
  await assert.rejects(agent.approve({ticket:"bad",action:"save-report"}),/INVALID/);
  const approved=await agent.approve({ticket:d.approval_ticket,action:"save-report"});
  assert.equal(approved.state,"saved");assert.equal(approved.rea_tools_executed,0);
  assert.equal(readdirSync(path.dirname(approved.file)).length,1);
  const report=JSON.parse(readFileSync(approved.file,"utf8"));
  assert.equal(report.execution_plan.action,"allocation");
  await assert.rejects(agent.approve({ticket:d.approval_ticket,action:"save-report"}),/INVALID/);
 }finally{if(old===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=old;rmSync(dir,{recursive:true,force:true});}
});
test("expired ticket fails closed and export outside Fun Industrial is blocked",async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),"fi-opt-agent-reject-"));const old=process.env.LOCALAPPDATA;process.env.LOCALAPPDATA=dir;
 try{
  let tick=100000;
  const agent=createOptimizationAgent({runner:runner(),now:()=>tick});
  const d=await agent.analyze({request:"Budget",problem:sample});tick+=300001;
  await assert.rejects(agent.approve({ticket:d.approval_ticket,action:"save-report"}),/EXPIRED/);
  const agent2=createOptimizationAgent({runner:runner(),saveDirectory:path.join(tmpdir(),"out-of-bounds")});
  const d2=await agent2.analyze({request:"Budget",problem:sample});
  await assert.rejects(agent2.approve({ticket:d2.approval_ticket,action:"save-report"}),/LOCATION_NOT_ALLOWED/);
 }finally{if(old===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=old;rmSync(dir,{recursive:true,force:true});}
});
test("UI does not grant model/REA shell or external business execution",()=>{
 const client=f("src/optimization/agent-client.js");
 assert.match(client,/window\.confirm/);
 assert.match(client,/x-fi-optimization-approval/);
 assert.doesNotMatch(client,/innerHTML\s*=/);
 assert.doesNotMatch(client,/\/api\/rea\/call/);
 assert.doesNotMatch(client,/\/api\/ai\/tool-call/);
 const module=f("src/optimization/agent.mjs");
 assert.doesNotMatch(module,/child_process|fetch\(|http\.request|\/api\/rea\/call/);
});
