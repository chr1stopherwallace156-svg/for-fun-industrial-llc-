import {spawnSync} from "node:child_process";
import {assessEvidence} from "./evidence-verifier-v1.mjs";
const PY=String.raw`C:\Users\alxar\FunIndustrial-LangGraph-V1\.venv\Scripts\python.exe`;
const DB=String.raw`C:\Users\alxar\FunIndustrial-LangGraph-V1\evidence-plans-v1.sqlite`;
function python(code,input){const r=spawnSync(PY,["-c",code],{input:JSON.stringify(input),encoding:"utf8",timeout:15000,maxBuffer:1048576,windowsHide:true});if(r.error||r.status!==0)throw Error("ASSESSMENT_STORAGE_HOLD:"+(r.stderr||r.error?.message||r.status));return JSON.parse(r.stdout)}
export function assessPersistedTask({plan_id,task_id}){
if(typeof plan_id!=="string"||!/^[a-f0-9-]{36}$/i.test(plan_id)||typeof task_id!=="string"||!/^OP[1-8]-(DEMAND|MARGIN|FEASIBILITY|EVIDENCE)$/.test(task_id))throw Error("TASK_IDENTITY_INVALID");
const load=`import sys,json,sqlite3
p=json.loads(sys.stdin.read())
db=sqlite3.connect(${JSON.stringify(DB)})
try:
 plan=db.execute("SELECT plan_json FROM plans WHERE id=?",(p["plan_id"],)).fetchone()
 if not plan: raise ValueError("PLAN_NOT_FOUND")
 tasks=[t for o in json.loads(plan[0]).get("opportunities",[]) for t in o.get("tasks",[])]
 if not any(t.get("id")==p["task_id"] for t in tasks): raise ValueError("TASK_NOT_IN_PLAN")
 rows=db.execute("SELECT id,record_json FROM evidence_records_v1 WHERE plan_id=? AND task_id=? ORDER BY created_utc,id LIMIT 33",(p["plan_id"],p["task_id"])).fetchall()
 if not rows: raise ValueError("NO_EVIDENCE_RECORDS")
 if len(rows)>32: raise ValueError("EVIDENCE_RECORD_LIMIT")
 print(json.dumps({"ids":[x[0] for x in rows],"records":[json.loads(x[1]) for x in rows]}))
finally:
 db.close()`;
const loaded=python(load,{plan_id,task_id});
const assessment=assessEvidence({records:loaded.records.map(r=>r.score===null?Object.fromEntries(Object.entries(r).filter(([k])=>k!=="score")):r)});
const save=`import sys,json,sqlite3,uuid,datetime
p=json.loads(sys.stdin.read())
db=sqlite3.connect(${JSON.stringify(DB)},timeout=5)
try:
 db.execute("BEGIN IMMEDIATE")
 db.execute("CREATE TABLE IF NOT EXISTS evidence_assessments_v1 (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, task_id TEXT NOT NULL, assessment_sha256 TEXT NOT NULL, assessment_json TEXT NOT NULL, evidence_ids_json TEXT NOT NULL, created_utc TEXT NOT NULL)")
 i=str(uuid.uuid4())
 a=p["assessment"]
 db.execute("INSERT INTO evidence_assessments_v1 VALUES (?,?,?,?,?,?,?)",(i,a["plan_id"],a["task_id"],a["assessment_sha256"],json.dumps(a,sort_keys=True),json.dumps(p["ids"]),datetime.datetime.now(datetime.timezone.utc).isoformat()))
 db.commit()
 print(json.dumps({"state":"assessment_persisted","assessment_id":i,"assessment_sha256":a["assessment_sha256"],"evidence_count":len(p["ids"]),"verification_status":a["verification_status"],"score_eligible":False,"external_actions":0}))
except Exception:
 db.rollback()
 raise
finally:
 db.close()`;
return {...python(save,{assessment,ids:loaded.ids}),assessment};
}
