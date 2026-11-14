import {createHash} from "node:crypto";
import {validateEvidence} from "./evidence-records-v1.mjs";
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const host=u=>new URL(u).hostname.toLowerCase().replace(/^www\./,"");
export function assessEvidence(input){
if(!input||typeof input!=="object"||!Array.isArray(input.records)||input.records.length<1||input.records.length>32)throw Error("ASSESSMENT_INPUT_INVALID");
const records=input.records.map(validateEvidence);
const planId=records[0].plan_id;const taskId=records[0].task_id;const criterion=records[0].criterion;
if(records.some(x=>x.plan_id!==planId||x.task_id!==taskId||x.criterion!==criterion))throw Error("ASSESSMENT_TASK_MISMATCH");
const domains=[...new Set(records.map(x=>host(x.source_url)))];
const duplicateCount=records.length-new Set(records.map(x=>x.record_sha256)).size;
const dated=records.every(x=>Number.isFinite(Date.parse(x.observed_utc)));
const hasMultipleDomains=domains.length>=2;
const conflicts=[];
const scored=records.filter(x=>Number.isInteger(x.score));
if(scored.length>=2){const values=[...new Set(scored.map(x=>x.score))];if(values.length>1)conflicts.push("operator_supplied_scores_disagree")}
const checks={task_consistency:true,source_url_syntax:true,observation_dates_parseable:dated,multiple_source_domains:hasMultipleDomains,duplicate_records:duplicateCount,source_content_retrieved:false,source_authenticity_verified:false,independent_corroboration_verified:false};
const result={state:"assessment_complete_unverified",version:"7.7.2",plan_id:planId,task_id:taskId,criterion,record_count:records.length,distinct_domains:domains.length,checks,conflicts,verification_status:"unverified_requires_source_inspection",score_eligible:false,external_actions:0,operator_approval_required:true};
return {...result,assessment_sha256:hash(result)};
}
