// FI_CHAT_OPTIMIZATION_TEST_V1 — offline, no REA/model/solver live side effects.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createChatOptimization} from "../src/workflows/chat-optimization.mjs";
import {createChatOptimizationHandler} from "../src/workflows/chat-optimization-http.mjs";
import {patchChatOptimizationServer,patchChatOptimizationUi} from "../scripts/patch-chat-optimization.mjs";
const goal="Optimize inventory using verified synthetic stock demand numbers";
const candidate={action:"inventory",problem:{
 demand_samples:[3,4,5,4,6],min_stock:0,max_stock:9,holding_cost:1,shortage_cost:3,trials:8}};
const model=async({message,max_tokens})=>{
 assert.match(message,/Choose one of the candidate/);
 assert.equal(max_tokens,256);
 return {reply:JSON.stringify({candidate_index:0,reason:"Only the verified inventory candidate meets the stated stock objective."}),
  tool_calls:[],usage:{prompt_tokens:100,completion_tokens:27,total_tokens:127}};
};
const fixtureServer=[
 'const FI_WEB_CHAT_CONSOLIDATION_V1=true;',
 'const FI_OPTIMIZATION_AGENT_V1=true;',
 'const FI_AUTO_COGNEE_CHAT_V1=true;',
 'const FI_VOICE_MOBILE_DASHBOARD_V1=true;',
 'const FI_SOURCING_RETIRED_V1=true;',
 'const csp="script-src \'self\'; frame-ancestors \'none\';";',
 'const root=path.dirname(fileURLToPath(import.meta.url));',
 'const server=http.createServer(async(req,res)=>{try{',
 'const routes=["/api/rea/call","/api/optimization/agent/analyze",',
 '"/api/ai/automatic-memory/status","/api/voice/mobile/","/api/web/status"];'
].join("\n");
function temp(){return mkdtempSync(join(tmpdir(),"fun-chat-opt-"));}
test("staging patch preserves existing chat source and protected paths",()=>{
 const output=patchChatOptimizationServer(fixtureServer);
 assert.match(output,/FI_CHAT_OPTIMIZATION_SERVER_V1/);
 for(const marker of ["/api/rea/call","/api/optimization/agent/analyze",
  "/api/ai/automatic-memory/status","/api/voice/mobile/","/api/web/status"])assert.ok(output.includes(marker));
 assert.match(output,/localRequest\(req,res\)/);
 assert.match(output,/chat-optimization\/client\.js/);
 assert.throws(()=>patchChatOptimizationServer(output),/ALREADY_PATCHED/);
 assert.throws(()=>patchChatOptimizationServer(fixtureServer.replace("FI_AUTO_COGNEE_CHAT_V1","MISSING")),/PROTECTED_MARKER/);
 const input='<html><body><div>FI_WEB_CHAT_CONSOLIDATION_UI_V1</div><textarea id="chat-input"></textarea><button id="chat-send">Send</button><div id="chat-proposals"></div></body></html>';
 const ui=patchChatOptimizationUi(input);
 assert.match(ui,/FI_CHAT_OPTIMIZATION_UI_V1/);
 assert.ok(ui.includes('id="chat-input"'));
 assert.throws(()=>patchChatOptimizationUi(ui),/ALREADY_PATCHED/);
 assert.throws(()=>patchChatOptimizationUi("<html><body></body></html>"),/UI_BASELINE_MISSING/);
});
test("drafting makes no solver requests, hashes a verified problem, and blocks guessed candidate fields",async()=>{
 const folder=temp(),calls={create:0,advance:0,review:0};
 try{
  const service=createChatOptimization({root:folder,localModel:model,
   coordinatorFactory:()=>({
    create:async()=>{calls.create++;throw Error("should not call");},
    advance:async()=>{calls.advance++;throw Error("should not call");},
    review:async()=>{calls.review++;throw Error("should not call");}
   })});
  const p=await service.draft({goal,candidates:[candidate]});
  assert.equal(p.state,"awaiting_operator_authorization");
  assert.equal(p.action,"inventory");
  assert.equal(p.solver_runs_in_draft,0);
  assert.equal(p.external_actions_executed,0);
  assert.equal(p.rea_tools_executed,0);
  assert.equal(p.model_usage.completion_tokens,27);
  assert.equal(calls.create,0);
  const q=await service.inspect(p.proposal_id);
  assert.equal(q.sha256,p.sha256);
  assert.equal(q.claimed,false);
  await assert.rejects(service.draft({goal,candidates:[{...candidate,problem:{...candidate.problem,unapproved:1}}]}),/OPTIMIZATION_SPEC/);
  await assert.rejects(service.run({id:p.proposal_id,sha256:"0".repeat(64)}),/HASH_MISMATCH/);
  assert.equal(calls.advance,0);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
test("one operator-approved solve is non-replayable and needs separate review/decision",async()=>{
 const folder=temp(),calls={create:0,advance:0,review:0};
 try{
  const coordinator={
   create:async spec=>{calls.create++;assert.equal(spec.steps[0].action,"inventory");
    assert.equal(spec.steps.at(-1).kind,"review");return {id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"};},
   advance:async id=>{calls.advance++;return calls.advance===1?
    {status:"ready",results:{solve:{output:{action:"inventory",engine:"optuna-tpe",result:{
     best_stock_level:5,operator_action_taken:false}}}},used_completion_tokens:0,
     external_actions_executed:0,rea_tools_executed:0}:
    {status:"awaiting_review",external_actions_executed:0,rea_tools_executed:0};},
   review:async(id,decision)=>{calls.review++;assert.equal(decision,"approve");
    return {status:"complete",external_actions_executed:0,rea_tools_executed:0};}
  };
  const service=createChatOptimization({root:folder,localModel:model,coordinatorFactory:()=>coordinator});
  const p=await service.draft({goal,candidates:[candidate]});
  const solved=await service.run({id:p.proposal_id,sha256:p.sha256});
  assert.equal(solved.state,"ready");
  assert.equal(solved.engine,"optuna-tpe");
  assert.equal(solved.review,"NOT_GRANTED");
  assert.equal(calls.advance,1);
  await assert.rejects(service.run({id:p.proposal_id,sha256:p.sha256}),/EEXIST/);
  const seen=await service.inspect(p.proposal_id);
  assert.equal(seen.claimed,true);
  assert.equal(seen.workflow_id,"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  const awaiting=await service.enterReview({id:p.proposal_id,sha256:p.sha256,workflow_id:seen.workflow_id});
  assert.equal(awaiting.state,"awaiting_review");
  const approved=await service.decide({id:p.proposal_id,sha256:p.sha256,workflow_id:seen.workflow_id,decision:"approve"});
  assert.equal(approved.state,"complete");
  assert.equal(approved.no_external_action,true);
  assert.equal(calls.create,1);assert.equal(calls.advance,2);assert.equal(calls.review,1);
  await assert.rejects(service.decide({id:p.proposal_id,sha256:p.sha256,
   workflow_id:"ffffffff-ffff-4fff-8fff-ffffffffffff",decision:"approve"}),/REVIEW_NOT_OWNED/);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
test("HTTP bridge requires explicit approval header for computation and final decision",async()=>{
 const calls=[];
 const service={
  draft:async input=>{calls.push("draft");return {state:"awaiting_operator_authorization"};},
  inspect:async()=>({state:"awaiting_operator_authorization"}),
  run:async()=>{calls.push("run");return {state:"ready"};},
  enterReview:async()=>({state:"awaiting_review"}),
  decide:async()=>{calls.push("decide");return {state:"complete"};}
 };
 const handler=createChatOptimizationHandler({service});
 const perform=async(route,headers,body)=>{
  let result;
  await handler({url:route,method:"POST",headers}, {}, {
   json:(res,status,data)=>{result={status,data};},
   readBody:async(req,max)=>{assert.equal(max,12000);return body;}
  });
  return result;
 };
 const h={"content-type":"application/json"};
 const input={goal,candidates:[candidate]};
 assert.equal((await perform("/api/ai/chat-optimization/draft",h,input)).status,200);
 assert.deepEqual(calls,["draft"]);
 assert.equal((await perform("/api/ai/chat-optimization/run",h,{id:"x",sha256:"a"})).status,403);
 assert.equal(calls.includes("run"),false);
 assert.equal((await perform("/api/ai/chat-optimization/run",{
  ...h,"x-fi-optimization-approval":"operator-reviewed"},
  {id:"x",sha256:"a"})).status,200);
 assert.equal((await perform("/api/ai/chat-optimization/decide",h,{
  id:"x",sha256:"a",workflow_id:"b",decision:"approve"})).status,403);
 assert.equal(calls.includes("decide"),false);
});
test("client recognizes explicit optimization prompt but never grants autonomous authority",()=>{
 const c=readFileSync(new URL("../src/workflows/chat-optimization-client.js",import.meta.url),"utf8");
 assert.match(c,/addEventListener\("click"/);
 assert.match(c,/addEventListener\("keydown"/);
 assert.match(c,/stopImmediatePropagation/);
 assert.match(c,/x-fi-optimization-approval/);
 assert.match(c,/window.confirm/);
 assert.match(c,/verified numeric candidate problems/i);
 assert.match(c,/Approve ONE local solver run/);
 assert.doesNotMatch(c,/\/api\/rea\/call|\/api\/ai\/tool-call|Stop-Process|Restart-Service/);
});
