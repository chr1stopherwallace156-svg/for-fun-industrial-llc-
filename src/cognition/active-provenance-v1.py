import sqlite3,hashlib,json,uuid,datetime,pathlib,importlib.util,tempfile,unittest
def load(name,file):
 spec=importlib.util.spec_from_file_location(name,pathlib.Path(__file__).with_name(file));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
binding=load("fun_binding","provenance-binding-v1.py")
claim=load("fun_claim","claim-provenance-v1.py")
def activate(database,inspection_id,content_id,claim_text):
 if not isinstance(claim_text,str) or not claim_text or len(claim_text)>1000: raise ValueError("CLAIM_INPUT_INVALID")
 needle=claim_text.encode("utf-8")
 c=sqlite3.connect(database,timeout=10)
 try:
  c.execute("BEGIN IMMEDIATE");binding.schema(c);claim.schema(c)
  plan,task,h=binding.check(c,inspection_id,content_id)
  raw,r=claim.checked_bytes(c, "__not_created__") if False else (None,None)
  row=c.execute("SELECT content_bytes FROM source_content_v1 WHERE id=?",(content_id,)).fetchone()
  if row is None: raise ValueError("CONTENT_NOT_FOUND")
  raw=bytes(row[0]);start=raw.find(needle)
  if start<0: raise ValueError("CLAIM_NOT_IN_SOURCE")
  end=start+len(needle);bid=str(uuid.uuid4());cid=str(uuid.uuid4());now=datetime.datetime.now(datetime.timezone.utc).isoformat()
  c.execute("INSERT INTO provenance_bindings_v1 VALUES (?,?,?,?,?,?,?)",(bid,inspection_id,content_id,plan,task,h,now))
  c.execute("INSERT INTO claim_provenance_v1 VALUES (?,?,?,?,?,?,?)",(cid,bid,start,end,hashlib.sha256(needle).hexdigest(),claim_text,now))
  c.commit()
  return {"state":"active_provenance_committed","binding_id":bid,"claim_id":cid,"plan_id":plan,"task_id":task,"passage":claim_text,"byte_start":start,"byte_end":end,"content_sha256":h,"passage_sha256":hashlib.sha256(needle).hexdigest(),"factual_claim_verified":False,"source_authenticity_verified":False,"score_eligible":False,"external_actions":0}
 except: c.rollback();raise
 finally: c.close()
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=str(pathlib.Path(self.tmp.name)/"fixture.sqlite");self.body=b"Fleet demand is not verified.";h=hashlib.sha256(self.body).hexdigest()
  c=sqlite3.connect(self.db);c.execute("CREATE TABLE source_inspections_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,inspection_json TEXT)");c.execute("CREATE TABLE source_content_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,content_sha256 TEXT,content_bytes BLOB)")
  meta={"state":"retrieved_unverified","verification_status":"source_retrieved_claims_unverified","score_eligible":False,"content_sha256":h,"bytes":len(self.body)}
  c.execute("INSERT INTO source_inspections_v1 VALUES (?,?,?,?)",("inspection","plan","OP1-DEMAND",json.dumps(meta)));c.execute("INSERT INTO source_content_v1 VALUES (?,?,?,?,?)",("content","plan","OP1-DEMAND",h,self.body));c.commit();c.close()
 def tearDown(self): self.tmp.cleanup()
 def count(self,table):
  c=sqlite3.connect(self.db);n=c.execute("SELECT count(*) FROM "+table).fetchone()[0] if c.execute("SELECT 1 FROM sqlite_master WHERE type=? AND name=?",("table",table)).fetchone() else 0;c.close();return n
 def test_active_write(self):
  r=activate(self.db,"inspection","content","demand");self.assertEqual(r["state"],"active_provenance_committed");self.assertEqual(self.count("provenance_bindings_v1"),1);self.assertEqual(self.count("claim_provenance_v1"),1)
 def test_verified_readback(self):
  r=activate(self.db,"inspection","content","demand");self.assertTrue(binding.verify_binding(self.db,r["binding_id"])["content_integrity_verified"]);self.assertEqual(claim.verify_claim(self.db,r["claim_id"])["byte_start"],r["byte_start"])
 def test_missing_claim_rolls_back(self):
  with self.assertRaisesRegex(ValueError,"CLAIM_NOT_IN_SOURCE"): activate(self.db,"inspection","content","absent")
  self.assertEqual(self.count("provenance_bindings_v1"),0);self.assertEqual(self.count("claim_provenance_v1"),0)
 def test_duplicate_rolls_back(self):
  activate(self.db,"inspection","content","demand")
  with self.assertRaises(sqlite3.IntegrityError): activate(self.db,"inspection","content","Fleet")
  self.assertEqual(self.count("provenance_bindings_v1"),1);self.assertEqual(self.count("claim_provenance_v1"),1)
 def test_tampered_source_rejected(self):
  c=sqlite3.connect(self.db);c.execute("UPDATE source_content_v1 SET content_bytes=? WHERE id=?",(b"tampered","content"));c.commit();c.close()
  with self.assertRaisesRegex(ValueError,"BINDING_INTEGRITY_MISMATCH"): activate(self.db,"inspection","content","tampered")
 def test_no_factual_authority(self):
  r=activate(self.db,"inspection","content","demand");self.assertFalse(r["factual_claim_verified"]);self.assertFalse(r["source_authenticity_verified"]);self.assertFalse(r["score_eligible"]);self.assertEqual(r["external_actions"],0)
if __name__=="__main__":
 result=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
 if not result.wasSuccessful(): raise SystemExit(1)
 print("STAGE786_TESTS=6/6")
 print("ACTIVE_SQLITE_TRANSACTION=PASS")
 print("BINDING_AND_CLAIM_WRITES=PASS")
 print("ATOMIC_ROLLBACK=PASS")
 print("PROVENANCE_READBACK=PASS")
 print("EXISTING_DATABASE_WRITES=0 SERVICES_RESTARTED=0 EXTERNAL_ACTIONS=0")
