import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {compileSemantic,FialSemanticSyntaxError} from "../src/fial/semantic-compiler-v2.mjs";
import {checkProposedClaims,matchGovernmentRecord,extractWithLocalQwen,
 runSemanticReview,ENGINE_VERSION,LOCAL_QWEN} from "../src/fial/semantic-engine-v2.mjs";

const source=await readFile(new URL("../src/fial/programs/grant-understanding.fial",import.meta.url),"utf8");
const sha=x=>createHash("sha256").update(x).digest("hex");
const TIME=new Date("2026-11-14T12:00:00Z");
const ROW={
 GrantID:"1647",PortalID:"1647",Status:"Active",Title:"Civil Money Penalty Reinvestment Grant",
 ApplicantType:"Businesses",ApplicationDeadline:"2027-08-31",
 GrantURL:"https://www.grants.ca.gov/grants/1647",
 AgencyDept:"California Department of Public Health",
 Purpose:"Improve quality of life for nursing facility residents",
 Description:"Applicants must propose eligible nursing facility projects; read official requirements.",
 Geography:"California",EstAmounts:"Up to $150000"
};
const headers=Object.keys(ROW);
function csvLine(row){return headers.map(k=>{
 const s=String(row[k]??"");return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}).join(",")}
const csv=headers.join(",")+"\n"+csvLine(ROW)+"\n";
const candidate={grant_id:"1647",title:ROW.Title,agency:ROW.AgencyDept,status:"Active",
 deadline_date:"2027-08-31",applicant_type:"Businesses",priority:80};
const profile={business_name:"FUN INDUSTRIAL LLC",eligible_business_verified:false,
 registered_address:null,contact_name:null,proposed_project:null,verified_project_budget:null};
async function fixture(dir,raw=csv,candidates=[candidate]){
 await mkdir(join(dir,"evidence"),{recursive:true});
 const evidenceFile=join(dir,"evidence","verified-government-records.csv");
 await writeFile(evidenceFile,raw,"utf8");
 return {version:"fun-real-application-worker-v1",state:"REAL_SOURCE_SCANNED_DRAFTS_PREPARED",
  submitted_applications:0,approved_spending:0,source_sha256:sha(Buffer.from(raw)),
  evidence_file:evidenceFile,top_candidates:candidates};
}
function modelResponse(claims){
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({claims})}}]}),
 {status:200,headers:{"content-type":"application/json"}});
}
test("FIAL 2 has a new restricted grammar with quote-grounding and explicit unknown-is-hold",()=>{
 const c=compileSemantic(source);
 assert.equal(c.version,"fial-semantic-bytecode-v0.2");
 assert.equal(c.budget,3);
 assert.deepEqual(c.fields,["applicant_type","purpose","description","geography","deadline","funding"]);
 assert.equal(c.grounding,"QUOTES");
 assert.equal(c.policy,"UNKNOWN_IS_HOLD");
 assert.equal(c.permissions.applicationSubmissions,false);
 assert.equal(c.permissions.network,"loopback-llama-only");
});
test("FIAL 2 cannot compile shell, network, approval bypass, arbitrary source or missing ground rules",()=>{
 for(const [from,to] of [
  ["FIAL 2","FIAL 3"],
  ["SOURCE GRANTS","SOURCE ANY_URL"],
  ["MODEL LOCAL_QWEN","MODEL REMOTE_API"],
  ["GROUND QUOTES","GROUND MODEL_GUESSES"],
  ["POLICY UNKNOWN_IS_HOLD","POLICY AUTO_SUBMIT"],
  ["BUDGET 3","BUDGET 99"],
  ["UNDERSTAND applicant_type,purpose,description,geography,deadline,funding","UNDERSTAND execute,shell"]
 ]){
  assert.throws(()=>compileSemantic(source.replace(from,to)),FialSemanticSyntaxError,to);
 }
 assert.throws(()=>compileSemantic(source+"\nEXEC SHELL"),FialSemanticSyntaxError);
 assert.throws(()=>compileSemantic("x".repeat(9000)),FialSemanticSyntaxError);
});
test("model can quote only exact substrings of their official fields, never promote interpretation to verified fact",()=>{
 const fields={purpose:"Improve quality of life for nursing facility residents",
  applicant_type:"Businesses"};
 const ok=checkProposedClaims({claims:[
  {field:"purpose",quote:"nursing facility residents",interpretation:"This appears facility-specific."},
  {field:"applicant_type",quote:"Businesses",interpretation:"This mentions businesses, not proof of eligibility."}
 ]},fields);
 assert.equal(ok.accepted.length,2);
 assert.ok(ok.accepted.every(x=>x.status==="EXACT_QUOTE_MATCHED_NOT_ELIGIBILITY_VERIFIED"));
 const invalid=checkProposedClaims({claims:[
  {field:"purpose",quote:"All companies are guaranteed grants",interpretation:"Eligible"},
  {field:"not_a_field",quote:"Businesses",interpretation:"Eligible"}
 ]},fields);
 assert.equal(invalid.accepted.length,0);
 assert.equal(invalid.rejected.length,2);
 assert.throws(()=>checkProposedClaims({claims:"all eligible"},fields),/SCHEMA_INVALID/);
});
test("local Qwen provider stays exclusively on 127.0.0.1:8088 and fails closed offline",async()=>{
 const program=compileSemantic(source);
 let called=0;
 const fetchImpl=async(url,init)=>{
  called++;
  assert.equal(url,LOCAL_QWEN);
  assert.equal(init.method,"POST");
  assert.equal(init.redirect,"error");
  assert.ok(init.body.includes("nursing facility residents"));
  assert.equal(JSON.parse(init.body).stream,false);
  assert.deepEqual(JSON.parse(init.body).response_format,{type:"json_object"});
  return modelResponse([{field:"purpose",quote:"nursing facility residents",
   interpretation:"Facility program relevance requires independent verification."}]);
 };
 const r=await extractWithLocalQwen({program,record:ROW,
  fields:{purpose:ROW.Purpose},fetchImpl});
 assert.equal(called,1);
 assert.equal(r.status,"MODEL_SOURCE_QUOTES_MATCHED");
 assert.equal(r.accepted.length,1);
 const offline=await extractWithLocalQwen({program,record:ROW,
  fields:{purpose:ROW.Purpose},fetchImpl:async()=>{throw Error("ECONNREFUSED")}});
 assert.equal(offline.status,"MODEL_UNAVAILABLE_OR_UNVERIFIED");
 assert.equal(offline.accepted.length,0);
});
test("semantic cycle validates original government CSV, accepts exact quote, stores SQLite, preserves edited brief",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial2-semantics-"));
 let calls=0;
 try{
  const report=await fixture(dir);
  const fetchImpl=async()=>{
   calls++;
   return modelResponse([{field:"purpose",quote:"nursing facility residents",
    interpretation:"Care facility focus; actual eligibility unknown."}]);
  };
  const first=await runSemanticReview({source,report,profile,directory:dir,fetchImpl,now:TIME});
  assert.equal(first.version,ENGINE_VERSION);
  assert.equal(first.records_in_snapshot,1);
  assert.equal(first.candidates_reviewed,1);
  assert.equal(first.model_quotes_grounded,1);
  assert.equal(first.applications_submitted,0);
  assert.equal(first.rea_executions,0);
  assert.equal(first.cases[0].record_state,"MATCHED_TO_SHA256_SNAPSHOT");
  assert.equal(first.cases[0].decision,"RESEARCH_AND_REQUEST_VERIFIED_PROFILE");
  const details=JSON.parse(await readFile(first.cases[0].evidence,"utf8"));
  assert.equal(details.model.accepted[0].source_quote,"nursing facility residents");
  assert.equal(details.decision.eligibility,"UNKNOWN");
  const original=await readFile(first.cases[0].brief,"utf8");
  await writeFile(first.cases[0].brief,original+"\nHuman review saved here.\n");
  const second=await runSemanticReview({source,report,profile,directory:dir,fetchImpl,
   now:new Date(TIME.getTime()+3600000)});
  assert.equal(second.candidates_reviewed,1);
  assert.equal(second.model_quotes_grounded,1);
  assert.equal(second.cases[0].brief,first.cases[0].brief);
  assert.match(await readFile(first.cases[0].brief,"utf8"),/Human review saved here/);
  const db=new DatabaseSync(second.sqlite_memory,{readOnly:true});
  try{
   assert.equal(db.prepare("SELECT COUNT(*) AS n FROM semantic_runs").get().n,2);
   assert.equal(db.prepare("SELECT COUNT(*) AS n FROM semantic_cases").get().n,2);
  }finally{db.close()}
  assert.equal(calls,2);
  assert.equal((await readdir(join(dir,"fial","semantic-v2","cases"))).length,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test("outdated or forged listing cannot be grounded to government source; Qwen is never called",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial2-forged-"));
 try{
  const changed={...candidate,title:"A different, invented grant"};
  const report=await fixture(dir,csv,[changed]);
  const run=await runSemanticReview({source,report,profile,directory:dir,
   fetchImpl:async()=>{throw Error("MUST_NOT_CALL_MODEL")},now:TIME});
  assert.equal(run.cases[0].record_state,"UNVERIFIED_RECORD");
  assert.equal(run.cases[0].model_status,"SKIPPED_UNVERIFIED_RECORD");
  assert.equal(run.cases[0].decision,"HOLD_UNVERIFIED_RECORD");
  const tampered={...report,source_sha256:"0".repeat(64)};
  await assert.rejects(runSemanticReview({source,report:tampered,profile,directory:dir,
   fetchImpl:async()=>{throw Error("MUST_NOT_CALL")}}),/FIAL_EVIDENCE_HASH_MISMATCH/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test("model hallucination is recorded as rejected evidence, and offline mode never claims understanding",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial2-hallucination-"));
 try{
  const report=await fixture(dir);
  const bad=await runSemanticReview({source,report,profile,directory:dir,now:TIME,
   fetchImpl:async()=>modelResponse([{field:"purpose",
    quote:"FUN INDUSTRIAL LLC has been awarded this grant",interpretation:"Approved"}])});
  assert.equal(bad.cases[0].accepted_quotes,0);
  assert.equal(bad.cases[0].rejected_quotes,1);
  const offline=await runSemanticReview({source,report,profile,directory:dir,
   now:new Date(TIME.getTime()+60000),
   fetchImpl:async()=>{throw Error("LOCAL_MODEL_NOT_RUNNING")}});
  assert.equal(offline.cases[0].model_status,"MODEL_UNAVAILABLE_OR_UNVERIFIED");
  assert.equal(offline.cases[0].accepted_quotes,0);
  assert.equal(offline.applications_submitted,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
