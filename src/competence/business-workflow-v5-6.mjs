// Minimal deterministic business case workflow, inspired by common finite-state
// machine principles; intentionally no package or always-running Python runtime.
// No transition can authorize sending email, filing, payments, tool execution.
export const STATES=Object.freeze(['research','evidence_check','draft','operator_review','ready_for_approved_external_adapter','complete_with_receipt','hold']);
const ALLOWED=Object.freeze({
 research:['evidence_check','hold'],
 evidence_check:['draft','hold'],
 draft:['operator_review','hold'],
 operator_review:['ready_for_approved_external_adapter','hold'],
 ready_for_approved_external_adapter:['complete_with_receipt','hold'],
 complete_with_receipt:[],
 hold:['research']
});
function validActor(actor){
 if(!['system_local','operator_reviewed','verified_external_adapter'].includes(actor))
  throw Error('FIAL56_WORKFLOW_ACTOR_INVALID');
}
export function transitionCase(record,{to,actor,evidence_sha256,receipt_id=null,approval_id=null}={}){
 if(!record||typeof record!=='object'||Array.isArray(record)||
  typeof record.case_id!=='string'||!/^[a-zA-Z0-9_-]{3,80}$/.test(record.case_id)||
  !STATES.includes(record.state)||!STATES.includes(to))
  throw Error('FIAL56_CASE_INVALID');
 validActor(actor);
 if(!ALLOWED[record.state].includes(to))throw Error('FIAL56_ILLEGAL_STATE_TRANSITION');
 if(typeof evidence_sha256!=='string'||!/^[a-f0-9]{64}$/.test(evidence_sha256))
  throw Error('FIAL56_EVIDENCE_SHA_REQUIRED');
 if(to==='ready_for_approved_external_adapter'&&
  (actor!=='operator_reviewed'||!/^approval_[a-zA-Z0-9_-]{6,80}$/.test(approval_id||'')))
  throw Error('FIAL56_EXPLICIT_REVIEW_REQUIRED');
 if(to==='complete_with_receipt'&&
  (actor!=='verified_external_adapter'||!/^receipt_[a-zA-Z0-9_-]{6,80}$/.test(receipt_id||'')))
  throw Error('FIAL56_VERIFIED_RECEIPT_REQUIRED');
 // An approval ID is bookkeeping, NOT portable authority. External actions are
 // still separately unavailable in this engine until a strict adapter exists.
 return Object.freeze({...record,state:to,
  history:[...(Array.isArray(record.history)?record.history:[]).slice(-31),{
   from:record.state,to,actor,evidence_sha256,
   receipt_id:to==='complete_with_receipt'?receipt_id:null,
   approval_reference:to==='ready_for_approved_external_adapter'?approval_id:null
  }],external_action_executed:to==='complete_with_receipt',
  external_action_authorized_by_this_engine:false});
}
export function newBusinessCase(id,title,company='ELEKTRON INDUSTRIAL LLC'){
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{3,80}$/.test(id)||
  typeof title!=='string'||title.trim().length<5||title.length>240||
  !['ELEKTRON INDUSTRIAL LLC','Fun Industrial (software workspace)'].includes(company))
  throw Error('FIAL56_NEW_CASE_INVALID');
 return Object.freeze({case_id:id,title:title.trim(),company,state:'research',
  history:[],external_action_executed:false,
  external_action_authorized_by_this_engine:false});
}
