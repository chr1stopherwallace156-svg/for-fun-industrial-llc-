import {retrieveApprovedPage} from "./approved-single-page-retrieval-v1.mjs";
import {activateEvidenceWorkflow} from "./active-evidence-orchestrator-v1.mjs";

// Call only after a separate, explicit operator approval for this URL.
// Retrieval occurs exactly once; the orchestrator consumes captured bytes.
export async function collectApprovedSource({database,python,plan_id,task_id,url,operatorApproved=false}) {
  if(operatorApproved!==true)throw Error("OPERATOR_APPROVAL_REQUIRED");
  const captured=await retrieveApprovedPage({url,operatorApproved:true});
  try{
    const result=await activateEvidenceWorkflow({
      database,python,plan_id,task_id,url,operatorApproved:true,
      claim_text:captured.claim_text,
      inspect:async({url:requested,operatorApproved:approved})=>{
        if(approved!==true||requested!==url)throw Error("INSPECTION_APPROVAL_MISMATCH");
        return captured.inspection;
      }
    });
    return {...result,retrieval_count:1,redirects_followed:0,links_crawled:0};
  }catch(error){
    throw Error("COLLECTION_INCOMPLETE_CHECK_SQLITE_RECORDS: "+String(error.message||error).slice(0,350));
  }
}
