// FUN_RAEM_001: resource admission and operator-gated scheduling. No process control.
export const DEFAULT_POLICY=Object.freeze({reserveMiB:1536,reserveFraction:0.20,cpuCeilingPct:85,maxConcurrent:1});
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const percent=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const known=(o,keys)=>Object.keys(o).every(k=>keys.includes(k));
export function validatePolicy(input={}){
 if(!plain(input)||!known(input,Object.keys(DEFAULT_POLICY)))throw Error('RAEM_POLICY_INVALID');
 const p={...DEFAULT_POLICY,...input};
 if(!integer(p.reserveMiB,0,1048576)||typeof p.reserveFraction!=='number'||!Number.isFinite(p.reserveFraction)||p.reserveFraction<0||p.reserveFraction>0.9||!percent(p.cpuCeilingPct)||!integer(p.maxConcurrent,1,8))throw Error('RAEM_POLICY_INVALID');
 return Object.freeze(p);
}
export function validateJob(input){
 if(!plain(input)||!known(input,['id','minimumMiB','targetMiB','maximumMiB','priority','refreshHours','firstDueMs','approvalRequired']))throw Error('RAEM_JOB_INVALID');
 const j={priority:5,refreshHours:null,firstDueMs:0,approvalRequired:true,...input};
 if(typeof j.id!=='string'||!(/^[a-z][a-z0-9_-]{1,47}$/).test(j.id)||!integer(j.minimumMiB,1,1048576)||!integer(j.targetMiB,j.minimumMiB,1048576)||!integer(j.maximumMiB,j.targetMiB,1048576)||!integer(j.priority,0,10)||!(j.refreshHours===null||integer(j.refreshHours,1,168))||!integer(j.firstDueMs,0,Number.MAX_SAFE_INTEGER)||j.approvalRequired!==true)throw Error('RAEM_JOB_INVALID');
 return Object.freeze(j);
}
export function evaluateAdmission(snapshot,job,policy=DEFAULT_POLICY){
 const p=validatePolicy(policy),j=validateJob(job);
 if(!plain(snapshot)||!known(snapshot,['totalMiB','freeMiB','cpuBusyPct','alreadyReservedMiB'])||!integer(snapshot.totalMiB,1,1048576)||!integer(snapshot.freeMiB,0,snapshot.totalMiB)||!percent(snapshot.cpuBusyPct)||!integer(snapshot.alreadyReservedMiB??0,0,1048576))throw Error('RAEM_SNAPSHOT_INVALID');
 const reserveMiB=Math.max(p.reserveMiB,Math.ceil(p.reserveFraction*snapshot.totalMiB));
 const headroomMiB=Math.max(0,snapshot.freeMiB-reserveMiB-(snapshot.alreadyReservedMiB??0));
 const base={reserveMiB,headroomMiB,requestedMiB:j.targetMiB};
 if(snapshot.cpuBusyPct>=p.cpuCeilingPct)return {...base,state:'HOLD',reason:'CPU_PRESSURE',grantedMiB:0};
 if(headroomMiB<j.minimumMiB)return {...base,state:'HOLD',reason:'MEMORY_PRESSURE',grantedMiB:0};
 return {...base,state:'GRANT',reason:headroomMiB<j.targetMiB?'REDUCED_BUDGET':'TARGET_MET',grantedMiB:Math.min(j.targetMiB,j.maximumMiB,headroomMiB)};
}
export class ResourceAwareManager{
 #jobs=new Map();#active=new Set();#policy;
 constructor(policy={}){this.#policy=validatePolicy(policy);}
 register(input){const j=validateJob(input);if(this.#jobs.has(j.id))throw Error('RAEM_DUPLICATE_JOB');this.#jobs.set(j.id,{spec:j,state:'queued',dueMs:j.firstDueMs,lastSuccessMs:null,lastFailureMs:null});return j.id;}
 status(){return [...this.#jobs.values()].map(v=>({id:v.spec.id,state:v.state,dueMs:v.dueMs,refreshHours:v.spec.refreshHours,lastSuccessMs:v.lastSuccessMs,lastFailureMs:v.lastFailureMs}));}
 plan(snapshot,nowMs=Date.now()){
  if(!integer(nowMs,0,Number.MAX_SAFE_INTEGER))throw Error('RAEM_TIME_INVALID');
  return [...this.#jobs.values()].filter(v=>v.state==='queued'&&v.dueMs<=nowMs).sort((a,b)=>b.spec.priority-a.spec.priority||a.dueMs-b.dueMs||a.spec.id.localeCompare(b.spec.id)).map(v=>({id:v.spec.id,requiresOperatorApproval:true,...evaluateAdmission({...snapshot,alreadyReservedMiB:(snapshot.alreadyReservedMiB??0)+[...this.#active].reduce((n,x)=>n+x.grantedMiB,0)},v.spec,this.#policy)}));
 }
 claim(id,snapshot,{nowMs=Date.now(),operatorApproved=false}={}){
  if(!integer(nowMs,0,Number.MAX_SAFE_INTEGER))throw Error('RAEM_TIME_INVALID');
  const v=this.#jobs.get(id);if(!v)throw Error('RAEM_UNKNOWN_JOB');
  if(v.state!=='queued'||v.dueMs>nowMs)return {state:'HOLD',reason:'NOT_DUE_OR_ACTIVE',grantedMiB:0};
  if(operatorApproved!==true)return {state:'HOLD',reason:'OPERATOR_APPROVAL_REQUIRED',grantedMiB:0};
  if(this.#active.size>=this.#policy.maxConcurrent)return {state:'HOLD',reason:'CONCURRENCY_LIMIT',grantedMiB:0};
  const reserved=[...this.#active].reduce((n,x)=>n+x.grantedMiB,0);
  const result=evaluateAdmission({...snapshot,alreadyReservedMiB:(snapshot.alreadyReservedMiB??0)+reserved},v.spec,this.#policy);
  if(result.state==='GRANT'){v.state='active';this.#active.add({id,grantedMiB:result.grantedMiB});}
  return result;
 }
 complete(id,{nowMs=Date.now(),success}={}){
  if(!integer(nowMs,0,Number.MAX_SAFE_INTEGER)||typeof success!=='boolean')throw Error('RAEM_COMPLETION_INVALID');
  const v=this.#jobs.get(id);if(!v||v.state!=='active')throw Error('RAEM_NOT_ACTIVE');
  for(const item of this.#active){if(item.id===id){this.#active.delete(item);break;}}
  if(!success){v.state='failed';v.lastFailureMs=nowMs;return 'FAILED_REVIEW_REQUIRED';}
  v.lastSuccessMs=nowMs;
  if(v.spec.refreshHours===null){v.state='completed';return 'COMPLETED';}
  v.dueMs=nowMs+v.spec.refreshHours*3600000;
  v.state='queued';return 'NEXT_RUN_SCHEDULED';
 }
 retryFailed(id,{operatorApproved=false,nowMs=Date.now()}={}){
  const v=this.#jobs.get(id);
  if(!v||v.state!=='failed'||operatorApproved!==true||!integer(nowMs,0,Number.MAX_SAFE_INTEGER))throw Error('RAEM_RETRY_DENIED');
  v.state='queued';v.dueMs=nowMs;return 'QUEUED';
 }
}
