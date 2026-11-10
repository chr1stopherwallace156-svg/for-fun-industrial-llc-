// FI_WORKFLOW_PHASE22_TEST_V1 — no live model, Python, REA, or service mutation.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {validatePhase22Request,phase22Prompt,phase22Proposal,
 verifyPhase22Proposal,phase22WorkflowSpec} from "../src/workflows/phase22.mjs";
import {createWorkflowCoordinator} from "../src/workflows/coordinator.mjs";
const base={goal:"Choose a constrained inventory or routing problem for local analysis",candidates:[
 {action:"inventory",problem:{demand_samples:[3,4,5,6],min_stock:0,max_stock:9,holding_cost:1,shortage_cost:3,trials:8}},
 {action:"route",problem:{depot:0,cost_matrix:[[0,2,4],[2,0,3],[4,3,0]]}}
]};
const response=(index=0,reason="This uses the supplied local data.")=>({
 reply:JSON.stringify({candidate_index:index,reason}),tool_calls:[],
 usage:{prompt_tokens:100,completion_tokens:19,total_tokens:119}});
const clone=x=>JSON.parse(JSON.stringify(x));
test("Phase 2.2 validation copies candidate numbers and refuses injected fields",()=>{
 const copy=validatePhase22Request(base);
 assert.notStrictEqual(copy.candidates[0].problem,base.candidates[0].problem);
 base.candidates[0].problem.demand_samples[0]=3; // no mutation of validated copy
 assert.equal(copy.candidates[0].problem.demand_samples[0],3);
 for(const bad of [
  {...clone(base),candidates:[]},
  {...clone(base),unknown:"run"},
  {...clone(base),candidates:[{action:"shell",problem:{command:"run"}}]},
  {...clone(base),candidates:[{action:"inventory",problem:{...clone(base.candidates[0].problem),trials:999}}]},
  {...clone(base),candidates:[{...clone(base.candidates[0]),extra:"rea_tool_call"}]},
  {...clone(base),goal:" "},
  {...clone(base),candidates:Array.from({length:4},()=>base.candidates[0])}
 ])assert.throws(()=>validatePhase22Request(bad),/HOLD|OPTIMIZATION_SPEC/);
});
test("Phase 2.2 prompt gives no tool definitions, execution authority, or invented data",()=>{
 const p=phase22Prompt(base);
 assert.match(p,/Choose one of the candidate/);
 assert.match(p,/No|never|Never/);
 assert.ok(!p.includes("rea__"));
 assert.ok(!p.includes("exec("));
 assert.ok(p.includes('"demand_samples":[3,4,5,6]'));
});
test("strict Qwen output rejects hallucinated parameters and tool calls",()=>{
 const invalid=[
  {...response(),reply:"Sure, executing now."},
  {...response(),reply:JSON.stringify({candidate_index:0,reason:"fine",run:true})},
  {...response(),reply:JSON.stringify({candidate_index:9,reason:"bad index"})},
  {...response(),reply:JSON.stringify({candidate_index:0,reason:"ok"})},
  {...response(),reply:JSON.stringify({candidate_index:"0",reason:"Selected"})},
  {...response(),tool_calls:[{name:"rea__run"}]},
  {...response(),usage:{}},
  {...response(),usage:{prompt_tokens:5,completion_tokens:300}}
 ];
 for(const r of invalid)assert.throws(()=>phase22Proposal(base,r),/PHASE22_HOLD/);
});
test("proposal hash binds goal, all candidate inputs, selection, and reason",()=>{
 const p=phase22Proposal(base,response(1),{
  id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  timestamp:"2026-11-10T10:00:00.000Z"});
 const v=verifyPhase22Proposal(p);
 assert.equal(v.selected.action,"route");
 assert.equal(v.selected.problem.cost_matrix[0][1],2);
 for(const change of [
  x=>{x.goal="different";},
  x=>{x.selected_index=0;},
  x=>{x.candidates[1].problem.cost_matrix[0][1]=999;},
  x=>{x.reason="fake";},
  x=>{x.sha256="a".repeat(64);},
  x=>{x.extra=true;}
 ]){
  const tampered=clone(p);change(tampered);
  assert.throws(()=>verifyPhase22Proposal(tampered),/PHASE22_HOLD/);
 }
});
test("approved proposal yields bounded solver and review; never REA execution",async()=>{
 const folder=mkdtempSync(join(tmpdir(),"fi-phase22-"));
 try{
  const verified=verifyPhase22Proposal(phase22Proposal(base,response(0)));
  const spec=phase22WorkflowSpec(verified);
  assert.equal(spec.steps.length,2);
  assert.equal(spec.steps[0].kind,"optimization");
  assert.equal(spec.steps[1].kind,"review");
  let runs=0;
  const workflow=createWorkflowCoordinator({root:folder,localModel:async()=>{throw Error("unexpected Qwen call");},
   optimizationRunner:{status:()=>({state:"ready"}),run:async(action,problem)=>{
    runs++;assert.equal(action,"inventory");assert.deepEqual(problem,base.candidates[0].problem);
    return {schema:"fun.optimization.result.v1",action,decision_support_only:true,
     external_actions_executed:0,rea_tools_executed:0,result:{
      engine:"optuna-tpe",best_stock_level:5,estimated_average_cost:1.8,
      baseline_min_stock_cost:5.4,trials_completed:8,best_is_globally_proven:false,
      operator_action_taken:false}};
   }}});
  const made=await workflow.create(spec);
  assert.equal(runs,0);
  const completed=await workflow.advance(made.id);
  assert.equal(completed.status,"ready");
  assert.equal(completed.cursor,1);
  assert.equal(completed.used_completion_tokens,0);
  assert.equal(completed.rea_tools_executed,0);
  assert.equal(runs,1);
  const waiting=await workflow.advance(made.id);
  assert.equal(waiting.status,"awaiting_review");
  assert.equal(runs,1);
  const rejected=await workflow.review(made.id,"reject");
  assert.equal(rejected.status,"rejected");
  assert.equal(rejected.results.review.output.no_external_action,true);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
test("separate CLI must require explicit proposal ID and SHA to run",()=>{
 const cli=readFileSync(new URL("../src/workflows/phase22-cli.mjs",import.meta.url),"utf8");
 for(const s of ["run\"&&args.length===2","PHASE22_OPERATOR_HASH_MISMATCH",
  'open(claimFile,"wx"','solver-phase22.lock',"getProposal(id)",
  "operator_review:","executed_tools:0","solver_runs:0"])
  assert.ok(cli.includes(s),s);
 assert.doesNotMatch(cli,/Start-Process|Stop-Process|Restart-Service|api\/rea\/call|ollama\s+stop/i);
});
