import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {compileFial,decompileFial,FialSyntaxError} from "../src/fial/compiler-v1.mjs";
import {executeFial,verifyReportEvidence,FIAL_RUNTIME} from "../src/fial/interpreter-v1.mjs";

const original=await readFile(new URL("../src/fial/programs/grant-research.fial",import.meta.url),"utf8");
const SHA=s=>createHash("sha256").update(s).digest("hex");
const now=new Date("2026-11-14T11:00:00.000Z");
function grant(id,title){
 return {grant_id:id,title,agency:"California Agency",status:"Active",priority:72,
  deadline_date:"2027-04-01",purpose:"Industrial AI business research",
  description_excerpt:"Eligible business information must be verified.",
  estimated_awards:"TBD",applicant_type:"Businesses",
  application_url:"https://grants.ca.gov/grants/"+id};
}
const grants=[
 grant("1647","Civil Money Penalty Reinvestment Grant"),
 grant("164637","High Road to Construction Careers 2026"),
 grant("99","Beverage Container Innovation Grant"),
 grant("200","Small Business Research Program")
];
const profile={eligible_business_verified:false,registered_address:null,contact_name:null,
 proposed_project:null,verified_project_budget:null};
async function fixture(root,items=grants){
 const evidenceDir=join(root,"evidence");await mkdir(evidenceDir,{recursive:true});
 const bytes=Buffer.from("This represents an immutable, mocked government data snapshot\n");
 const witness=join(evidenceDir,"sample-grants.csv");await writeFile(witness,bytes);
 return {version:"fun-real-application-worker-v1",state:"REAL_SOURCE_SCANNED_DRAFTS_PREPARED",
   source_sha256:SHA(bytes),evidence_file:witness,
   submitted_applications:0,approved_spending:0,top_candidates:items};
}
test("FIAL has its own textual grammar and compiles to constrained bytecode",()=>{
 const compiled=compileFial(original);
 assert.equal(compiled.bytecode,"fial-bytecode-v0.1");
 assert.equal(compiled.budget,3);
 assert.equal(compiled.source,"GRANTS");
 assert.equal(compiled.instructions.length,6);
 assert.ok(compiled.instructions.every(x=>x.opcode==="TEST_RULE"));
 assert.ok(Object.values(compiled.authority).every(x=>x===false));
 const restored=compileFial(decompileFial(compiled));
 assert.equal(restored.mission,compiled.mission);
 assert.equal(restored.budget,compiled.budget);
 assert.deepEqual(restored.instructions.map(({line,...operation})=>operation),
  compiled.instructions.map(({line,...operation})=>operation));
});
test("language rejects arbitrary shell, Python, network, authority escalation, loops and malformed programs",()=>{
 for(const line of [
 "EXEC powershell.exe -Command Remove-Item C:\\",
 "RULE \"hack\" WHEN always SCORE 99 ACTION SUBMIT",
 "RULE \"shell\" WHEN always SCORE 99 ACTION SHELL",
 "RULE \"tool\" WHEN always SCORE 99 ACTION REA",
 "IMPORT python",
 "FILE open('C:/private.txt')",
 "SOURCE INTERNET"
 ]){
  const program=original.replace("END",line+"\nEND");
  assert.throws(()=>compileFial(program),FialSyntaxError,line);
 }
 assert.throws(()=>compileFial(original.replace("BUDGET 3","BUDGET 999")),FialSyntaxError);
 assert.throws(()=>compileFial(original.replace("FIAL 1","FIAL 2")),FialSyntaxError);
 assert.throws(()=>compileFial(original.replace("RULE \"stable-candidate\" WHEN always SCORE 10 ACTION REMEMBER\n","")),/DEFAULT_ALWAYS/);
 assert.throws(()=>compileFial(original+"RUN AGAIN"),FialSyntaxError);
 assert.throws(()=>compileFial("x".repeat(17000)),FialSyntaxError);
});
test("real file evidence must match source SHA and stay inside trusted folder",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial-evidence-"));
 try{
  const report=await fixture(dir);
  assert.equal((await verifyReportEvidence(report,dir)).sha256,report.source_sha256);
  const spoof={...report,source_sha256:"d".repeat(64)};
  await assert.rejects(verifyReportEvidence(spoof,dir),/FIAL_EVIDENCE_HASH_MISMATCH/);
  const out={...report,evidence_file:join(dir,"outside.csv")};
  await assert.rejects(verifyReportEvidence(out,dir),/FIAL_EVIDENCE_PATH_OUTSIDE_TRUST_ROOT/);
  const fabricated={...report,submitted_applications:1};
  await assert.rejects(verifyReportEvidence(fabricated,dir),/FIAL_REJECTED_UNVERIFIED/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test("interpreter executes actual FIAL source against verified grant records and stores SQLite memory",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial-interpreter-"));
 try{
  const report=await fixture(dir);
  const first=await executeFial({directory:dir,report,profile,source:original,now});
  assert.equal(first.runtime,FIAL_RUNTIME);
  assert.equal(first.decisions,4);
  assert.equal(first.briefs.length,3);
  assert.equal(first.briefs.filter(x=>x.new_file).length,3);
  assert.equal(first.chosen_actions[3].action,"DEFER");
  assert.equal(first.applications_submitted,0);
  assert.equal(first.emails_sent,0);
  assert.equal(first.rea_actions,0);
  assert.equal(first.purchases,0);
  const dbFile=join(dir,"fial","fial-memory-v1.sqlite");
  const db=new DatabaseSync(dbFile,{readOnly:true});
  try{
   assert.equal(db.prepare("SELECT COUNT(*) AS n FROM memory").get().n,4);
   assert.equal(db.prepare("SELECT COUNT(*) AS n FROM decisions").get().n,4);
  }finally{db.close()}
  const keep=first.briefs[0].path;
  await writeFile(keep,(await readFile(keep,"utf8"))+"\nUSER EDIT MUST SURVIVE\n");
  const second=await executeFial({directory:dir,report,profile,source:original,
   now:new Date(now.getTime()+3600000)});
  assert.equal(second.briefs.length,1);
  assert.equal(second.chosen_actions[3].rule,"resume-deferred");
  assert.equal(second.chosen_actions[0].action,"HOLD");
  assert.match(await readFile(keep,"utf8"),/USER EDIT MUST SURVIVE/);
  const third=await executeFial({directory:dir,report,profile,source:original,
   now:new Date(now.getTime()+7200000)});
  assert.equal(third.briefs.length,0);
  assert.equal(third.decisions,4);
  assert.equal((await readdir(join(dir,"fial","briefs"))).length,4);
  assert.equal(JSON.parse(await readFile(join(dir,"fial","last-run.json"),"utf8")).status,
   "FIAL_INTERPRETER_EXECUTED_LOCAL_ONLY");
 }finally{await rm(dir,{recursive:true,force:true})}
});
test("changed source grant record creates a distinct brief version without overwriting review",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial-change-"));
 try{
  const report=await fixture(dir,[grants[0]]);
  const first=await executeFial({directory:dir,report,profile,source:original,now});
  const newer={...report,top_candidates:[{...grants[0],title:"Revised Civil Money Penalty Reinvestment Grant"}]};
  const second=await executeFial({directory:dir,report:newer,profile,source:original,
   now:new Date(now.getTime()+3600000)});
  assert.equal(second.chosen_actions[0].rule,"changed-grant");
  assert.equal(second.briefs.length,1);
  assert.notEqual(first.briefs[0].path,second.briefs[0].path);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test("zero budget can still preserve evidence and memory without creating files",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial-zero-"));
 try{
  const report=await fixture(dir);
  const source=original.replace("BUDGET 3","BUDGET 0");
  const receipt=await executeFial({directory:dir,report,profile,source,now});
  assert.equal(receipt.briefs.length,0);
  assert.ok(receipt.chosen_actions.every(x=>x.action==="DEFER"));
  assert.equal(receipt.decisions,4);
 }finally{await rm(dir,{recursive:true,force:true})}
});
