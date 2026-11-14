import {spawnSync} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
const sha=b=>createHash("sha256").update(b).digest("hex");
const script=["import sqlite3,json,sys,base64,hashlib,uuid,datetime","x=json.load(sys.stdin)","b=base64.b64decode(x[\"content_base64\"],validate=True)","if len(b)>262144: raise ValueError(\"SOURCE_CONTENT_TOO_LARGE\")","h=hashlib.sha256(b).hexdigest()","if h!=x[\"expected_sha256\"]: raise ValueError(\"SOURCE_HASH_MISMATCH\")","c=sqlite3.connect(x[\"database\"],timeout=10)","c.execute(\"PRAGMA busy_timeout=10000\")","p=c.execute(\"SELECT plan_json FROM plans WHERE id=?\",(x[\"plan_id\"],)).fetchone()","if p is None: raise ValueError(\"SOURCE_PLAN_NOT_FOUND\")","plan=json.loads(p[0])","tasks=[t for o in plan.get(\"opportunities\",[]) for t in o.get(\"tasks\",[])]","if not any(t.get(\"id\")==x[\"task_id\"] for t in tasks): raise ValueError(\"SOURCE_TASK_NOT_FOUND\")","c.execute(\"CREATE TABLE IF NOT EXISTS source_content_v1 (id TEXT PRIMARY KEY,plan_id TEXT NOT NULL,task_id TEXT NOT NULL,content_sha256 TEXT NOT NULL,content_bytes BLOB NOT NULL,created_utc TEXT NOT NULL)\")","i=str(uuid.uuid4())","c.execute(\"INSERT INTO source_content_v1 VALUES (?,?,?,?,?,?)\",(i,x[\"plan_id\"],x[\"task_id\"],h,b,datetime.datetime.now(datetime.timezone.utc).isoformat()))","c.commit()","print(json.dumps({\"id\":i,\"content_sha256\":h,\"bytes\":len(b),\"state\":\"content_preserved_unverified\",\"score_eligible\":False,\"external_actions\":0}))","c.close()"].join("\n");
export function preserveSourceContent({database,python,plan_id,task_id,content,expected_sha256}){
if(!database||!python||!plan_id||!task_id||!Buffer.isBuffer(content)||!/^[a-f0-9]{64}$/.test(expected_sha256))throw Error("SOURCE_CONTENT_INPUT_INVALID");
if(content.length>262144)throw Error("SOURCE_CONTENT_TOO_LARGE");
if(sha(content)!==expected_sha256)throw Error("SOURCE_HASH_MISMATCH");
const p=spawnSync(python,["-c",script],{input:JSON.stringify({database,plan_id,task_id,content_base64:content.toString("base64"),expected_sha256}),encoding:"utf8",timeout:15000,maxBuffer:1048576});
if(p.status!==0)throw Error("SOURCE_CONTENT_STORAGE_HOLD: "+String(p.stderr||p.error||"unknown").slice(0,500));
return JSON.parse(p.stdout)}
export function locateClaimBytes({content,claim}){
if(!Buffer.isBuffer(content)||typeof claim!=="string"||!claim.length)throw Error("CLAIM_INPUT_INVALID");
const needle=Buffer.from(claim,"utf8");const offset=content.indexOf(needle);
return {state:offset>=0?"exact_bytes_match_unverified":"claim_not_found",byte_start:offset>=0?offset:null,byte_end:offset>=0?offset+needle.length:null,content_sha256:sha(content),claim_sha256:sha(needle),textual_match:offset>=0,independently_verified:false,score_eligible:false,external_actions:0};
}
