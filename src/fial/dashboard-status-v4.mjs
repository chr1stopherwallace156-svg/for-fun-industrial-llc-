// Dashboard status is a fixed-location, no-side-effect file read.
// It cannot launch FIAL, Qwen, REA, a network request or a service.
import {readFile,lstat} from "node:fs/promises";
import {join} from "node:path";
import {homedir} from "node:os";
const DEFAULT=join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),
 "FunIndustrial","RealApplicationWorkerV1");
export async function readFial4DashboardStatus({directory=DEFAULT}={}){
 try{
  const file=join(directory,"fial","grounded-v4","last-run.json");
  const stat=await lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>150000)
   throw Error("UNTRUSTED_STATUS_FILE");
  const receipt=JSON.parse(await readFile(file,"utf8"));
  if(receipt.version!=="fial-grounded-review-v0.4"||
    receipt.status!=="FIAL4_LOCAL_SOURCE_REVIEW_COMPLETE_NOT_ELIGIBILITY_PROOF"||
    receipt.network_requests!==0||receipt.model_requests!==0||
    receipt.rea_actions!==0||receipt.applications_submitted!==0||
    receipt.money_spent!==0||receipt.service_restarts!==0||
    receipt.verified_eligibilities!==0||receipt.semantic_entailments_proven!==0||
    !Array.isArray(receipt.cases)||receipt.cases.length>3)
   throw Error("UNTRUSTED_STATUS_RECEIPT");
  return {version:"fial4-dashboard-readonly-v0.4",state:"local_review_complete",
   cases:receipt.cases.map(x=>({grant_id:String(x.grant_id).slice(0,110),
    outcome:String(x.outcome).slice(0,110),claims_held:x.claims_held})),
   source_sha256:receipt.source_sha256,
   official_live_verification:"NOT_PERFORMED",
   company_eligibility:"UNKNOWN",proven_entailments:0,
   network_actions:0,rea_actions:0,submissions:0};
 }catch(e){
  return {version:"fial4-dashboard-readonly-v0.4",
   state:e?.code==="ENOENT"?"not_run":"hold",
   reason:e?.code==="ENOENT"?"NO_FIAL4_LOCAL_REPORT":"REVIEW_RECEIPT_UNAVAILABLE_OR_UNTRUSTED",
   company_eligibility:"UNKNOWN",submissions:0};
 }
}
