// FUN_AI_REVIEWED_COMPUTE_V1 — bounded operator-approved Optuna, OR-Tools
// and existing verified ML bridge; one fixed process, exact input token,
// no model-driven execution, file targets, provider changes or auto-retries.
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDashboardMlPayload} from '../ml/dashboard-ml-proxy-v3.mjs';

export const COMPUTE_VERSION='fun-reviewed-compute-v1';
const SCRIPT=fileURLToPath(new URL('../../scripts/Run-Fun-Approved-Optimization-V1.py',import.meta.url));
const MODES=Object.freeze(['optuna_inventory','ortools_routing','ml_deals','ml_history','ml_candidates']);
const MAX_IN=12500,MAX_OUT=60000;
const hold=x=>{throw Error('FUN_COMPUTE_HOLD_'+x)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const secret=()=>randomBytes(24).toString('hex');
const validToken=s=>typeof s==='string'&&/^[0-9a-f]{48}$/.test(s);
const equalToken=(a,b)=>validToken(a)&&validToken(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const float=v=>typeof v==='number'&&Number.isFinite(v);
const num=(v,lo,hi)=>float(v)&&Number.isInteger(v)&&v>=lo&&v<=hi;
const COPY=x=>JSON.parse(JSON.stringify(x));
function validateSpec(value){
 if(!obj(value)||Object.keys(value).sort().join(',')!=='kind,prompt,spec'||
    !MODES.includes(value.kind)||typeof value.prompt!=='string'||
    value.prompt.length<4||value.prompt.length>1000||!obj(value.spec))
  hold('REQUEST_SCHEMA_INVALID');
 const {kind,spec}=value;
 if(kind==='optuna_inventory'){
  if(Object.keys(spec).sort().join(',')!=='demand,holding_cost,max_stock,min_stock,shortage_cost,trials'||
     !Array.isArray(spec.demand)||spec.demand.length<1||spec.demand.length>50||
     spec.demand.some(x=>!num(x,0,1000))||
     !num(spec.holding_cost,1,1000)||!num(spec.shortage_cost,1,1000)||
     !num(spec.min_stock,0,1000)||!num(spec.max_stock,0,1000)||
     spec.min_stock>spec.max_stock||!num(spec.trials,12,64))
   hold('INVENTORY_SCHEMA_INVALID');
 }else if(kind==='ortools_routing'){
  if(Object.keys(spec).join(',')!=='cost_matrix'||!Array.isArray(spec.cost_matrix)||
     spec.cost_matrix.length<3||spec.cost_matrix.length>12)hold('ROUTING_SCHEMA_INVALID');
  const n=spec.cost_matrix.length;
  for(let i=0;i<n;i++){
   const row=spec.cost_matrix[i];
   if(!Array.isArray(row)||row.length!==n||row.some(x=>!num(x,0,10000))||row[i]!==0)
    hold('ROUTING_MATRIX_INVALID');
  }
 }else{
  const expected=kind.slice(3);
  if(Object.keys(spec).join(',')!==expected)hold('ML_DATASET_SCHEMA_INVALID');
  // Operator confirmation is only a schema preview here. Actual ML call is
  // made ONLY after a separate exact-token confirmation.
  validateDashboardMlPayload({prompt:value.prompt,data:spec,operatorConfirmed:true});
 }
 const clone=COPY(value);
 if(Buffer.byteLength(JSON.stringify(clone),'utf8')>MAX_IN)hold('REQUEST_TOO_LARGE');
 return clone;
}

function runIsolatedSolver(payload,{spawnProcess=spawn}={}){
 return new Promise((resolve,reject)=>{
  const local=process.env.LOCALAPPDATA;
  if(!local)return reject(Error('FUN_COMPUTE_ISOLATED_ENV_UNCONFIGURED'));
  const executable=join(local,'FunIndustrial','ApprovedOptimizationV1','.venv','Scripts','python.exe');
  const input=JSON.stringify({kind:payload.kind,spec:payload.spec});
  if(Buffer.byteLength(input)>MAX_IN)return reject(Error('FUN_COMPUTE_REQUEST_TOO_LARGE'));
  let child,output='',error='',done=false,timer;
  const finish=(err,value)=>{
   if(done)return;
   done=true;clearTimeout(timer);
   if(err)reject(err);else resolve(value);
  };
  try{
   child=spawnProcess(executable,[SCRIPT],{
    shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],
    env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',
         OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1'}
   });
  }catch{return finish(Error('FUN_COMPUTE_ISOLATED_PYTHON_START_FAILED'))}
  timer=setTimeout(()=>{try{child.kill()}catch{}finish(Error('FUN_COMPUTE_WORKER_TIMEOUT_UNVERIFIED'))},30000);
  child.on('error',()=>finish(Error('FUN_COMPUTE_ISOLATED_ENV_OR_PYTHON_NOT_AVAILABLE')));
  child.stdout?.on('data',b=>{
   output+=b.toString('utf8');
   if(Buffer.byteLength(output,'utf8')>MAX_OUT){
    try{child.kill()}catch{}
    finish(Error('FUN_COMPUTE_WORKER_OUTPUT_EXCEEDED'));
   }
  });
  child.stderr?.on('data',b=>{error=(error+b.toString('utf8')).slice(-2500)});
  child.on('close',code=>{
   if(done)return;
   if(code!==0){
    let reason='WORKER_FAILED';
    try{let x=JSON.parse(error.trim());if(x.state==='HOLD')reason=String(x.reason).slice(0,130)}catch{}
    return finish(Error('FUN_COMPUTE_'+reason));
   }
   let value;
   try{value=JSON.parse(output)}catch{return finish(Error('FUN_COMPUTE_WORKER_NOT_JSON'))}
   if(value?.version!=='fun-reviewed-optimization-v1'||
      value.state!=='COMPLETED_APPROVED_OPTIMIZATION'||value.kind!==payload.kind||
      value.source_code_executed!==false||value.external_actions!==0||
      value.model_calls!==0||value.authority_granted!==false||
      !obj(value.result))return finish(Error('FUN_COMPUTE_WORKER_IDENTITY_INVALID'));
   const answer=value.result;
   if(payload.kind==='optuna_inventory'){
    const {demand,holding_cost,shortage_cost,min_stock,max_stock}=payload.spec;
    const cost=x=>demand.reduce((s,d)=>s+Math.max(x-d,0)*holding_cost+Math.max(d-x,0)*shortage_cost,0);
    if(!num(answer.exact_best_stock,min_stock,max_stock)||
       answer.exact_verification!==true||answer.solver!=='optuna_tpe_with_exhaustive_discrete_verification'||
       Math.abs(cost(answer.exact_best_stock)/demand.length-answer.exact_best_avg_cost)>0.0000015)
      return finish(Error('FUN_COMPUTE_INVENTORY_RECHECK_FAILED'));
   }else if(payload.kind==='ortools_routing'){
    const matrix=payload.spec.cost_matrix,route=answer.route;
    if(!Array.isArray(route)||route.length!==matrix.length+1||
       route[0]!==0||route.at(-1)!==0||
       JSON.stringify([...route.slice(1,-1)].sort((a,b)=>a-b))!==
       JSON.stringify(Array.from({length:matrix.length-1},(_,i)=>i+1))||
       !route.every(v=>num(v,0,matrix.length-1))||
       route.slice(1).reduce((sum,to,i)=>sum+matrix[route[i]][to],0)!==answer.route_cost||
       answer.route_verified_against_matrix!==true||
       answer.optimality_proven!==false)
      return finish(Error('FUN_COMPUTE_ROUTING_RECHECK_FAILED'));
   }
   finish(null,value);
  });
  child.stdin?.on('error',()=>{});
  child.stdin?.end(input);
 });
}

export function createReviewedCompute({ml,runSolver=runIsolatedSolver,clock=Date.now,tokenFactory=secret}={}){
 if(!ml||typeof ml.run!=='function'||typeof ml.status!=='function')hold('ML_BRIDGE_REQUIRED');
 let pending=null,recent=null,busy=false,completed=0,attempts=0;
 const info=()=>{
  return {version:COMPUTE_VERSION,state:'operator_review_ready',modes:[...MODES],
   pending:!!pending,busy,completed,attempts,
   executionPolicy:'fixed_bounded_local_compute_only_after_separate_confirmation',
   optunaOrtoolsEnvironment:'separate_local_virtual_environment_required',
   mlBridge:'existing_8801_scikit_learn',
   modelCanExecute:false,operatorApprovalRequired:true,
   additionalAiModels:0,unrestrictedFilesystemAccess:false,
   authorityGrantedToQwen:false,automaticRetries:false};
 };
 const prepare=async body=>{
  if(busy)hold('BUSY');
  pending=null;recent=null;
  const data=validateSpec(body);
  if(data.kind.startsWith('ml_')){
   const state=await ml.status();
   if(state?.state!=='ready'||state.bridge!=='fun-ml-dashboard-v3')
    hold('ML_8801_NOT_VERIFIED_READY');
  }
  const token=tokenFactory();
  if(!validToken(token))hold('TOKEN_INVALID');
  pending={token,payload:data,hash:hash(data),until:clock()+120000};
  return {version:COMPUTE_VERSION,state:'awaiting_separate_operator_confirmation',
   authorizationToken:token,expiresAtUnixMs:pending.until,
   preview:{kind:data.kind,prompt:data.prompt,inputSha256:pending.hash,
    summary:data.kind==='optuna_inventory'?
      {demandPeriods:data.spec.demand.length,stockBounds:[data.spec.min_stock,data.spec.max_stock],trials:data.spec.trials}:
      data.kind==='ortools_routing'?
      {nodes:data.spec.cost_matrix.length,route:'one vehicle returns to node 0',maxSeconds:4}:
      {dataset:data.kind.slice(3),records:data.spec[data.kind.slice(3)].length,
       localTraining:data.kind==='ml_history',mlBridge:'8801'},
    requestedEffects:data.kind==='ml_history'?'local_scikit_model_training':'bounded_local_computation',
    argumentsVerified:true,operatorConfirmationRequired:true,executedActions:0},
   executedActions:0,authorityGranted:false};
 };
 const confirm=async (body={})=>{
  if(!obj(body)||Object.keys(body).sort().join(',')!=='authorizationToken,operatorConfirmed')
   hold('CONFIRM_SCHEMA_INVALID');
  const {authorizationToken,operatorConfirmed}=body;
  if(busy)hold('BUSY');
  if(operatorConfirmed!==true||!equalToken(authorizationToken,pending?.token))
   hold('NO_EXACT_EXPLICIT_APPROVAL');
  const item=pending;
  pending=null;recent=null;
  if(clock()>item.until)hold('TOKEN_EXPIRED');
  if(hash(item.payload)!==item.hash)hold('PREPARED_PAYLOAD_CHANGED');
  busy=true;
  attempts++;
  try{
   let value;
   if(item.payload.kind.startsWith('ml_')){
    value=await ml.run({prompt:item.payload.prompt,data:item.payload.spec,operatorConfirmed:true});
    if(value?.state!=='completed'||value?.route!=='automatic_verified_ml'||
       value?.externalActions!==0||value?.verifiedML?.ok!==true)
      hold('ML_RESULT_NOT_ATTESTED');
   }else value=await runSolver(item.payload);
   const preview=JSON.stringify(value);
   if(preview.length>500000)hold('RESULT_TOO_LARGE');
   const receipt={version:COMPUTE_VERSION,kind:item.payload.kind,
    inputSha256:item.hash,resultSha256:createHash('sha256').update(preview).digest('hex'),
    source:item.payload.kind.startsWith('ml_')?'existing_ml_8801':'isolated_python_solver',
    state:'verified_local_result',completedAtUnixMs:clock(),
    operatorApproved:true,actionsExecuted:1,automaticRetries:0,
    limitations:'Local computation result, not a verified business forecast or autonomous action.'};
   receipt.receiptHash=hash(receipt);
   completed++;
   recent={kind:receipt.kind,state:receipt.state,receiptHash:receipt.receiptHash,
    evidencePreview:preview.slice(0,2400),operatorApproved:true};
   return {version:COMPUTE_VERSION,state:'verified_local_result',
    receipt,resultPreview:preview.slice(0,9500),truncated:preview.length>9500,
    executedActions:1,approvedByOperator:true};
  }catch(error){
   // The call may have been dispatched before a timeout or parse failure.
   // Never auto-retry the same operation or reuse the token.
   return {version:COMPUTE_VERSION,state:'outcome_unverified_no_retry',
     reason:String(error?.message||error).slice(0,180),
     submittedAttempt:true,executedActions:'unknown',approvalConsumed:true};
  }finally{busy=false}
 };
 return Object.freeze({
  status:info,
  prepare,
  confirm,
  cancel(){
   if(busy)hold('BUSY');
   pending=null;recent=null;
   return {version:COMPUTE_VERSION,state:'cancelled_no_execution',executedActions:0};
  },
  lastEvidence(){return recent?{...recent}:null},
  recommend(question){
   if(typeof question!=='string'||question.length>1200)return null;
   let kind=null;
   if(/\b(?:optuna|stock|inventory (?:level|optimization)|reorder level)\b/i.test(question))
    kind='optuna_inventory';
   else if(/\b(?:or.tools|ortools|vehicle routing|shortest route|route optimization|route planning)\b/i.test(question))
    kind='ortools_routing';
   else if(/\b(?:scikit|machine learning|training dataset|classification|regression model)\b/i.test(question))
    kind='ml_history';
   if(!kind)return null;
   return {kind,state:'suggestion_only',operatorApprovalRequired:true,
    datasetRequired:true,executionPerformed:false};
  }
 });
}
