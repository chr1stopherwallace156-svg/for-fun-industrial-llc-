// FI_OPTIMIZATION_AGENT_V1 — opt-in orchestration of offline optimization.
// A human request can select and run bounded local solvers with actual inputs.
// The agent has no REA, platform-tool, network or business-action authority.
import {randomUUID} from "node:crypto";
import {mkdir,writeFile,lstat} from "node:fs/promises";
import {join,resolve,sep} from "node:path";
import {homedir} from "node:os";

const TASKS={
 inventory:{engine:"optuna",required:["demand_samples","min_stock","max_stock","holding_cost","shortage_cost","trials"],next:"Review inventory recommendation before changing reorder points or placing orders."},
 allocation:{engine:"google-or-tools",required:["budget","labor_capacity","projects"],next:"Review project selection, budget and labor before scheduling or committing resources."},
 route:{engine:"google-or-tools",required:["depot","cost_matrix"],next:"Review stop sequence and routing assumptions before dispatching vehicles."}
};
const MAX_REQUEST=2400;
function isObject(x){return x!==null&&typeof x==="object"&&!Array.isArray(x);}
function classify(request){
 const hit=[];
 if(/\b(inventory|stock|reorder|shortage|holding cost)\b/i.test(request))hit.push("inventory");
 if(/\b(budget|labor|allocation|project|resources|staff)\b/i.test(request))hit.push("allocation");
 if(/\b(route|routing|stops|depot|travel|dispatch)\b/i.test(request))hit.push("route");
 return hit.length===1?hit[0]:null;
}
function infer(problem){
 if(!isObject(problem))return null;
 const hit=Object.entries({inventory:"demand_samples",allocation:"projects",route:"cost_matrix"})
  .filter(([,key])=>Object.hasOwn(problem,key)).map(([name])=>name);
 return hit.length===1?hit[0]:null;
}
function validateInputs(request,problem){
 if(typeof request!=="string"||request.length>MAX_REQUEST)throw Error("OPT_AGENT_REQUEST_INVALID");
 if(problem!==null&&problem!==undefined&&!isObject(problem))throw Error("OPT_AGENT_PROBLEM_INVALID");
 const action=problem==null?classify(request):infer(problem);
 if(!action)return {state:"needs_input",suggested_type:classify(request),missing:"Complete bounded JSON for exactly one supported optimization type is required.",supported:Object.fromEntries(Object.entries(TASKS).map(([k,v])=>[k,v.required]))};
 const keys=TASKS[action].required;
 if(problem==null)return {state:"needs_input",suggested_type:action,missing:"Verified numeric inputs are required; the AI must not invent budgets, costs or distances.",required_fields:keys};
 const missing=keys.filter(k=>!Object.hasOwn(problem,k));
 if(missing.length)return {state:"needs_input",suggested_type:action,missing:"Missing required fields.",required_fields:missing};
 if(Buffer.byteLength(JSON.stringify(problem),"utf8")>32000)throw Error("OPT_AGENT_PROBLEM_TOO_LARGE");
 return {state:"ready",action,engine:TASKS[action].engine};
}
function outputFolder(){
 const base=process.env.LOCALAPPDATA||join(homedir(),"AppData","Local");
 return resolve(base,"FunIndustrial","OptimizationRuntime","approved-plans");
}
export function createOptimizationAgent({runner,saveDirectory=outputFolder(),now=()=>Date.now()}={}){
 if(!runner||typeof runner.run!=="function"||typeof runner.status!=="function")throw Error("OPT_AGENT_RUNNER_REQUIRED");
 let pending=null;
 async function analyze({request,problem=null}={}){
  pending=null;
  const data=validateInputs(request,problem);
  if(data.state!=="ready")return {...data,read_only:true,external_actions_executed:0,rea_tools_executed:0};
  const result=await runner.run(data.action,problem);
  if(result.schema!=="fun.optimization.result.v1"||result.action!==data.action||
     result.decision_support_only!==true||result.rea_tools_executed!==0||
     result.external_actions_executed!==0)throw Error("OPT_AGENT_UNTRUSTED_SOLVER_RESULT");
  const ticket=randomUUID(),stamp=now();
  const proposed={
   schema:"fun.optimization.execution-plan.v1",action:data.action,
   solver:data.engine,local_optimizer_executed:true,
   external_actions_executed:0,rea_tools_executed:0,
   next_steps:[
    {id:"review-result",description:"Inspect solver constraints, feasibility and assumptions",state:"review-required",side_effects:false},
    {id:"save-report",description:"Save this solver result as a local decision package",state:"approval-required",side_effects:true},
    {id:"apply-business-changes",description:TASKS[data.action].next,state:"separate-authorization-required",side_effects:true,automatically_executable:false}
   ]
  };
  pending={ticket,stamp,action:data.action,report:{request,problem,result,execution_plan:proposed}};
  return {state:"computed",action:data.action,engine:data.engine,result,execution_plan:proposed,
    approval_ticket:ticket,approval_expires_in_seconds:300,external_actions_executed:0,rea_tools_executed:0};
 }
 async function approve({ticket,action}={}){
  if(action!=="save-report")throw Error("OPT_AGENT_ACTION_NOT_ALLOWLISTED");
  if(typeof ticket!=="string"||ticket.length>100||!pending||ticket!==pending.ticket)throw Error("OPT_AGENT_APPROVAL_TICKET_INVALID");
  if(now()-pending.stamp>300000){pending=null;throw Error("OPT_AGENT_APPROVAL_EXPIRED");}
  const report=pending.report;
  pending=null; // single use even if storage fails
  const dir=resolve(saveDirectory);
  if(!dir.startsWith(resolve(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"))+sep))throw Error("OPT_AGENT_REPORT_LOCATION_NOT_ALLOWED");
  for(const directory of [resolve(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local")),resolve(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),"FunIndustrial"),resolve(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),"FunIndustrial","OptimizationRuntime")]){
   try{if((await lstat(directory)).isSymbolicLink())throw Error("OPT_AGENT_PATH_SYMLINK_DENIED");}catch(e){if(e.code!=="ENOENT")throw e;}
  }
  await mkdir(dir,{recursive:true});
  if((await lstat(dir)).isSymbolicLink())throw Error("OPT_AGENT_PATH_SYMLINK_DENIED");
  const filename="approved-optimization-"+Date.now()+"-"+randomUUID()+".json";
  const file=join(dir,filename);
  await writeFile(file,JSON.stringify({schema:"fun.optimization.approved-local-report.v1",approved_at:new Date().toISOString(),...report},null,2),{encoding:"utf8",flag:"wx",mode:0o600});
  return {state:"saved",action:"save-report",file,external_actions_executed:0,rea_tools_executed:0};
 }
 function status(){return {schema:"fun.optimization.agent-status.v1",state:runner.status().state,automatic_solver_selection:true,
  local_solver_execution:true,requires_real_data:true,approved_local_report_export:true,rea_execution:false,
  business_actions_automatic:false,approval_required_for_side_effects:true,supported:Object.keys(TASKS)};}
 return {status,analyze,approve};
}
