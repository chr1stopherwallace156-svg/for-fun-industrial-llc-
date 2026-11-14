import {persistSourceInspection} from "./source-inspection-storage-v1.mjs";
import {assessPersistedTask} from "./evidence-assessment-storage-v1.mjs";
export async function orchestrateEvidence({database,python,plan_id,task_id,url,operatorApproved=false,inspect}){
if(operatorApproved!==true)throw Error("OPERATOR_APPROVAL_REQUIRED");
if(typeof inspect!=="function")throw Error("INSPECTOR_REQUIRED");
if(!database||!python||!plan_id||!task_id||!url)throw Error("ORCHESTRATION_INPUT_INVALID");
const inspection=await inspect({url,operatorApproved:true});
if(inspection?.state!=="retrieved_unverified"||inspection?.source_url!==url||inspection?.score_eligible!==false||inspection?.verification_status!=="source_retrieved_claims_unverified")throw Error("INSPECTION_BOUNDARY_HOLD");
const stored=persistSourceInspection({database,python,plan_id,task_id,inspection});
const assessment=assessPersistedTask({database,python,plan_id,task_id});
return {state:"awaiting_source_verification",plan_id,task_id,source_inspection_id:stored.id,source_sha256:stored.content_sha256,assessment,source_score_eligible:false,source_claims_verified:false,external_actions_executed_by_orchestrator:0,inspection_reported_external_actions:inspection.external_actions};
}
