// FI_CHAT_OPTIMIZATION_BRIDGE_V1 — same-origin, operator-gated existing workflow adapter.
// Qwen selects *only* among verified operator inputs; no REA, browser, shell, automation or background runs.
import {open,readFile,lstat,mkdir,unlink,rename,writeFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {join,resolve,parse} from "node:path";
import {homedir} from "node:os";
import {validatePhase22Request,phase22Prompt,phase22Proposal,verifyPhase22Proposal,phase22WorkflowSpec} from "./phase22.mjs";
import {defaultLocalModel,createWorkflowCoordinator} from "./coordinator.mjs";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/;
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,fields)=>obj(x)&&Object.keys(x).length===fields.length&&Object.keys(x).every(k=>fields.includes(k));
function guard(ok,code){if(!ok)throw Error("CHAT_OPT_HOLD_"+code);}
const standardRoot=()=>join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),"FunIndustrial","WorkflowRuntime","phase22-proposals");
async function folderSafe(folder){
 const full=resolve(folder);let current=parse(full).root;
 for(const part of full.slice(current.length).split(/[\\/]+/).filter(Boolean)){
  current=join(current,part);
  try{const info=await lstat(current);guard(info.isDirectory()&&!info.isSymbolicLink(),"STORAGE_UNSAFE");}
  catch(e){if(e.code!=="ENOENT")throw e;await mkdir(current);const st=await lstat(current);
   guard(st.isDirectory()&&!st.isSymbolicLink(),"STORAGE_UNSAFE");}
 }
 return full;
}
async function safeJson(path,max=16000){
 const st=await lstat(path);
 guard(st.isFile()&&!st.isSymbolicLink()&&st.size>2&&st.size<=max,"FILE_UNSAFE");
 return JSON.parse(await readFile(path,"utf8"));
}
async function writeOnce(path,content){
 const h=await open(path,"wx",0o600);
 try{await h.writeFile(JSON.stringify(content),"utf8");await h.sync();}finally{await h.close();}
}
export function createChatOptimization({root=standardRoot(),localModel=defaultLocalModel,
 coordinatorFactory=()=>createWorkflowCoordinator()}={}){
 const dir=resolve(root);
 const proposalFile=id=>{guard(ID.test(id||""),"ID_INVALID");return join(dir,id+".json");};
 const claimFile=id=>{guard(ID.test(id||""),"ID_INVALID");return join(dir,id+".claim");};
 async function fetchProposal(id){
  await folderSafe(dir);
  const stored=await safeJson(proposalFile(id));
  const verified=verifyPhase22Proposal(stored);
  guard(verified.id===id,"STORED_ID_MISMATCH");
  return verified;
 }
 async function claimStatus(id){
  try{
   const data=await safeJson(claimFile(id),2000);
   guard(exact(data,["id","sha256","operator_run_requested","workflow_id","created_at"])||
    exact(data,["id","sha256","operator_run_requested","started_at"]),"CLAIM_SCHEMA");
   guard(data.id===id&&HASH.test(data.sha256)&&data.operator_run_requested===true,"CLAIM_INVALID");
   return data;
  }catch(e){if(e.code==="ENOENT")return null;throw e;}
 }
 const preview=(p,c)=>({proposal_id:p.id,sha256:p.sha256,action:p.selected.action,
  problem:p.selected.problem,goal:p.goal,model_reason_untrusted:p.reason,
  model_usage:p.model_usage,claimed:c!==null,workflow_id:c?.workflow_id||null,
  operator_approval_required:true,solver_runs_in_draft:0});
 async function draft(input){
  const request=validatePhase22Request(input);
  const raw=await localModel({message:phase22Prompt(request),max_tokens:256});
  const proposal=phase22Proposal(request,raw);
  await folderSafe(dir);
  await writeOnce(proposalFile(proposal.id),proposal);
  const v=verifyPhase22Proposal(proposal);
  return {event:"FUN_CHAT_OPT_DRAFT",state:"awaiting_operator_authorization",...preview(v,null),
   external_actions_executed:0,rea_tools_executed:0};
 }
 async function inspect(id){
  const p=await fetchProposal(id);
  const c=await claimStatus(id);
  if(c)guard(c.sha256===p.sha256,"CLAIM_HASH_INVALID");
  return {event:"FUN_CHAT_OPT_INSPECT",
   state:c?"run_claimed":"awaiting_operator_authorization",...preview(p,c)};
 }
 async function run({id,sha256}){
  guard(exact({id,sha256},["id","sha256"]),"RUN_SCHEMA");
  guard(HASH.test(sha256||""),"RUN_DIGEST_INVALID");
  const p=await fetchProposal(id);
  guard(p.sha256===sha256,"RUN_HASH_MISMATCH");
  await folderSafe(dir);
  const lockPath=join(dir,"solver-phase22.lock"); // same single-global lock as Phase 2.2 CLI
  const lock=await open(lockPath,"wx",0o600);
  try{
   await lock.writeFile(JSON.stringify({id,pid:process.pid,scope:"chat-optimization"}),"utf8");await lock.sync();
   // Single-use claim remains after errors or crashes. NEVER silently retry a solver.
   await writeOnce(claimFile(id),{id,sha256,operator_run_requested:true,started_at:new Date().toISOString()});
   const coordinator=coordinatorFactory();
   const created=await coordinator.create(phase22WorkflowSpec(p));
   const temp=claimFile(id)+"."+randomUUID()+".tmp";
   try{
    await writeFile(temp,JSON.stringify({id,sha256,operator_run_requested:true,
     workflow_id:created.id,created_at:new Date().toISOString()}),{flag:"wx",mode:0o600});
    await rename(temp,claimFile(id));
   }finally{await unlink(temp).catch(()=>{});}
   const after=await coordinator.advance(created.id);
   guard(after.external_actions_executed===0&&after.rea_tools_executed===0,"FORBIDDEN_AUTHORITY");
   const output=after.results?.solve?.output;
   return {event:"FUN_CHAT_OPT_SOLVER",state:after.status,workflow_id:created.id,
    engine:output?.engine||null,action:output?.action||p.selected.action,
    result:output?.result||null,hold_reason:after.hold_reason||null,
    used_completion_tokens:after.used_completion_tokens,
    review:"NOT_GRANTED",external_actions_executed:0,rea_tools_executed:0};
  }finally{await lock.close();await unlink(lockPath).catch(()=>{});}
 }
 async function claimedWorkflow(id,sha256,workflow_id){
  guard(ID.test(workflow_id||"")&&HASH.test(sha256||""),"REVIEW_IDENTIFIERS");
  const p=await fetchProposal(id);
  guard(p.sha256===sha256,"REVIEW_HASH_MISMATCH");
  const c=await claimStatus(id);
  guard(c&&c.sha256===sha256&&c.workflow_id===workflow_id,"REVIEW_NOT_OWNED");
  return coordinatorFactory();
 }
 async function enterReview({id,sha256,workflow_id}){
  const workflow=await claimedWorkflow(id,sha256,workflow_id);
  const result=await workflow.advance(workflow_id);
  guard(result.external_actions_executed===0&&result.rea_tools_executed===0,"REVIEW_AUTHORITY");
  return {event:"FUN_CHAT_OPT_REVIEW",state:result.status,workflow_id,
   operator_decision:"NOT_GRANTED",external_actions_executed:0};
 }
 async function decide({id,sha256,workflow_id,decision}){
  guard(decision==="approve"||decision==="reject","DECISION_INVALID");
  const workflow=await claimedWorkflow(id,sha256,workflow_id);
  const result=await workflow.review(workflow_id,decision);
  guard(result.external_actions_executed===0&&result.rea_tools_executed===0,"REVIEW_AUTHORITY");
  return {event:"FUN_CHAT_OPT_DECISION",state:result.status,workflow_id,
   operator_decision:decision,no_external_action:true};
 }
 return {draft,inspect,run,enterReview,decide};
}
