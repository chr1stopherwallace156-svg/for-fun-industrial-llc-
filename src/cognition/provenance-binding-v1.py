import sqlite3,hashlib,json,uuid,datetime
def digest(data): return hashlib.sha256(data).hexdigest()
def schema(c):
 c.execute("CREATE TABLE IF NOT EXISTS provenance_bindings_v1 (id TEXT PRIMARY KEY,inspection_id TEXT NOT NULL,content_id TEXT NOT NULL,plan_id TEXT NOT NULL,task_id TEXT NOT NULL,content_sha256 TEXT NOT NULL,created_utc TEXT NOT NULL,UNIQUE(inspection_id,content_id))")
 c.execute("CREATE TRIGGER IF NOT EXISTS provenance_bindings_v1_no_update BEFORE UPDATE ON provenance_bindings_v1 BEGIN SELECT RAISE(ABORT,'BINDING_IMMUTABLE'); END")
 c.execute("CREATE TRIGGER IF NOT EXISTS provenance_bindings_v1_no_delete BEFORE DELETE ON provenance_bindings_v1 BEGIN SELECT RAISE(ABORT,'BINDING_IMMUTABLE'); END")
def check(c,inspection_id,content_id):
 i=c.execute("SELECT plan_id,task_id,inspection_json FROM source_inspections_v1 WHERE id=?",(inspection_id,)).fetchone()
 b=c.execute("SELECT plan_id,task_id,content_sha256,content_bytes FROM source_content_v1 WHERE id=?",(content_id,)).fetchone()
 if i is None or b is None: raise ValueError("BINDING_RECORD_NOT_FOUND")
 if i[0]!=b[0] or i[1]!=b[1]: raise ValueError("BINDING_TASK_MISMATCH")
 m=json.loads(i[2])
 if m.get("state")!="retrieved_unverified" or m.get("verification_status")!="source_retrieved_claims_unverified" or m.get("score_eligible") is not False: raise ValueError("BINDING_STATUS_INVALID")
 raw=bytes(b[3])
 if len(raw)>262144: raise ValueError("BINDING_CONTENT_TOO_LARGE")
 h=digest(raw)
 if h!=b[2] or h!=m.get("content_sha256") or len(raw)!=m.get("bytes"): raise ValueError("BINDING_INTEGRITY_MISMATCH")
 return i[0],i[1],h
def create_binding(database,inspection_id,content_id):
 c=sqlite3.connect(database,timeout=10)
 try:
  c.execute("BEGIN IMMEDIATE")
  schema(c)
  plan,task,h=check(c,inspection_id,content_id)
  identifier=str(uuid.uuid4())
  c.execute("INSERT INTO provenance_bindings_v1 VALUES (?,?,?,?,?,?,?)",(identifier,inspection_id,content_id,plan,task,h,datetime.datetime.now(datetime.timezone.utc).isoformat()))
  c.commit()
  return {"id":identifier,"state":"binding_persisted_unverified","content_sha256":h,"score_eligible":False,"external_actions":0}
 except:
  c.rollback()
  raise
 finally: c.close()
def verify_binding(database,binding_id):
 c=sqlite3.connect("file:"+database+"?mode=ro",uri=True)
 try:
  row=c.execute("SELECT inspection_id,content_id,plan_id,task_id,content_sha256 FROM provenance_bindings_v1 WHERE id=?",(binding_id,)).fetchone()
  if row is None: raise ValueError("BINDING_NOT_FOUND")
  plan,task,h=check(c,row[0],row[1])
  if (plan,task,h)!=(row[2],row[3],row[4]): raise ValueError("BINDING_SNAPSHOT_MISMATCH")
  return {"state":"binding_integrity_verified_claims_unverified","id":binding_id,"content_sha256":h,"content_integrity_verified":True,"source_authenticity_verified":False,"claims_verified":False,"score_eligible":False,"external_actions":0}
 finally: c.close()
