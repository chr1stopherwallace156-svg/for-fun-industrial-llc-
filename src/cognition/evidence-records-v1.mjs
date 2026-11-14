import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
const PY=String.raw`C:\Users\alxar\FunIndustrial-LangGraph-V1\.venv\Scripts\python.exe`;
const DB=String.raw`C:\Users\alxar\FunIndustrial-LangGraph-V1\evidence-plans-v1.sqlite`;
const CRITERIA=new Set(["demand","margin","feasibility","evidence"]);
const sha=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function validateEvidence(x){
if(!x||typeof x!=="object"||Array.isArray(x))throw Error("EVIDENCE_INVALID");
if(typeof x.plan_id!=="string"||!/^[a-f0-9-]{36}$/i.test(x.plan_id))throw Error("PLAN_ID_INVALID");
if(typeof x.task_id!=="string"||!/^OP[1-8]-(DEMAND|MARGIN|FEASIBILITY|EVIDENCE)$/.test(x.task_id))throw Error("TASK_ID_INVALID");
if(!CRITERIA.has(x.criterion)||!x.task_id.endsWith("-"+x.criterion.toUpperCase()))throw Error("CRITERION_INVALID");
if(typeof x.source_url!=="string"||x.source_url.length>2048)throw Error("SOURCE_URL_INVALID");
let u;try{u=new URL(x.source_url)}catch{throw Error("SOURCE_URL_INVALID")}
if(!["https:","http:"].includes(u.protocol)||!u.hostname||u.username||u.password)throw Error("SOURCE_URL_INVALID");
for(const k of ["title","observation"]){if(typeof x[k]!=="string"||!x[k].trim()||x[k].length>4000)throw Error("EVIDENCE_TEXT_INVALID")}
if(typeof x.observed_utc!=="string"||!/^20\d\d-\d\d-\d\dT/.test(x.observed_utc)||!Number.isFinite(Date.parse(x.observed_utc)))throw Error("EVIDENCE_DATE_INVALID");
if(x.score!==undefined&&(!Number.isInteger(x.score)||x.score<0||x.score>10))throw Error("EVIDENCE_SCORE_INVALID");
const record={plan_id:x.plan_id,task_id:x.task_id,criterion:x.criterion,source_url:u.href,title:x.title.trim(),observation:x.observation.trim(),observed_utc:x.observed_utc,score:x.score??null,verification_status:"unverified_operator_submission",external_actions:0};
return {...record,record_sha256:sha(record)};
}
export function persistEvidenceRecord(input){
const record=validateEvidence(input);
const code=`import sys,json,sqlite3,uuid,datetime
p=json.loads(sys.stdin.read())
db=sqlite3.connect(${JSON.stringify(DB)},timeout=5)
try:
 db.execute("BEGIN IMMEDIATE")
 row=db.execute("SELECT plan_json FROM plans WHERE id=?",(p["plan_id"],)).fetchone()
 if not row: raise ValueError("PLAN_NOT_FOUND")
 plan=json.loads(row[0])
 tasks=[t for o in plan.get("opportunities",[]) for t in o.get("tasks",[])]
 if not any(t.get("id")==p["task_id"] and t.get("criterion")==p["criterion"] for t in tasks): raise ValueError("TASK_NOT_IN_PLAN")
 db.execute("CREATE TABLE IF NOT EXISTS evidence_records_v1 (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, task_id TEXT NOT NULL, record_sha256 TEXT NOT NULL, record_json TEXT NOT NULL, created_utc TEXT NOT NULL)")
 i=str(uuid.uuid4())
 db.execute("INSERT INTO evidence_records_v1 VALUES (?,?,?,?,?,?)",(i,p["plan_id"],p["task_id"],p["record_sha256"],json.dumps(p,sort_keys=True),datetime.datetime.now(datetime.timezone.utc).isoformat()))
 db.commit()
 print(json.dumps({"state":"persisted_unverified","record_id":i,"plan_id":p["plan_id"],"record_sha256":p["record_sha256"],"verification_status":"unverified_operator_submission","external_actions":0}))
except Exception:
 db.rollback()
 raise
finally:
 db.close()`;
const result=spawnSync(PY,["-c",code],{input:JSON.stringify(record),encoding:"utf8",timeout:15000,maxBuffer:1048576,windowsHide:true});
if(result.error||result.status!==0)throw Error("EVIDENCE_PERSISTENCE_HOLD:"+(result.stderr||result.error?.message||result.status));
return JSON.parse(result.stdout);
}
