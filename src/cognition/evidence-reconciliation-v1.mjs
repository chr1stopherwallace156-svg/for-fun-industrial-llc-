import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
const sha=s=>createHash("sha256").update(s).digest("hex");
const script=["import sqlite3,json,sys","db,inspection_id=sys.argv[1:]","c=sqlite3.connect(\"file:\"+db+\"?mode=ro\",uri=True)","r=c.execute(\"SELECT id,plan_id,task_id,inspection_json FROM source_inspections_v1 WHERE id=?\",(inspection_id,)).fetchone()","print(json.dumps({\"id\":r[0],\"plan_id\":r[1],\"task_id\":r[2],\"inspection\":json.loads(r[3])} if r else None))","c.close()"].join("\n");
export function reconcileSourceClaim({database,python,inspection_id,plan_id,task_id,claim}){
if(![database,python,inspection_id,plan_id,task_id,claim].every(x=>typeof x==="string"&&x.trim()))throw Error("RECONCILIATION_INPUT_INVALID");
if(claim.length>1000)throw Error("CLAIM_TOO_LARGE");
const p=spawnSync(python,["-c",script,database,inspection_id],{encoding:"utf8",timeout:15000,maxBuffer:1048576});
if(p.status!==0)throw Error("RECONCILIATION_READ_HOLD");
const row=JSON.parse(p.stdout);if(!row)throw Error("SOURCE_INSPECTION_NOT_FOUND");
if(row.plan_id!==plan_id||row.task_id!==task_id)throw Error("SOURCE_TASK_MISMATCH");
const r=row.inspection;
if(r.state!=="retrieved_unverified"||r.verification_status!=="source_retrieved_claims_unverified"||r.score_eligible!==false||!/^[a-f0-9]{64}$/.test(r.content_sha256)||typeof r.excerpt!=="string")throw Error("SOURCE_METADATA_INVALID");
const supported=r.excerpt.includes(claim);
return {state:supported?"text_match_unverified":"claim_not_found",plan_id,task_id,inspection_id,source_url:r.source_url,source_content_sha256:r.content_sha256,claim_sha256:sha(claim),textual_match:supported,match_scope:"stored_excerpt_only",full_source_hash_recomputed:false,independently_verified:false,score_eligible:false,external_actions:0};
}
