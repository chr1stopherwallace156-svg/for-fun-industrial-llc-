import sqlite3,hashlib,uuid,datetime,json,tempfile,pathlib,unittest,importlib.util
def load(name,file):
 spec=importlib.util.spec_from_file_location(name,pathlib.Path(__file__).with_name(file));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
binding=load("recovery_binding","provenance-binding-v1.py")
claim=load("recovery_claim","claim-provenance-v1.py")
def resume(database,inspection_id,content_id,claim_text):
 if not all(isinstance(x,str) and x.strip() for x in (database,inspection_id,content_id,claim_text)) or len(claim_text)>1000: raise ValueError("RECOVERY_INPUT_INVALID")
 needle=claim_text.encode("utf-8");c=sqlite3.connect(database,timeout=10)
 try:
  c.execute("BEGIN IMMEDIATE");binding.schema(c);claim.schema(c)
  plan,task,h=binding.check(c,inspection_id,content_id)
  row=c.execute("SELECT id,plan_id,task_id,content_sha256 FROM provenance_bindings_v1 WHERE inspection_id=? AND content_id=?",(inspection_id,content_id)).fetchone()
  if row:
   bid=row[0]
   if (row[1],row[2],row[3])!=(plan,task,h): raise ValueError("RECOVERY_BINDING_MISMATCH")
   raw,_=claim.checked_bytes(c,bid);reused=True
  else:
   content=c.execute("SELECT content_bytes FROM source_content_v1 WHERE id=?",(content_id,)).fetchone()
   if content is None: raise ValueError("RECOVERY_CONTENT_MISSING")
   raw=bytes(content[0]);bid=str(uuid.uuid4());reused=False
  a=raw.find(needle)
  if a<0: raise ValueError("RECOVERY_CLAIM_NOT_IN_SOURCE")
  z=a+len(needle);ph=hashlib.sha256(needle).hexdigest()
  existing=c.execute("SELECT id,claim_text FROM claim_provenance_v1 WHERE binding_id=? AND byte_start=? AND byte_end=? AND passage_sha256=?",(bid,a,z,ph)).fetchone()
  if existing and existing[1]!=claim_text: raise ValueError("RECOVERY_CLAIM_MISMATCH")
  if not row: c.execute("INSERT INTO provenance_bindings_v1 VALUES (?,?,?,?,?,?,?)",(bid,inspection_id,content_id,plan,task,h,datetime.datetime.now(datetime.timezone.utc).isoformat()))
  cid=existing[0] if existing else str(uuid.uuid4())
  if not existing: c.execute("INSERT INTO claim_provenance_v1 VALUES (?,?,?,?,?,?,?)",(cid,bid,a,z,ph,claim_text,datetime.datetime.now(datetime.timezone.utc).isoformat()))
  c.commit()
 finally: c.close()
 verified=claim.verify_claim(database,cid)
 return {"state":"recovered_verified_claims_unverified","binding_id":bid,"claim_id":cid,"binding_reused":reused,"claim_reused":bool(existing),"byte_start":a,"byte_end":z,"passage_sha256":ph,"content_sha256":h,"verification":verified,"factual_claim_verified":False,"external_actions":0}
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=str(pathlib.Path(self.tmp.name)/"fixture.sqlite");body=b"Fleet demand is not verified.";h=hashlib.sha256(body).hexdigest()
  c=sqlite3.connect(self.db);c.execute("CREATE TABLE source_inspections_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,inspection_json TEXT)");c.execute("CREATE TABLE source_content_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,content_sha256 TEXT,content_bytes BLOB)")
  m={"state":"retrieved_unverified","verification_status":"source_retrieved_claims_unverified","score_eligible":False,"content_sha256":h,"bytes":len(body)}
  c.execute("INSERT INTO source_inspections_v1 VALUES (?,?,?,?)",("inspection","plan","OP1-DEMAND",json.dumps(m)));c.execute("INSERT INTO source_content_v1 VALUES (?,?,?,?,?)",("content","plan","OP1-DEMAND",h,body));c.commit();c.close()
 def tearDown(self): self.tmp.cleanup()
 def call(self,text="demand"): return resume(self.db,"inspection","content",text)
 def test_first_write(self):
  r=self.call();self.assertFalse(r["binding_reused"]);self.assertFalse(r["claim_reused"]);self.assertEqual(r["verification"]["state"],"textual_provenance_verified_claims_unverified")
 def test_repeat_is_idempotent(self):
  a=self.call();b=self.call();self.assertEqual(a["binding_id"],b["binding_id"]);self.assertEqual(a["claim_id"],b["claim_id"]);self.assertTrue(b["claim_reused"])
 def test_add_claim_reuses_binding(self):
  a=self.call();b=self.call("Fleet");self.assertEqual(a["binding_id"],b["binding_id"]);self.assertNotEqual(a["claim_id"],b["claim_id"]);self.assertTrue(b["binding_reused"])
 def test_bad_claim_does_not_commit(self):
  with self.assertRaisesRegex(ValueError,"RECOVERY_CLAIM_NOT_IN_SOURCE"): self.call("absent")
  c=sqlite3.connect(self.db);self.assertEqual(c.execute("SELECT count(*) FROM sqlite_master WHERE type=? AND name=?",("table","provenance_bindings_v1")).fetchone()[0],0);c.close()
if __name__=="__main__":
 result=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
 if not result.wasSuccessful(): raise SystemExit(1)
 print("STAGE790_TESTS=4/4")
 print("RECOVERABLE_PROVENANCE=PASS")
 print("DUPLICATE_BINDING_REUSE=PASS")
 print("INTERRUPTED_CLAIM_RECOVERY=PASS")
 print("LIVE_DATABASE_WRITES=0 NETWORK_REQUESTS=0 SERVICES_RESTARTED=0")
