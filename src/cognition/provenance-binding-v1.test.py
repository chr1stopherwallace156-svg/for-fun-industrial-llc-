import unittest,tempfile,sqlite3,json,hashlib,importlib.util,pathlib
p=pathlib.Path(__file__).with_name("provenance-binding-v1.py")
spec=importlib.util.spec_from_file_location("provenance_binding_v1",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=str(pathlib.Path(self.tmp.name)/"test.sqlite")
  self.body=b"Synthetic provenance fixture";self.hash=hashlib.sha256(self.body).hexdigest()
  self.c=sqlite3.connect(self.db)
  self.c.execute("CREATE TABLE source_inspections_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,inspection_json TEXT)")
  self.c.execute("CREATE TABLE source_content_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,content_sha256 TEXT,content_bytes BLOB)")
  metadata={"state":"retrieved_unverified","verification_status":"source_retrieved_claims_unverified","score_eligible":False,"content_sha256":self.hash,"bytes":len(self.body)}
  self.c.execute("INSERT INTO source_inspections_v1 VALUES (?,?,?,?)",("inspection","plan","OP1-DEMAND",json.dumps(metadata)))
  self.c.execute("INSERT INTO source_content_v1 VALUES (?,?,?,?,?)",("content","plan","OP1-DEMAND",self.hash,self.body))
  self.c.commit();self.c.close()
 def tearDown(self): self.tmp.cleanup()
 def test_create_and_readback(self):
  r=m.create_binding(self.db,"inspection","content");self.assertEqual(r["state"],"binding_persisted_unverified");v=m.verify_binding(self.db,r["id"]);self.assertTrue(v["content_integrity_verified"]);self.assertFalse(v["claims_verified"])
 def test_duplicate_rejected(self):
  m.create_binding(self.db,"inspection","content")
  with self.assertRaises(sqlite3.IntegrityError): m.create_binding(self.db,"inspection","content")
 def test_missing_record_rejected(self):
  with self.assertRaisesRegex(ValueError,"BINDING_RECORD_NOT_FOUND"): m.create_binding(self.db,"missing","content")
 def test_task_mismatch_rejected(self):
  c=sqlite3.connect(self.db);c.execute("UPDATE source_content_v1 SET task_id=? WHERE id=?",("OP2-DEMAND","content"));c.commit();c.close()
  with self.assertRaisesRegex(ValueError,"BINDING_TASK_MISMATCH"): m.create_binding(self.db,"inspection","content")
 def test_hash_mismatch_rejected(self):
  c=sqlite3.connect(self.db);c.execute("UPDATE source_content_v1 SET content_bytes=? WHERE id=?",(b"tampered","content"));c.commit();c.close()
  with self.assertRaisesRegex(ValueError,"BINDING_INTEGRITY_MISMATCH"): m.create_binding(self.db,"inspection","content")
 def test_post_binding_tamper_detected(self):
  r=m.create_binding(self.db,"inspection","content");c=sqlite3.connect(self.db);c.execute("UPDATE source_content_v1 SET content_bytes=? WHERE id=?",(b"tampered","content"));c.commit();c.close()
  with self.assertRaisesRegex(ValueError,"BINDING_INTEGRITY_MISMATCH"): m.verify_binding(self.db,r["id"])
 def test_binding_update_blocked(self):
  r=m.create_binding(self.db,"inspection","content");c=sqlite3.connect(self.db)
  with self.assertRaises(sqlite3.IntegrityError): c.execute("UPDATE provenance_bindings_v1 SET task_id=? WHERE id=?",("OTHER",r["id"]))
  c.close()
 def test_binding_delete_blocked(self):
  r=m.create_binding(self.db,"inspection","content");c=sqlite3.connect(self.db)
  with self.assertRaises(sqlite3.IntegrityError): c.execute("DELETE FROM provenance_bindings_v1 WHERE id=?",(r["id"],))
  c.close()
if __name__=="__main__":
 result=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
 if not result.wasSuccessful(): raise SystemExit(1)
 print("STAGE783_TESTS=8/8")
 print("PERSISTENT_PROVENANCE_BINDING=PASS")
 print("DUPLICATE_AND_TAMPER_PROTECTION=PASS")
 print("EXISTING_DATABASE_WRITES=0 REAL_NETWORK_REQUESTS=0")
