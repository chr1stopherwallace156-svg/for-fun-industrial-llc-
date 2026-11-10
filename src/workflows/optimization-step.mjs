// FI_WORKFLOW_OPTIMIZATION_V1 — validated offline solver step, never an action permit.
// Existing bounded Optuna/OR-Tools runner only; no REA, shell, or service lifecycle.
const ACTIONS=new Set(["inventory","allocation","route"]);
const OBJ=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const number=(n,a,b)=>typeof n==="number"&&Number.isFinite(n)&&n>=a&&n<=b;
const keys=(o,allowed)=>OBJ(o)&&Object.keys(o).every(k=>allowed.includes(k));
function assert(ok,why){if(!ok)throw Error("WORKFLOW_OPTIMIZATION_SPEC_"+why);}
function validateProblem(action,p){
 assert(OBJ(p),"PROBLEM_INVALID");
 if(action==="inventory"){
  assert(keys(p,["demand_samples","min_stock","max_stock","holding_cost","shortage_cost","trials"]),"FIELDS_DENIED");
  assert(Array.isArray(p.demand_samples)&&integer(p.demand_samples.length,2,300)&&
   p.demand_samples.every(x=>integer(x,0,100000)),"DEMAND_INVALID");
  assert(integer(p.min_stock,0,100000)&&integer(p.max_stock,0,100000)&&p.min_stock<=p.max_stock,"STOCK_BOUNDS");
  assert(number(p.holding_cost,0,100000)&&number(p.shortage_cost,0,100000)&&
   p.holding_cost+p.shortage_cost>0,"COST_INVALID");
  assert(integer(p.trials,4,128),"TRIALS_INVALID");
 }else if(action==="allocation"){
  assert(keys(p,["budget","labor_capacity","projects"]),"FIELDS_DENIED");
  assert(integer(p.budget,0,10000000)&&integer(p.labor_capacity,0,10000000),"CAPACITY_INVALID");
  assert(Array.isArray(p.projects)&&integer(p.projects.length,1,30),"PROJECTS_INVALID");
  const ids=new Set();
  for(const q of p.projects){
   assert(keys(q,["id","cost","labor","value","max_units"]),"PROJECT_FIELDS_DENIED");
   assert(typeof q.id==="string"&&/^[a-z0-9_-]{1,48}$/i.test(q.id)&&!ids.has(q.id),"PROJECT_ID_INVALID");
   ids.add(q.id);
   for(const k of ["cost","labor","value"])assert(integer(q[k],0,1000000),"PROJECT_NUMERIC_INVALID");
   assert(integer(q.max_units,0,50),"PROJECT_UNITS_INVALID");
  }
 }else if(action==="route"){
  assert(keys(p,["cost_matrix","depot"]),"FIELDS_DENIED");
  assert(Array.isArray(p.cost_matrix)&&integer(p.cost_matrix.length,2,12),"MATRIX_SIZE");
  const n=p.cost_matrix.length;
  assert(integer(p.depot,0,n-1),"DEPOT_INVALID");
  for(let i=0;i<n;i++){
   const row=p.cost_matrix[i];
   assert(Array.isArray(row)&&row.length===n&&row.every(v=>integer(v,0,1000000))&&row[i]===0,"MATRIX_INVALID");
  }
 }else throw Error("WORKFLOW_OPTIMIZATION_ACTION_DENIED");
}
export function validateOptimizationStep(s){
 assert(keys(s,["id","kind","action","problem"]),"STEP_FIELDS_DENIED");
 assert(ACTIONS.has(s.action),"ACTION_DENIED");
 assert(s.kind==="optimization","STEP_KIND_DENIED");
 validateProblem(s.action,s.problem);
 const encoded=JSON.stringify(s.problem);
 assert(encoded&&Buffer.byteLength(encoded,"utf8")<=9000,"INPUT_LIMIT");
 // Freeze the *meaning* of the operator's request, not a reference to mutable input data.
 return {id:s.id,kind:"optimization",action:s.action,problem:JSON.parse(encoded)};
}
export async function runWorkflowOptimization(step,customRunner=null){
 const runner=customRunner||(await import("../optimization/runner.mjs")).createOptimizationRunner();
 if(!runner||typeof runner.status!=="function"||typeof runner.run!=="function")throw Error("WORKFLOW_OPTIMIZATION_RUNNER_INVALID");
 if(runner.status()?.state!=="ready")throw Error("WORKFLOW_OPTIMIZATION_RUNNER_NOT_READY");
 const raw=await runner.run(step.action,step.problem);
 if(raw?.schema!=="fun.optimization.result.v1"||raw.action!==step.action||
  raw.decision_support_only!==true||raw.external_actions_executed!==0||raw.rea_tools_executed!==0||
  !OBJ(raw.result)||raw.result.operator_action_taken!==false)
  throw Error("WORKFLOW_OPTIMIZATION_RESULT_UNTRUSTED");
 const expected={inventory:"optuna-tpe",allocation:"google-or-tools-cp-sat",route:"google-or-tools-routing"};
 if(raw.result.engine!==expected[step.action])throw Error("WORKFLOW_OPTIMIZATION_ENGINE_MISMATCH");
 const encoded=JSON.stringify(raw.result);
 if(!encoded||Buffer.byteLength(encoded,"utf8")>10000)throw Error("WORKFLOW_OPTIMIZATION_RESULT_TOO_LARGE");
 return {action:step.action,engine:raw.result.engine,decision_support_only:true,
  operator_action_taken:false,external_actions_executed:0,rea_tools_executed:0,result:JSON.parse(encoded)};
}
// Constrains what Qwen sees. Full solver result remains in checkpoint for operator review.
export function compactOptimizationEvidence(o){
 if(!OBJ(o)||!ACTIONS.has(o.action)||!OBJ(o.result)||o.decision_support_only!==true)
  throw Error("WORKFLOW_OPTIMIZATION_EVIDENCE_UNTRUSTED");
 const r=o.result;
 let compact;
 if(o.action==="inventory"){
  compact={best_stock_level:r.best_stock_level,estimated_average_cost:r.estimated_average_cost,
   baseline_min_stock_cost:r.baseline_min_stock_cost,trials_completed:r.trials_completed,
   best_is_globally_proven:r.best_is_globally_proven};
 }else if(o.action==="allocation"){
  compact={state:r.state,solution_found:r.solution_found,optimality_proven:r.optimality_proven,
   budget_used:r.budget_used,budget_limit:r.budget_limit,labor_used:r.labor_used,
   labor_capacity:r.labor_capacity,total_value:r.total_value,
   allocations_count:Array.isArray(r.allocation)?r.allocation.length:0,
   allocations_sample:Array.isArray(r.allocation)?r.allocation.slice(0,6):[]};
 }else{
  compact={solution_found:r.solution_found,optimality_proven:r.optimality_proven,
   route:r.route,total_cost:r.total_cost,cost_units:r.cost_units};
 }
 const data={type:"offline_optimization",action:o.action,engine:o.engine,decision_support_only:true,
  operator_action_taken:false,result:compact};
 if(JSON.stringify(data).length>1500)throw Error("WORKFLOW_OPTIMIZATION_EVIDENCE_TOO_LARGE");
 return data;
}
