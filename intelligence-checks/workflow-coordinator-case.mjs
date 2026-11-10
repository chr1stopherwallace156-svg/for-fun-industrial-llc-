import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,symlinkSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {tmpdir} from "node:os";
import path from "node:path";
import {createWorkflowCoordinator} from "../src/workflows/coordinator.mjs";
const makeRoot=()=>mkdtempSync(path.join(tmpdir(),"fi-workflow-"));
const spec=()=>({goal:"Summarize measured inventory data and review the results.",
 steps:[{id:"numbers",kind:"stats",values:[4,10,6]},
  {id:"narrative",kind:"model_summary",from:"numbers",max_tokens:64},
  {id:"approval",kind:"review"}],
 output_token_budget:96});
test("deterministic steps and crash-safe checkpoints can resume in a new instance",async()=>{
 const root=makeRoot();let modelCalls=0;
 try{
  const model=async ({message,max_tokens})=>{
   modelCalls++;
   assert.match(message,/BEGIN UNTRUSTED STEP DATA/);
   assert.match(message,/"mean":/);
   assert.equal(max_tokens,64);
   return {reply:"The values average 6.67 and total 20.",tool_calls:[],
    usage:{prompt_tokens:89,completion_tokens:17,total_tokens:106,prompt_tokens_details:{cached_tokens:21}}};
  };
  const a=createWorkflowCoordinator({root,localModel:model});
  const created=await a.create(spec());
  assert.equal(created.status,"ready");assert.equal(created.cursor,0);assert.equal(modelCalls,0);
  const first=await a.advance(created.id);
  assert.equal(first.cursor,1);assert.equal(first.results.numbers.output.sum,20);
  assert.equal(first.results.numbers.output.median,6);assert.equal(modelCalls,0);
  const b=createWorkflowCoordinator({root,localModel:model});
  const second=await b.advance(created.id);
  assert.equal(second.cursor,2);assert.equal(second.results.narrative.output.usage.cached_tokens,21);
  assert.equal(second.used_completion_tokens,17);assert.equal(second.measured_prompt_tokens,89);
  assert.equal(modelCalls,1);
  const review=await b.advance(created.id);
  assert.equal(review.status,"awaiting_review");assert.equal(review.cursor,2);
  await assert.rejects(()=>b.advance(created.id),/WORKFLOW_OPERATOR_INTERVENTION_REQUIRED/);
  const finished=await b.review(created.id,"approve");
  assert.equal(finished.status,"complete");
  assert.equal(finished.external_actions_executed,0);assert.equal(finished.rea_tools_executed,0);
  assert.equal((await a.get(created.id)).status,"complete");
  assert.equal((await b.advance(created.id)).status,"complete");
  assert.equal(modelCalls,1);
  const disk=JSON.parse(readFileSync(path.join(root,created.id+".json"),"utf8"));
  assert.equal(disk.schema,"fun.workflow.checkpoint.v1");
 }finally{rmSync(root,{force:true,recursive:true});}
});
test("model failure requires a deliberate operator retry; no automatic repeat",async()=>{
 const root=makeRoot();let calls=0;
 try{
  const wf=createWorkflowCoordinator({root,localModel:async()=>{
   calls++;
   if(calls===1)throw Error("transient local model error");
   return {reply:"Calculated result",tool_calls:[],usage:{completion_tokens:8,prompt_tokens:30}};
  }});
  const init=await wf.create(spec());
  await wf.advance(init.id);
  const held=await wf.advance(init.id);
  assert.equal(held.status,"hold");assert.equal(calls,1);
  assert.equal(held.hold_reason,"transient local model error");
  await assert.rejects(()=>wf.advance(init.id),/INTERVENTION_REQUIRED/);
  const retried=await wf.retry(init.id);
  assert.equal(retried.status,"ready");assert.equal(retried.retry_count,1);
  const done=await wf.advance(init.id);
  assert.equal(done.status,"ready");assert.equal(done.cursor,2);assert.equal(calls,2);
  await assert.rejects(()=>wf.retry(init.id),/RETRY_NOT_REQUIRED/);
 }finally{rmSync(root,{force:true,recursive:true});}
});
test("missing or oversized model usage is rejected rather than bypassing token budget",async()=>{
 for(const usage of [{},{completion_tokens:120,prompt_tokens:20}]){
  const root=makeRoot();
  try{
   const wf=createWorkflowCoordinator({root,localModel:async()=>({reply:"No proof of token budget",tool_calls:[],usage})});
   const init=await wf.create(spec());await wf.advance(init.id);
   const held=await wf.advance(init.id);
   assert.equal(held.status,"hold");assert.equal(held.hold_reason,"WORKFLOW_MODEL_USAGE_UNVERIFIED");
   assert.equal(held.cursor,1);assert.equal(held.used_completion_tokens,0);
  }finally{rmSync(root,{force:true,recursive:true});}
 }
});
test("all steps are operator initiated, and rejection stops further steps",async()=>{
 const root=makeRoot();let modelCalls=0;
 try{
  const wf=createWorkflowCoordinator({root,localModel:async()=>{modelCalls++;throw Error("unexpected model call");}});
  const init=await wf.create({goal:"Review stats",steps:[{id:"first",kind:"stats",values:[1,3]},{id:"approve",kind:"review"},{id:"second",kind:"stats",values:[6]}]});
  assert.equal((await wf.get(init.id)).cursor,0);
  const first=await wf.advance(init.id);assert.equal(first.cursor,1);
  const pending=await wf.advance(init.id);assert.equal(pending.status,"awaiting_review");
  const rejected=await wf.review(init.id,"reject");
  assert.equal(rejected.status,"rejected");
  assert.equal((await wf.advance(init.id)).status,"rejected");
  assert.ok(!rejected.results.second);assert.equal(modelCalls,0);
 }finally{rmSync(root,{force:true,recursive:true});}
});
test("reject invalid, excessive, or authority-creating workflow specifications",async()=>{
 const root=makeRoot();
 try{
  const wf=createWorkflowCoordinator({root,localModel:async()=>{throw Error("never");}});
  const valid=spec();
  for(const bad of [
   {...valid,steps:[{id:"shell",kind:"shell",command:"cmd.exe"}]},
   {...valid,steps:[{id:"rea",kind:"rea_tool",name:"rea__unsafe"}]},
   {...valid,steps:[{id:"stats",kind:"stats",values:[NaN]}]},
   {...valid,steps:[{id:"first",kind:"model_summary",from:"future"}]},
   {...valid,steps:[{id:"x",kind:"stats",values:[1],command:"execute"}]},
   {...valid,steps:Array.from({length:17},(_,i)=>({id:"s"+i,kind:"stats",values:[1]}))},
   {...valid,output_token_budget:1000000},
  ])await assert.rejects(()=>wf.create(bad),/WORKFLOW_/);
  await assert.rejects(()=>wf.get("../bad"),/WORKFLOW_ID_INVALID/);
  const v=await wf.create(valid);
  await assert.rejects(()=>wf.review(v.id,"approve"),/WORKFLOW_REVIEW_NOT_PENDING/);
  await assert.rejects(()=>wf.review(v.id,"execute"),/WORKFLOW_REVIEW_DECISION_INVALID/);
 }finally{rmSync(root,{force:true,recursive:true});}
});
test("refuse symlink-backed storage and duplicate operation locks",async()=>{
 const top=makeRoot();
 try{
  const actual=path.join(top,"real"),alias=path.join(top,"link");
  mkdirSync(actual);symlinkSync(actual,alias,process.platform==="win32"?"junction":"dir");
  const wf=createWorkflowCoordinator({root:alias,localModel:async()=>({})});
  await assert.rejects(()=>wf.create({goal:"Data",steps:[{id:"s",kind:"stats",values:[1]}]}),/WORKFLOW_STORAGE_PATH_UNSAFE/);
  const trusted=createWorkflowCoordinator({root:actual});
  const init=await trusted.create({goal:"Data",steps:[{id:"s",kind:"stats",values:[1]}]});
  writeFileSync(path.join(actual,init.id+".lock"),"simulated competing writer");
  await assert.rejects(()=>trusted.advance(init.id),/WORKFLOW_ALREADY_LOCKED/);
 }finally{rmSync(top,{force:true,recursive:true});}
});

test("CLI creates, advances, reloads and reviews a saved workflow across processes",()=>{
 const parent=makeRoot();
 try{
  const cli=fileURLToPath(new URL("../src/workflows/cli.mjs",import.meta.url));
  const specFile=path.join(parent,"spec.json");
  writeFileSync(specFile,JSON.stringify({goal:"Demo stats",steps:[
   {id:"s",kind:"stats",values:[4,6]},
   {id:"review",kind:"review"}]}));
  const env={...process.env,LOCALAPPDATA:parent};
  const run=(...args)=>{
   const res=spawnSync(process.execPath,[cli,...args],{encoding:"utf8",env,timeout:15000});
   assert.equal(res.status,0,res.stderr);
   return JSON.parse(res.stdout);
  };
  const created=run("create",specFile);
  assert.equal(created.event,"FUN_WORKFLOW_CLI_RESULT");
  assert.equal(created.state,"ready");
  const step=run("step",created.id);
  assert.equal(step.results.s.output.mean,5);
  const status=run("status",created.id);
  assert.equal(status.cursor,1);
  assert.equal(run("step",created.id).state,"awaiting_review");
  assert.equal(run("review",created.id,"approve").state,"complete");
  const error=spawnSync(process.execPath,[cli,"review",created.id,"execute"],{encoding:"utf8",env,timeout:15000});
  assert.equal(error.status,1);
  assert.match(error.stderr,/WORKFLOW_REVIEW_DECISION_INVALID/);
 }finally{rmSync(parent,{force:true,recursive:true});}
});
test("Windows installer and pilot never start or stop processes and keep REA permissions unchanged",()=>{
 const installer=readFileSync(new URL("../Install-Fun-Workflow-Coordinator.ps1",import.meta.url),"utf8");
 const pilot=readFileSync(new URL("../Run-Fun-Workflow-Pilot.ps1",import.meta.url),"utf8");
 for(const marker of ["FUN_WORKFLOW_COORDINATOR_INSTALL=PASS","SOURCE_SYNTAX_","PROTECTED_SERVICE_CHANGED_","TARGET_ALREADY_EXISTS_REQUIRES_REVIEW","FUN_WORKFLOW_INSTALL_FAILED="])
  assert.ok(installer.includes(marker),marker);
 for(const marker of ["FUN_WORKFLOW_PILOT=PASS","MODEL_CALLS=0","DEMO ONLY"])
  assert.ok(pilot.includes(marker),marker);
 assert.doesNotMatch(installer+"\n"+pilot,/Stop-Process|Start-Process|Set-NetFirewallRule|Register-ScheduledTask|rea__|ollama\s+(?:stop|run)|api\/rea\/call/i);
});

test("stale lock recovery requires an explicit operator call and refuses live owners",async()=>{
 const root=makeRoot();
 try{
  const w=createWorkflowCoordinator({root});
  const a=await w.create({goal:"Synthetic data",steps:[{id:"stats",kind:"stats",values:[2,4]}]});
  const lock=path.join(root,a.id+".lock");
  const lockData=pid=>({schema:"fun.workflow.lock.v1",id:a.id,pid,created_at:Date.now(),nonce:randomUUID()});
  writeFileSync(lock,JSON.stringify(lockData(process.pid)));
  await assert.rejects(()=>w.recoverLock(a.id),/WORKFLOW_LOCK_OWNER_STILL_RUNNING/);
  await assert.rejects(()=>w.advance(a.id),/WORKFLOW_ALREADY_LOCKED/);
  writeFileSync(lock,JSON.stringify(lockData(99999999)));
  const recovered=await w.recoverLock(a.id);
  assert.equal(recovered.status,"ready");
  assert.equal((await w.advance(a.id)).status,"complete");
 }finally{rmSync(root,{force:true,recursive:true});}
});
