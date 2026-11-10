// FI_WORKFLOW_PHASE22_CLI_V1 — separate operator steps: draft, inspect, run.
// No REA, service restart, autonomous solver, dashboard changes, or model-initiated tools.
import {open,readFile,lstat,mkdir,unlink,writeFile} from "node:fs/promises";
import {join,resolve,parse} from "node:path";
import {homedir} from "node:os";
import {phase22Prompt,phase22Proposal,verifyPhase22Proposal,phase22WorkflowSpec,validatePhase22Request} from "./phase22.mjs";
import {defaultLocalModel,createWorkflowCoordinator} from "./coordinator.mjs";
const [command,...args]=process.argv.slice(2);
const root=join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),
 "FunIndustrial","WorkflowRuntime","phase22-proposals");
const idRegex=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function safeFolder(){
 const full=resolve(root);let current=parse(full).root;
 for(const part of full.slice(current.length).split(/[\\/]+/).filter(Boolean)){
  current=join(current,part);
  try{const stat=await lstat(current);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error("PHASE22_UNSAFE_DIRECTORY");}
  catch(e){if(e.code!=="ENOENT")throw e;await mkdir(current);
   const st=await lstat(current);if(!st.isDirectory()||st.isSymbolicLink())throw Error("PHASE22_UNSAFE_DIRECTORY");}
 }
 return full;
}
async function safeJson(path,max=16000){
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>max)throw Error("PHASE22_UNSAFE_FILE");
 return JSON.parse(await readFile(path,"utf8"));
}
function proposalPath(id){
 if(!idRegex.test(id||""))throw Error("PHASE22_INVALID_ID");
 return join(root,id+".json");
}
async function getProposal(id){
 await safeFolder();
 const doc=await safeJson(proposalPath(id));
 const verified=verifyPhase22Proposal(doc);
 if(verified.id!==id)throw Error("PHASE22_ID_MISMATCH");
 return verified;
}
function preview(p){
 return {id:p.id,sha256:p.sha256,action:p.selected.action,problem:p.selected.problem,
  goal:p.goal,model_reason_untrusted:p.reason,model_usage:p.model_usage,
  authorization:"REQUIRED_BEFORE_SOLVER",external_actions_authorized:false};
}
async function draft(file){
 const input=validatePhase22Request(await safeJson(resolve(file||""),12000));
 const model=await defaultLocalModel({message:phase22Prompt(input),max_tokens:256});
 const proposed=phase22Proposal(input,model);
 const dir=await safeFolder(),dest=join(dir,proposed.id+".json");
 const handle=await open(dest,"wx",0o600);
 try{await handle.writeFile(JSON.stringify(proposed),"utf8");await handle.sync();}finally{await handle.close();}
 const p=verifyPhase22Proposal(proposed);
 console.log(JSON.stringify({event:"FUN_PHASE22_DRAFT",state:"awaiting_operator_authorization",
  ...preview(p),executed_tools:0,solver_runs:0}));
 console.log("NEXT=INSPECT_AND_EXPLICITLY_RUN_WITH_ID_AND_SHA256");
}
async function inspect(id){
 const proposal=await getProposal(id);
 let claimed=false;
 try{const info=await lstat(join(root,id+".claim"));claimed=info.isFile();}catch(e){if(e.code!=="ENOENT")throw e;}
 console.log(JSON.stringify({event:"FUN_PHASE22_INSPECT",state:claimed?"run_already_claimed":"awaiting_operator_authorization",
  ...preview(proposal)}));
}
async function run(id,hash){
 const proposal=await getProposal(id);
 if(!/^[a-f0-9]{64}$/.test(hash||"")||hash!==proposal.sha256)
  throw Error("PHASE22_OPERATOR_HASH_MISMATCH");
 const claimFile=join(root,id+".claim");
 // Non-replayable approval claim. A crashed process needs manual inspection; never auto-repeat.
 const claim=await open(claimFile,"wx",0o600);
 try{await claim.writeFile(JSON.stringify({id,sha256:hash,operator_run_requested:true,
  started_at:new Date().toISOString()}),"utf8");await claim.sync();}finally{await claim.close();}
 // Limit Phase 2.2 to a single run at a time across CLI processes.
 const lockFile=join(root,"solver-phase22.lock");
 const lock=await open(lockFile,"wx",0o600);
 try{
  await lock.writeFile(JSON.stringify({id,pid:process.pid}),"utf8");await lock.sync();
  const coordinator=createWorkflowCoordinator();
  const created=await coordinator.create(phase22WorkflowSpec(proposal));
  await writeFile(claimFile,JSON.stringify({id,sha256:hash,operator_run_requested:true,
   workflow_id:created.id,created_at:new Date().toISOString()}),"utf8");
  console.log("FUN_PHASE22_WORKFLOW_ID="+created.id);
  const result=await coordinator.advance(created.id);
  if(result.external_actions_executed!==0||result.rea_tools_executed!==0)
   throw Error("PHASE22_AUTHORITY_VIOLATION");
  const solver=result.results?.solve?.output;
  if(result.status!=="ready"||!solver||solver.action!==proposal.selected.action||
     solver.operator_action_taken!==false)throw Error("PHASE22_SOLVER_HOLD:"+String(result.hold_reason||result.status));
  console.log(JSON.stringify({event:"FUN_PHASE22_SOLVER",state:result.status,
   workflow_id:created.id,engine:solver.engine,result:solver.result,
   used_completion_tokens:result.used_completion_tokens,operator_review:"NOT_GRANTED",
   external_actions_executed:result.external_actions_executed,rea_tools_executed:result.rea_tools_executed}));
  console.log("NEXT=node <LIVE_WORKFLOW_CLI> step "+created.id+" (enters review; does not approve)");
 }finally{await lock.close();await unlink(lockFile).catch(()=>{});}
}
try{
 if(command==="draft"&&args.length===1)await draft(args[0]);
 else if(command==="inspect"&&args.length===1)await inspect(args[0]);
 else if(command==="run"&&args.length===2)await run(args[0],args[1]);
 else throw Error("PHASE22_COMMAND_INVALID: draft INPUT_JSON | inspect PROPOSAL_ID | run PROPOSAL_ID SHA256");
}catch(e){
 console.error("FUN_PHASE22_HOLD="+String(e.message||e).slice(0,300));
 process.exitCode=1;
}
