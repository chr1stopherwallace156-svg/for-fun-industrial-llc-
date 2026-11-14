import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
const sha=b=>createHash("sha256").update(b).digest("hex");
const script=["import sqlite3,json,sys,base64","db,inspection_id,content_id=sys.argv[1:]","c=sqlite3.connect(\"file:\"+db+\"?mode=ro\",uri=True)","i=c.execute(\"SELECT plan_id,task_id,inspection_json FROM source_inspections_v1 WHERE id=?\",(inspection_id,)).fetchone()","b=c.execute(\"SELECT plan_id,task_id,content_sha256,content_bytes FROM source_content_v1 WHERE id=?\",(content_id,)).fetchone()","print(json.dumps({\"inspection\":({\"plan_id\":i[0],\"task_id\":i[1],\"metadata\":json.loads(i[2])} if i else None),\"content\":({\"plan_id\":b[0],\"task_id\":b[1],\"sha256\":b[2],\"base64\":base64.b64encode(b[3]).decode(\"ascii\")} if b else None)}))","c.close()"].join("\n");
export function verifyInspectionContentBinding({database,python,inspection_id,content_id}){
if(![database,python,inspection_id,content_id].every(x=>typeof x==="string"&&x.trim()))throw Error("BINDING_INPUT_INVALID");
const p=spawnSync(python,["-c",script,database,inspection_id,content_id],{encoding:"utf8",timeout:15000,maxBuffer:1048576});
if(p.status!==0)throw Error("BINDING_READ_HOLD: "+String(p.stderr||p.error||"unknown").slice(0,300));
const x=JSON.parse(p.stdout);if(!x.inspection||!x.content)throw Error("BINDING_RECORD_NOT_FOUND");
const i=x.inspection,b=x.content,m=i.metadata;
if(i.plan_id!==b.plan_id||i.task_id!==b.task_id)throw Error("BINDING_TASK_MISMATCH");
if(m.state!=="retrieved_unverified"||m.score_eligible!==false||m.verification_status!=="source_retrieved_claims_unverified")throw Error("BINDING_INSPECTION_STATUS_INVALID");
if(typeof b.base64!=="string"||!Buffer.from(b.base64,"base64").toString("base64")===b.base64)throw Error("BINDING_CONTENT_ENCODING_INVALID");
const bytes=Buffer.from(b.base64,"base64");if(bytes.length>262144)throw Error("BINDING_CONTENT_TOO_LARGE");
const actual=sha(bytes);if(actual!==b.sha256)throw Error("BINDING_STORED_CONTENT_HASH_MISMATCH");
if(actual!==m.content_sha256)throw Error("BINDING_INSPECTION_HASH_MISMATCH");
if(m.bytes!==bytes.length)throw Error("BINDING_BYTE_LENGTH_MISMATCH");
return {state:"content_binding_verified_claims_unverified",inspection_id,content_id,plan_id:i.plan_id,task_id:i.task_id,content_sha256:actual,bytes:bytes.length,content_integrity_verified:true,source_authenticity_verified:false,claims_verified:false,score_eligible:false,external_actions:0};
}
