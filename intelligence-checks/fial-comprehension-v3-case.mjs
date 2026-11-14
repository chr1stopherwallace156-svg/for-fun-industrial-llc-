import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {compileComprehension,Fial3SyntaxError,FIAL3_VERSION} from "../src/fial/comprehension-compiler-v3.mjs";
import {auditInterpretation,runComprehensionAudit,FIAL3_ENGINE} from "../src/fial/comprehension-audit-v3.mjs";
const source=await readFile(new URL("../src/fial/programs/grant-comprehension.fial",import.meta.url),"utf8");
const sha=x=>createHash("sha256").update(x).digest("hex");
const TIME=new Date("2026-11-14T20:00:00.000Z");
const ROW={GrantID:"1647",Title:"Civil Money Penalty Reinvestment Grant",
 AgencyDept:"California Department of Public Health",
 ApplicantType:"Businesses",
 Purpose:"This grant allows applicants to apply for funding to implement programs for improving Skilled Nursing Facility residents' quality of life.",
 Description:"This program supports improved care for Skilled Nursing Facility residents.",
 Geography:"California",ApplicationDeadline:"2027-08-31",EstAmounts:"Not specified"};
const cols=Object.keys(ROW);
const csv=cols.join(",")+"\n"+cols.map(k=>{
 const val=String(ROW[k]);return /[",\n\r]/.test(val)?'"'+val.replace(/"/g,'""')+'"':val
}).join(",")+"\n";
const QUOTE=ROW.Purpose;
const GOOD="The grant's purpose is to fund programs that enhance the quality of life for Skilled Nursing Facility residents.";
const baselineFields={purpose:ROW.Purpose};
const caseId="a".repeat(30);
async function fixture(root,{claim=GOOD,quote=QUOTE,field="purpose"}={}){
 const evidenceDir=join(root,"evidence"),casesDir=join(root,"fial","semantic-v2","cases");
 await mkdir(evidenceDir,{recursive:true});await mkdir(casesDir,{recursive:true});
 const bytes=Buffer.from(csv);
 const evidenceFile=join(evidenceDir,"government.csv");await writeFile(evidenceFile,bytes);
 const report={version:"fun-real-application-worker-v1",state:"REAL_SOURCE_SCANNED_DRAFTS_PREPARED",
  source_sha256:sha(bytes),evidence_file:evidenceFile,approved_spending:0,
  submitted_applications:0,top_candidates:[{grant_id:ROW.GrantID,title:ROW.Title,agency:ROW.AgencyDept}]};
 const caseFile={case_id:caseId,grant_id:ROW.GrantID,title:ROW.Title,
  source_sha256:sha(bytes),source_fields:baselineFields,
  model:{accepted:[{field,source_quote:quote,model_interpretation_unverified:claim}],
  rejected:[{field:"purpose",reason:"QUOTE_NOT_IN_GOVERNMENT_SNAPSHOT"}]}};
 await writeFile(join(casesDir,caseId+".json"),JSON.stringify(caseFile,null,2)+"\n");
 const receipt={version:"fial-semantic-engine-v0.2",source_sha256:sha(bytes),
  cases:[{case_id:caseId,grant_id:ROW.GrantID,title:ROW.Title,model_status:"MODEL_SOURCE_QUOTES_MATCHED"}]};
 return {report,receipt,file:join(casesDir,caseId+".json")};
}
test("FIAL 3 has its own compile-time enforced evidence and no-authority rules",()=>{
 const compiled=compileComprehension(source);
 assert.equal(compiled.version,FIAL3_VERSION);
 assert.equal(compiled.maximumCases,3);
 assert.ok(Object.values(compiled.permissions).every(x=>x===false));
 for(const [a,b] of [
  ["SOURCE GRANTS","SOURCE INTERNET"],
  ["AUDIT SAVED_SEMANTIC_CASES","AUDIT RANDOM_WEBSITE"],
  ["POLICY UNPROVEN_IS_HOLD","POLICY AUTO_APPROVE"],
  ["VERIFY SOURCE_QUOTE,NUMBERS,CERTAINTY,POLARITY,LEXICAL_ALIGNMENT","VERIFY AUTO_SUBMIT"],
 ])assert.throws(()=>compileComprehension(source.replace(a,b)),Fial3SyntaxError);
 assert.match(source,/^FIAL 3\r?$/m);
 assert.throws(()=>compileComprehension(source.replace(/^FIAL 3\r?$/m,"FIAL 99")),/EXPECTED_VERSION_3/);
 const win=source.replace(/\r?\n/g,"\r\n");
 assert.equal(compileComprehension(win).version,FIAL3_VERSION);
 assert.throws(()=>compileComprehension(win.replace(/^FIAL 3\r?$/m,"FIAL 0")),/EXPECTED_VERSION_3/);
 assert.throws(()=>compileComprehension(source+"SUBMIT"),Fial3SyntaxError);
});
test("supported paraphrase is plausible only, not proven entailment or eligibility",()=>{
 const result=auditInterpretation({field:"purpose",quote:QUOTE,interpretation:GOOD},baselineFields);
 assert.equal(result.status,"PLAUSIBLE_PARAPHRASE_REVIEW_REQUIRED");
 assert.equal(result.interpretation_verified,false);
 assert.equal(result.new_numbers.length,0);
 assert.ok(result.lexical_overlap>0.25);
});
test("invented award certainty, numerical funding, company claim and changed polarity are independently held",()=>{
 const cases=[
  ["Fun Industrial LLC has been approved for 500000 dollars.",
   ["NUMERIC_ASSERTION_NOT_IN_QUOTED_EVIDENCE","COMPANY_SPECIFIC_INFERENCE_NOT_IN_QUOTE"]],
  ["The company is definitely eligible for this grant.",
   ["UNSUPPORTED_ELIGIBILITY_OR_AWARD_CERTAINTY"]],
  ["Not eligible for any nursing facility program.",["POSSIBLE_POLARITY_DIFFERENCE"]],
  ["Meteorological satellites conduct independent orbital maneuvers.",
   ["LOW_LEXICAL_ALIGNMENT_NOT_A_DISPROOF"]],
 ];
 for(const [interpretation,expected] of cases){
  const result=auditInterpretation({field:"purpose",quote:QUOTE,interpretation},baselineFields);
  assert.equal(result.status,"HOLD_FOR_COMPREHENSION_REVIEW",interpretation);
  for(const finding of expected)assert.ok(result.findings.includes(finding),finding);
  assert.equal(result.interpretation_verified,false);
 }
 const fabricated=auditInterpretation({field:"purpose",quote:"All businesses have automatically been awarded funds",interpretation:"Approved"},baselineFields);
 assert.equal(fabricated.status,"HOLD_QUOTE_NOT_VERIFIED");
});
test("independent FIAL 3 audit executes against saved exact source evidence and persists SQLite without external actions",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial3-comprehension-"));
 try{
  const {report,receipt}=await fixture(dir);
  const first=await runComprehensionAudit({source,report,semanticReceipt:receipt,directory:dir,now:TIME});
  assert.equal(first.version,FIAL3_ENGINE);
  assert.equal(first.count,1);
  assert.equal(first.plausible_claims,1);
  assert.equal(first.claims_held,0);
  assert.equal(first.cases[0].outcome,"PROVISIONAL_TEXTUAL_CONSISTENCY_ONLY");
  assert.equal(first.claims_proven_by_entailment,0);
  assert.equal(first.verified_eligibilities,0);
  assert.equal(first.tool_actions,0);
  assert.equal(first.applications_submitted,0);
  assert.equal(first.external_requests,0);
  const audit=JSON.parse(await readFile(first.cases[0].audit_file,"utf8"));
  assert.equal(audit.claim_audits[0].audit.status,"PLAUSIBLE_PARAPHRASE_REVIEW_REQUIRED");
  assert.equal(audit.interpretation_verified,false);
  const firstText=await readFile(first.cases[0].summary_file,"utf8");
  await writeFile(first.cases[0].summary_file,firstText+"\nHUMAN AUDIT NOTE MUST SURVIVE\n");
  const second=await runComprehensionAudit({source,report,semanticReceipt:receipt,directory:dir,
   now:new Date(+TIME+60000)});
  assert.match(await readFile(first.cases[0].summary_file,"utf8"),/HUMAN AUDIT NOTE MUST SURVIVE/);
  assert.equal(second.count,1);
  const db=new DatabaseSync(second.sqlite_memory,{readOnly:true});
  try{
   assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_runs").get().n,2);
   assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_cases").get().n,2);
  }finally{db.close()}
  assert.equal((await readdir(join(dir,"fial","semantic-v3","audits"))).length,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test("model's unsupported eligibility/award statement remains a HOLD even with a genuine quote",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial3-unsupported-"));
 try{
  const {report,receipt}=await fixture(dir,{
   claim:"Fun Industrial LLC has been awarded 1000000 dollars and is definitely eligible."});
  const audit=await runComprehensionAudit({source,report,semanticReceipt:receipt,directory:dir,now:TIME});
  assert.equal(audit.count,1);
  assert.equal(audit.plausible_claims,0);
  assert.equal(audit.claims_held,1);
  assert.equal(audit.cases[0].outcome,"HOLD_UNSUPPORTED_OR_AMBIGUOUS_INFERENCES");
 }finally{await rm(dir,{recursive:true,force:true})}
});
test("tampering with saved case quote or source fields fails closed, no alternative model fetched",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial3-tamper-"));
 try{
  const {report,receipt,file}=await fixture(dir);
  const spoof={...receipt,source_sha256:"f".repeat(64)};
  await assert.rejects(runComprehensionAudit({source,report,semanticReceipt:spoof,directory:dir}),/REPORT_AND_SOURCE_MISMATCH/);
  const raw=JSON.parse(await readFile(file,"utf8"));
  raw.source_fields.purpose="Everyone is automatically eligible";
  await writeFile(file,JSON.stringify(raw));
  await assert.rejects(runComprehensionAudit({source,report,semanticReceipt:receipt,directory:dir}),/SOURCE_FIELD_TAMPER_DETECTED/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test("empty model evidence remains explicit HOLD and not mistaken for understanding",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fial3-empty-"));
 try{
  const {report,receipt,file}=await fixture(dir);
  const raw=JSON.parse(await readFile(file,"utf8"));
  raw.model.accepted=[];raw.model.rejected=[{field:"purpose",reason:"QUOTE_NOT_IN_GOVERNMENT_SNAPSHOT"}];
  await writeFile(file,JSON.stringify(raw));
  const run=await runComprehensionAudit({source,report,semanticReceipt:receipt,directory:dir});
  assert.equal(run.cases[0].outcome,"HOLD_NO_ACCEPTED_SOURCE_QUOTES");
  assert.equal(run.plausible_claims,0);
  assert.equal(run.claims_proven_by_entailment,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
