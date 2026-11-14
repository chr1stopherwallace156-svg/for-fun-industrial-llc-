import sqlite3,hashlib,json,importlib.util,pathlib,tempfile,unittest
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def package_claim(database,claim_id):
 if not isinstance(claim_id,str) or not claim_id.strip(): raise ValueError("CLAIM_ID_INVALID")
 module=load("claim_provenance",pathlib.Path(__file__).with_name("claim-provenance-v1.py"))
 c=sqlite3.connect("file:"+pathlib.Path(database).resolve().as_posix()+"?mode=ro",uri=True)
 try:
  c.execute("BEGIN")
  row=c.execute("SELECT binding_id,byte_start,byte_end,passage_sha256,claim_text FROM claim_provenance_v1 WHERE id=?",(claim_id,)).fetchone()
  if row is None: raise ValueError("CLAIM_NOT_FOUND")
  raw,binding=module.checked_bytes(c,row[0])
  a,z=row[1],row[2]
  if type(a)!=int or type(z)!=int or a<0 or z<=a or z>len(raw): raise ValueError("CLAIM_RANGE_INVALID")
  passage=raw[a:z]
  if hashlib.sha256(passage).hexdigest()!=row[3] or passage!=row[4].encode("utf-8"): raise ValueError("CLAIM_PROVENANCE_MISMATCH")
  inspection=c.execute("SELECT inspection_json FROM source_inspections_v1 WHERE id=?",(binding[0],)).fetchone()
  if inspection is None: raise ValueError("INSPECTION_NOT_FOUND")
  metadata=json.loads(inspection[0]);url=metadata.get("source_url")
  if not isinstance(url,str) or not url.startswith(("https://","http://")): raise ValueError("SOURCE_URL_MISSING")
  return {"state":"grounded_textual_evidence_unverified","claim_id":claim_id,"binding_id":row[0],"inspection_id":binding[0],"content_id":binding[1],"plan_id":binding[2],"task_id":binding[3],"source_url_untrusted":url,"passage":passage.decode("utf-8"),"byte_start":a,"byte_end":z,"passage_sha256":row[3],"content_sha256":binding[4],"citation_label":"[source:"+claim_id+"]","source_authenticity_verified":False,"factual_claim_verified":False,"score_eligible":False,"external_actions":0}
 finally: c.close()
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=str(pathlib.Path(self.tmp.name)/"fixture.sqlite");self.body=b"Fleet demand is not verified.";self.text="demand"
  self.a=self.body.index(b"demand");self.z=self.a+len(self.text);h=hashlib.sha256(self.body).hexdigest()
  c=sqlite3.connect(self.db)
  c.execute("CREATE TABLE source_inspections_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,inspection_json TEXT)")
  c.execute("CREATE TABLE source_content_v1 (id TEXT PRIMARY KEY,plan_id TEXT,task_id TEXT,content_sha256 TEXT,content_bytes BLOB)")
  meta={"state":"retrieved_unverified","verification_status":"source_retrieved_claims_unverified","score_eligible":False,"content_sha256":h,"bytes":len(self.body),"source_url":"https://example.org/source"}
  c.execute("INSERT INTO source_inspections_v1 VALUES (?,?,?,?)",("inspection","plan","OP1-DEMAND",json.dumps(meta)))
  c.execute("INSERT INTO source_content_v1 VALUES (?,?,?,?,?)",("content","plan","OP1-DEMAND",h,self.body))
  c.commit();c.close()
  folder=pathlib.Path(__file__).parent
  b=load("binding_module",folder/"provenance-binding-v1.py");p=load("claim_module",folder/"claim-provenance-v1.py")
  self.binding=b.create_binding(self.db,"inspection","content")["id"]
  self.claim=p.create_claim(self.db,self.binding,self.text,self.a,self.z)["id"]
 def tearDown(self): self.tmp.cleanup()
 def test_package(self):
  r=package_claim(self.db,self.claim);self.assertEqual(r["passage"],"demand");self.assertEqual((r["byte_start"],r["byte_end"]),(self.a,self.z))
 def test_citation_identity(self):
  r=package_claim(self.db,self.claim);self.assertEqual(r["citation_label"],"[source:"+self.claim+"]");self.assertEqual(r["task_id"],"OP1-DEMAND")
 def test_no_authority(self):
  r=package_claim(self.db,self.claim);self.assertFalse(r["factual_claim_verified"]);self.assertFalse(r["source_authenticity_verified"]);self.assertFalse(r["score_eligible"]);self.assertEqual(r["external_actions"],0)
 def test_missing_claim(self):
  with self.assertRaisesRegex(ValueError,"CLAIM_NOT_FOUND"): package_claim(self.db,"missing")
 def test_tampered_content(self):
  c=sqlite3.connect(self.db);c.execute("UPDATE source_content_v1 SET content_bytes=? WHERE id=?",(b"tampered","content"));c.commit();c.close()
  with self.assertRaisesRegex(ValueError,"SOURCE_INTEGRITY_MISMATCH"): package_claim(self.db,self.claim)
 def test_missing_source_url(self):
  c=sqlite3.connect(self.db);r=c.execute("SELECT inspection_json FROM source_inspections_v1 WHERE id=?",("inspection",)).fetchone();m=json.loads(r[0]);del m["source_url"];c.execute("UPDATE source_inspections_v1 SET inspection_json=? WHERE id=?",(json.dumps(m),"inspection"));c.commit();c.close()
  with self.assertRaisesRegex(ValueError,"SOURCE_URL_MISSING"): package_claim(self.db,self.claim)
if __name__=="__main__":
 result=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
 if not result.wasSuccessful(): raise SystemExit(1)
 print("STAGE785_TESTS=6/6")
 print("GROUNDED_EVIDENCE_PACKAGE=PASS")
 print("CLAIM_CITATION_AND_PROVENANCE=PASS")
 print("SOURCE_AUTHENTICITY_AND_FACTUAL_TRUTH=UNVERIFIED")
 print("EXISTING_DATABASE_WRITES=0 REAL_NETWORK_REQUESTS=0")
