import sqlite3,hashlib,uuid,datetime,json,tempfile,pathlib,unittest,importlib.util
def sha(b): return hashlib.sha256(b).hexdigest()
def schema(c):
 c.execute("CREATE TABLE IF NOT EXISTS claim_provenance_v1 (id TEXT PRIMARY KEY,binding_id TEXT NOT NULL,byte_start INTEGER NOT NULL,byte_end INTEGER NOT NULL,passage_sha256 TEXT NOT NULL,claim_text TEXT NOT NULL,created_utc TEXT NOT NULL,UNIQUE(binding_id,byte_start,byte_end,passage_sha256))")
 c.execute("CREATE TRIGGER IF NOT EXISTS claim_provenance_v1_no_update BEFORE UPDATE ON claim_provenance_v1 BEGIN SELECT RAISE(ABORT,'CLAIM_IMMUTABLE'); END")
 c.execute("CREATE TRIGGER IF NOT EXISTS claim_provenance_v1_no_delete BEFORE DELETE ON claim_provenance_v1 BEGIN SELECT RAISE(ABORT,'CLAIM_IMMUTABLE'); END")
def checked_bytes(c,binding_id):
 r=c.execute("SELECT inspection_id,content_id,plan_id,task_id,content_sha256 FROM provenance_bindings_v1 WHERE id=?",(binding_id,)).fetchone()
 if r is None: raise ValueError("BINDING_NOT_FOUND")
 i=c.execute("SELECT plan_id,task_id,inspection_json FROM source_inspections_v1 WHERE id=?",(r[0],)).fetchone()
 b=c.execute("SELECT plan_id,task_id,content_sha256,content_bytes FROM source_content_v1 WHERE id=?",(r[1],)).fetchone()
 if i is None or b is None: raise ValueError("SOURCE_RECORD_NOT_FOUND")
 if (i[0],i[1])!=(r[2],r[3]) or (b[0],b[1])!=(r[2],r[3]): raise ValueError("TASK_MISMATCH")
 m=json.loads(i[2]);raw=bytes(b[3]);h=sha(raw)
 if len(raw)>262144 or h!=r[4] or h!=b[2] or h!=m.get("content_sha256") or len(raw)!=m.get("bytes"): raise ValueError("SOURCE_INTEGRITY_MISMATCH")
 if m.get("state")!="retrieved_unverified" or m.get("score_eligible") is not False or m.get("verification_status")!="source_retrieved_claims_unverified": raise ValueError("SOURCE_STATUS_INVALID")
 return raw,r
def create_claim(database,binding_id,claim_text,byte_start,byte_end):
 if not isinstance(claim_text,str) or not claim_text or len(claim_text)>1000 or type(byte_start)!=int or type(byte_end)!=int: raise ValueError("CLAIM_INPUT_INVALID")
 c=sqlite3.connect(database,timeout=10)
 try:
  c.execute("BEGIN IMMEDIATE");schema(c);raw,r=checked_bytes(c,binding_id)
  if byte_start<0 or byte_end<=byte_start or byte_end>len(raw): raise ValueError("CLAIM_RANGE_INVALID")
  passage=raw[byte_start:byte_end]
  if passage!=claim_text.encode("utf-8"): raise ValueError("CLAIM_PASSAGE_MISMATCH")
  identifier=str(uuid.uuid4())
  c.execute("INSERT INTO claim_provenance_v1 VALUES (?,?,?,?,?,?,?)",(identifier,binding_id,byte_start,byte_end,sha(passage),claim_text,datetime.datetime.now(datetime.timezone.utc).isoformat()))
  c.commit()
  return {"id":identifier,"state":"claim_provenance_persisted_unverified","passage_sha256":sha(passage),"textual_match":True,"claims_verified":False,"score_eligible":False,"external_actions":0}
 except: c.rollback();raise
 finally: c.close()
def verify_claim(database,claim_id):
 c=sqlite3.connect("file:"+database+"?mode=ro",uri=True)
 try:
  row=c.execute("SELECT binding_id,byte_start,byte_end,passage_sha256,claim_text FROM claim_provenance_v1 WHERE id=?",(claim_id,)).fetchone()
  if row is None: raise ValueError("CLAIM_NOT_FOUND")
  raw,r=checked_bytes(c,row[0]);a,b=row[1],row[2]
  if a<0 or b<=a or b>len(raw): raise ValueError("CLAIM_RANGE_INVALID")
  passage=raw[a:b]
  if sha(passage)!=row[3] or passage!=row[4].encode("utf-8"): raise ValueError("CLAIM_PROVENANCE_MISMATCH")
  return {"id":claim_id,"binding_id":row[0],"plan_id":r[2],"task_id":r[3],"byte_start":a,"byte_end":b,"passage_sha256":row[3],"state":"textual_provenance_verified_claims_unverified","content_integrity_verified":True,"source_authenticity_verified":False,"claims_verified":False,"score_eligible":False,"external_actions":0}
 finally: c.close()
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=str(pathlib.Path(self.tmp.name)/"fixture.sqlite");self.body=b"Fleet demand is not verified.";self.text="demand";self.a=self.body.index(b"demand");self.b=self.a+len(self.text)
  c=sqlite3.connect(self.db);c.execute("CREATE TABLE source_inspections_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,inspection_json TEXT)");c.execute("CREATE TABLE source_content_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,content_sha256 TEXT,content_bytes BLOB)")
  h=sha(self.body);m={"state":"retrieved_unverified","verification_status":"source_retrieved_claims_unverified","score_eligible":False,"content_sha256":h,"bytes":len(self.body)}
  c.execute("INSERT INTO source_inspections_v1 VALUES (?,?,?,?)",("inspection","plan","OP1-DEMAND",json.dumps(m)));c.execute("INSERT INTO source_content_v1 VALUES (?,?,?,?,?)",("content","plan","OP1-DEMAND",h,self.body));c.commit();c.close()
  spec=importlib.util.spec_from_file_location("binding_module",pathlib.Path(__file__).with_name("provenance-binding-v1.py"));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);self.binding=mod.create_binding(self.db,"inspection","content")["id"]
 def tearDown(self): self.tmp.cleanup()
 def save(self): return create_claim(self.db,self.binding,self.text,self.a,self.b)
 def test_create_and_verify(self):
  r=self.save();v=verify_claim(self.db,r["id"]);self.assertEqual(v["byte_start"],self.a);self.assertEqual(v["byte_end"],self.b);self.assertFalse(v["claims_verified"])
 def test_wrong_passage_rejected(self):
  with self.assertRaisesRegex(ValueError,"CLAIM_PASSAGE_MISMATCH"): create_claim(self.db,self.binding,"wrong",self.a,self.b)
 def test_wrong_range_rejected(self):
  with self.assertRaisesRegex(ValueError,"CLAIM_RANGE_INVALID"): create_claim(self.db,self.binding,self.text,-1,self.b)
 def test_duplicate_rejected(self):
  self.save()
  with self.assertRaises(sqlite3.IntegrityError): self.save()
 def test_tampering_detected(self):
  r=self.save();c=sqlite3.connect(self.db);c.execute("UPDATE source_content_v1 SET content_bytes=? WHERE id=?",(b"tampered","content"));c.commit();c.close()
  with self.assertRaisesRegex(ValueError,"SOURCE_INTEGRITY_MISMATCH"): verify_claim(self.db,r["id"])
 def test_missing_binding_rejected(self):
  with self.assertRaisesRegex(ValueError,"BINDING_NOT_FOUND"): create_claim(self.db,"missing",self.text,self.a,self.b)
if __name__=="__main__":
 result=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
 if not result.wasSuccessful(): raise SystemExit(1)
 print("STAGE784_TESTS=6/6")
 print("CLAIM_LEVEL_PROVENANCE=PASS")
 print("BYTE_RANGE_AND_HASH_VERIFICATION=PASS")
 print("TAMPER_AND_DUPLICATE_REJECTION=PASS")
 print("EXISTING_DATABASE_WRITES=0 REAL_NETWORK_REQUESTS=0")
