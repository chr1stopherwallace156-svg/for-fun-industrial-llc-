// FI_WORKFLOW_OPTIMIZATION_TEST_V1 — bounded, offline, checkpointed solver qualification.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {createWorkflowCoordinator} from "../src/workflows/coordinator.mjs";
import {validateOptimizationStep,compactOptimizationEvidence} from "../src/workflows/optimization-step.mjs";
const root=()=>mkdtempSync(path.join(tmpdir(),"fi-workflow-opt-"));
const inventory={demand_samples:[3,4,5,4,6],min_stock:0,max_stock:9,holding_cost:1,shortage_cost:3,trials:8};
const allocation={budget:20,labor_capacity:15,projects:[{id:"inspect",cost:4,labor:2,value:8,max_units:3}]};
const route={depot:0,cost_matrix:[[0,4,7],[4,0,3],[7,3,0]]};
const result=(action)=>({
 schema:"fun.optimization.result.v1",action,decision_support_only:true,
 external_actions_executed:0,rea_tools_executed:0,
 result:action==="inventory"?
   {engine:"optuna-tpe",best_stock_level:5,estimated_average_cost:2.4,
    baseline_min_stock_cost:13.2,trials_completed:8,best_is_globally_proven:false,
    operator_action_taken:false}:
   action==="allocation"?
   {engine:"google-or-tools-cp-sat",state:"OPTIMAL",solution_found:true,optimality_proven:true,
    budget_used:12,budget_limit:20,labor_used:6,labor_capacity:15,total_value:24,
    allocation:[{id:"inspect",units:3}],operator_action_taken:false}:
   {engine:"google-or-tools-routing",solution_found:true,optimality_proven:false,
    route:[0,1,2,0],total_cost:14,cost_units:"user_supplied_matrix_units",operator_action_taken:false}
});
test("strict solver action and schema validation, no commands or side effects",()=>{
 for(const [action,problem] of [["inventory",inventory],["allocation",allocation],["route",route]]){
  const o=validateOptimizationStep({id:"solve",kind:"optimization",action,problem});
  assert.deepEqual(o.problem,problem);
  assert.notStrictEqual(o.problem,problem);
  assert.equal(o.action,action);
 }
 for(const spec of [
  {id:"x",kind:"optimization",action:"shell",problem:route},
  {id:"x",kind:"optimization",action:"route",problem:{...route,command:"execute"}},
  {id:"x",kind:"optimization",action:"route",problem:{...route,depot:-1}},
  {id:"x",kind:"optimization",action:"allocation",problem:{...allocation,projects:[{...allocation.projects[0],value:NaN}]}},
  {id:"x",kind:"optimization",action:"inventory",problem:{...inventory,trials:1024}},
  {id:"x",kind:"optimization",action:"inventory",problem:{...inventory,rea_tools:["run"]}},
 ])assert.throws(()=>validateOptimizationStep(spec),/WORKFLOW_OPTIMIZATION_/);
});
test("all offline solvers store bounded results without consuming model tokens",async()=>{
 for(const [action,problem] of [["inventory",inventory],["allocation",allocation],["route",route]]){
  const folder=root();let calls=0;
  try{
   const runner={status:()=>({state:"ready"}),run:async(a,p)=>{calls++;assert.equal(a,action);assert.deepEqual(p,problem);return result(action)}};
   const wf=createWorkflowCoordinator({root:folder,optimizationRunner:runner,
    localModel:async()=>{throw Error("model must not run")}});
   const spec={goal:"Review offline "+action+" result",steps:[
    {id:"solve",kind:"optimization",action,problem},
    {id:"approve",kind:"review"}],output_token_budget:128};
   const a=await wf.create(spec);
   assert.equal(a.status,"ready");assert.equal(calls,0);
   const b=await wf.advance(a.id);
   assert.equal(b.cursor,1);assert.equal(b.used_completion_tokens,0);
   assert.equal(b.measured_prompt_tokens,0);assert.equal(calls,1);
   assert.equal(b.results.solve.kind,"optimization");
   assert.equal(b.results.solve.output.result.engine,result(action).result.engine);
   assert.equal(b.external_actions_executed,0);assert.equal(b.rea_tools_executed,0);
   const q=await wf.get(a.id);assert.equal(q.cursor,1);
   const disk=JSON.parse(readFileSync(path.join(folder,a.id+".json"),"utf8"));
   assert.equal(disk.results.solve.output.action,action);
   const next=await wf.advance(a.id);assert.equal(next.status,"awaiting_review");
   assert.equal(next.cursor,1);assert.equal(next.used_completion_tokens,0);
   assert.equal((await wf.advance(a.id).catch(e=>e.message)).includes("INTERVENTION_REQUIRED"),true);
  }finally{rmSync(folder,{recursive:true,force:true});}
 }
});
test("model summary only sees bounded solver evidence and no full optimization history",async()=>{
 const folder=root();const longArray=Array.from({length:30},(_,i)=>({id:"project_"+i,units:i%2}));
 try{
  let seen=null;
  const raw=result("allocation");raw.result.allocation=longArray;
  const wf=createWorkflowCoordinator({root:folder,optimizationRunner:{
   status:()=>({state:"ready"}),run:async()=>raw},
   localModel:async({message,max_tokens})=>{
    seen=message;assert.equal(max_tokens,64);
    assert.match(message,/offline_optimization/);
    assert.match(message,/allocations_count/);
    assert.match(message,/allocations_sample/);
    assert.ok(!message.includes("project_20"));
    assert.ok(!message.includes("max_units"));
    return {reply:"Solver produced a bounded allocation proposal; review before use.",
     tool_calls:[],usage:{prompt_tokens:155,completion_tokens:18,total_tokens:173}};
   }});
  const first=await wf.create({goal:"Summarize allocation",steps:[
   {id:"solve",kind:"optimization",action:"allocation",problem:allocation},
   {id:"summary",kind:"model_summary",from:"solve",max_tokens:64},
   {id:"review",kind:"review"}],output_token_budget:96});
  await wf.advance(first.id);
  const result2=await wf.advance(first.id);
  assert.ok(seen);
  assert.equal(result2.cursor,2);
  assert.equal(result2.used_completion_tokens,18);
  assert.equal(result2.measured_prompt_tokens,155);
  assert.equal(result2.results.solve.output.result.allocation.length,30);
  assert.equal(result2.external_actions_executed,0);
 }finally{rmSync(folder,{force:true,recursive:true});}
});
test("failed solver causes durable HOLD and operator-only retry, preserving prior checkpoints",async()=>{
 const folder=root();let calls=0;
 try{
  const wf=createWorkflowCoordinator({root:folder,optimizationRunner:{
   status:()=>({state:"ready"}),run:async()=>{
    calls++;if(calls===1)throw Error("OPTIMIZATION_SOLVER_HOLD");return result("inventory");
   }});
  const a=await wf.create({goal:"Try optimization",steps:[
   {id:"solve",kind:"optimization",action:"inventory",problem:inventory}],output_token_budget:96});
  const b=await wf.advance(a.id);
  assert.equal(b.status,"hold");assert.equal(b.cursor,0);
  assert.equal(calls,1);
  assert.equal((await wf.get(a.id)).status,"hold");
  await assert.rejects(()=>wf.advance(a.id),/INTERVENTION_REQUIRED/);
  await wf.retry(a.id);
  const done=await wf.advance(a.id);
  assert.equal(done.status,"complete");assert.equal(calls,2);
  assert.equal(done.rea_tools_executed,0);assert.equal(done.used_completion_tokens,0);
 }finally{rmSync(folder,{force:true,recursive:true});}
});
test("untrusted or too-large solver result is denied before recording completion",async()=>{
 for(const change of [
  x=>({...x,rea_tools_executed:1}),x=>({...x,external_actions_executed:1}),
  x=>({...x,result:{...x.result,operator_action_taken:true}}),
  x=>({...x,result:{...x.result,engine:"other"}}),
  x=>({...x,result:{...x.result,payload:"x".repeat(11000)}})
 ]){
  const folder=root();
  try{
   const wf=createWorkflowCoordinator({root:folder,optimizationRunner:{
    status:()=>({state:"ready"}),run:async()=>change(result("inventory"))}});
   const a=await wf.create({goal:"Validate",steps:[{id:"s",kind:"optimization",action:"inventory",problem:inventory}]});
   const b=await wf.advance(a.id);
   assert.equal(b.status,"hold");
   assert.equal(b.cursor,0);
   assert.equal(b.results.s,undefined);
   assert.equal(b.external_actions_executed,0);
  }finally{rmSync(folder,{force:true,recursive:true});}
 }
});
test("compact optimization evidence excludes full allocation and remains bounded",()=>{
 const a=result("allocation");a.result.allocation=Array.from({length:30},(_,i)=>({id:"q"+i,units:i}));
 const compact=compactOptimizationEvidence({action:"allocation",engine:a.result.engine,
  result:a.result,decision_support_only:true});
 assert.equal(compact.result.allocations_count,30);
 assert.equal(compact.result.allocations_sample.length,6);
 assert.ok(JSON.stringify(compact).length<1500);
 assert.equal(JSON.stringify(compact).includes('"q29"'),false);
});
