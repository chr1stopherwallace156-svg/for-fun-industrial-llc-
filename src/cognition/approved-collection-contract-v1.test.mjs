import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {collectApprovedSource,preflightCollection} from "./approved-collection-bridge-v1.mjs";
import {retrieveApprovedPage} from "./approved-single-page-retrieval-v1.mjs";
import {loadGroundedClaim,answerWithGroundedClaim} from "./grounded-qwen-v1.mjs";
import {validateEvidence} from "./evidence-records-v1.mjs";

const python=process.env.FUN_COGNITION_PYTHON||"python";
const plan_id="070b202f-1a78-41ae-aaec-7f8cc859417b";
const task_id="OP1-DEMAND";
const checksum=x=>createHash("sha256").update(x).digest("hex");

function fixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"fun-approved-page-test-"));
 const database=path.join(directory,"fixture.sqlite");
 const record=validateEvidence({plan_id,task_id,criterion:"demand",source_url:"https://example.org/sample",title:"Synthetic source",observation:"Synthetic example, not verified",observed_utc:new Date().toISOString()});
 const script=[
 "import sys,json,sqlite3,datetime",
 "db,plan,task,record=sys.argv[1:]",
 "r=json.loads(record)",
 "c=sqlite3.connect(db)",
 "c.execute('CREATE TABLE plans (id TEXT PRIMARY KEY,plan_json TEXT NOT NULL)')",
 "c.execute('CREATE TABLE evidence_records_v1 (id TEXT PRIMARY KEY,plan_id TEXT NOT NULL,task_id TEXT NOT NULL,record_sha256 TEXT NOT NULL,record_json TEXT NOT NULL,created_utc TEXT NOT NULL)')",
 "p={'opportunities':[{'tasks':[{'id':task,'criterion':'demand'}]}]}",
 "c.execute('INSERT INTO plans VALUES (?,?)',(plan,json.dumps(p)))",
 "c.execute('INSERT INTO evidence_records_v1 VALUES (?,?,?,?,?,?)',('fixture-record',plan,task,r['record_sha256'],json.dumps(r),datetime.datetime.now(datetime.timezone.utc).isoformat()))",
 "c.commit()",
 "c.close()"
 ].join("\n");
 const run=spawnSync(python,["-B","-c",script,database,plan_id,task_id,JSON.stringify(record)],{encoding:"utf8",timeout:15000});
 if(run.error||run.status!==0){fs.rmSync(directory,{recursive:true,force:true});throw Error("TEST_FIXTURE_HOLD:"+String(run.stderr||run.error||run.status))}
 return {database,clean:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
test("one webpage collection requires operator authorization and rejects local/private IP URLs",async()=>{
 await assert.rejects(()=>retrieveApprovedPage({url:"https://example.org",operatorApproved:false}),/OPERATOR_APPROVAL_REQUIRED/);
 await assert.rejects(()=>retrieveApprovedPage({url:"http://127.0.0.1/private",operatorApproved:true}),/IP_OR_LOCALHOST_NOT_ALLOWED/);
 await assert.rejects(()=>retrieveApprovedPage({url:"http://192.168.1.1/private",operatorApproved:true}),/IP_OR_LOCALHOST_NOT_ALLOWED/);
 await assert.rejects(()=>retrieveApprovedPage({url:"https://localhost",operatorApproved:true}),/IP_OR_LOCALHOST_NOT_ALLOWED/);
});
test("read-only preflight prevents a retrieval when evidence plan is absent",async()=>{
 const f=fixture();try{
 assert.equal(preflightCollection({database:f.database,python,plan_id,task_id}).evidence_records,1);
 let requested=0;
 await assert.rejects(()=>collectApprovedSource({database:f.database,python,plan_id:"11111111-1111-1111-1111-111111111111",task_id,url:"https://example.org/sample",operatorApproved:true,retriever:async()=>{requested++;throw Error("MUST_NOT_RUN")}}),/COLLECTION_PREFLIGHT_HOLD/);
 assert.equal(requested,0);
 }finally{f.clean()}
});
test("single captured response persists inspection, original bytes, verified textual provenance, and grounded citations",async()=>{
 const f=fixture();try{
  const url="https://example.org/sample";
  const claim_text="Synthetic fleet demand data cannot establish real market demand.";
  const content=Buffer.from("<html><body><p>"+claim_text+"</p></body></html>");
  const inspection={state:"retrieved_unverified",source_url:url,verification_status:"source_retrieved_claims_unverified",score_eligible:false,external_actions:1,content,bytes:content.length,content_sha256:checksum(content),retrieved_utc:new Date().toISOString(),excerpt:claim_text};
  let fetches=0;
  const result=await collectApprovedSource({database:f.database,python,plan_id,task_id,url,operatorApproved:true,retriever:async()=>{fetches++;return {content,claim_text,inspection}}});
  assert.equal(fetches,1);
  assert.equal(result.retrieval_count,1);
  assert.equal(result.redirects_followed,0);
  assert.equal(result.links_crawled,0);
  assert.equal(result.factual_claim_verified,false);
  assert.equal(result.source_authenticity_verified,false);
  assert.equal(result.content_sha256,checksum(content));
  assert.equal(result.passage,claim_text);
  assert.equal(result.preflight_evidence_records,1);
  assert.ok(result.claim_id);
  const recovered=loadGroundedClaim({database:f.database,python,claim_id:result.claim_id});
  assert.equal(recovered.passage,claim_text);
  assert.equal(recovered.passage_sha256,checksum(Buffer.from(claim_text)));
  let modelCalls=0;
  const answer=await answerWithGroundedClaim({database:f.database,python,claim_id:result.claim_id,question:"What is actually supported?",modelRequest:async()=>{modelCalls++;return {choices:[{message:{content:"The sample text does not verify real demand. [source:"+result.claim_id+"]"}}]}}});
  assert.equal(modelCalls,1);
  assert.equal(answer.state,"citation_identifiers_validated");
  assert.deepEqual(answer.citations,["source:"+result.claim_id]);
  assert.equal(answer.factual_claim_verified,false);
  if(process.env.FUN_TEST_LIVE_QWEN==="1"){
   const live=await answerWithGroundedClaim({database:f.database,python,claim_id:result.claim_id,question:"Does this synthetic passage independently verify actual fleet demand?"});
   assert.equal(live.state,"citation_identifiers_validated");
   assert.deepEqual(live.citations,["source:"+result.claim_id]);
   assert.equal(live.factual_claim_verified,false);
   console.log("REAL_LOCAL_QWEN_GROUNDED_CITATION=PASS");
  }
 }finally{f.clean()}
});
