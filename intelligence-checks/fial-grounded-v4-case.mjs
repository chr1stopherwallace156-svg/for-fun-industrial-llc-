import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {runComprehensionAudit} from "../src/fial/comprehension-audit-v3.mjs";
import {compileGrounded,Fial4SyntaxError,FIAL4_VERSION} from "../src/fial/grounded-compiler-v4.mjs";
import {reviewClaim,runGroundedReview,FIAL4_ENGINE} from "../src/fial/grounded-review-v4.mjs";
import {readFial4DashboardStatus} from "../src/fial/dashboard-status-v4.mjs";
const source=await readFile(new URL("../src/fial/programs/grant-grounded.fial",import.meta.url),"utf8");
const v3Source=await readFile(new URL("../src/fial/programs/grant-comprehension.fial",import.meta.url),"utf8");
const sha=x=>createHash("sha256").update(x).digest("hex");
const QUOTE="This grant allows applicants to apply for funding to implement programs for improving Skilled Nursing Facility residents' quality of life.";
const GOOD="The grant's purpose is to fund programs that enhance the quality of life for Skilled Nursing Facility residents.";
const ROW={GrantID:"1647",Status:"Active",GrantURL:"https://www.grants.ca.gov/grants/1647",
 Title:"Civil Money Penalty Reinvestment Grant",AgencyDept:"California Department of Public Health",
 ApplicantType:"Businesses",Purpose:QUOTE,
 Description:"This program supports improved care for Skilled Nursing Facility residents.",
 Geography:"California",ApplicationDeadline:"2027-08-31",EstAmounts:"Not specified"};
const csv=Object.keys(ROW).join(",")+"\n"+Object.values(ROW).map(x=>
 /[",\r\n]/.test(String(x))?'"'+String(x).replace(/"/g,'""')+'"':String(x)).join(",")+"\n";
const CASE="b".repeat(30);
async function fixture(root,{interpretation=GOOD,accepted=true}={}){
 const evid=join(root,"evidence"),dir=join(root,"fial","semantic-v2","cases");
 await mkdir(evid,{recursive:true});await mkdir(dir,{recursive:true});
 const file=join(evid,"government.csv");await writeFile(file,csv);
 const report={version:"fun-real-application-worker-v1",state:"REAL_SOURCE_SCANNED_DRAFTS_PREPARED",
  source_sha256:sha(Buffer.from(csv)),evidence_file:file,
  submitted_applications:0,approved_spending:0,
  top_candidates:[{grant_id:ROW.GrantID,title:ROW.Title,agency:ROW.AgencyDept}]};
 const v2={case_id:CASE,grant_id:ROW.GrantID,title:ROW.Title,
  source_sha256:report.source_sha256,source_fields:{purpose:QUOTE},
  model:{accepted:accepted?[{field:"purpose",source_quote:QUOTE,
   model_interpretation_unverified:interpretation}]:[],
   rejected:accepted?[]:[{field:"purpose",reason:"QUOTE_NOT_IN_GOVERNMENT_SNAPSHOT"}]}};
 const caseFile=join(dir,CASE+".json");
 await writeFile(caseFile,JSON.stringify(v2));
 const semanticReceipt={version:"fial-semantic-engine-v0.2",source_sha256:report.source_sha256,
  cases:[{case_id:CASE,grant_id:ROW.GrantID,title:ROW.Title}]};
 const comprehensionReceipt=await runComprehensionAudit({
  source:v3Source,report,semanticReceipt,directory:root});
 return {report,semanticReceipt,comprehensionReceipt,caseFile};
}
async function run(root,args){
 const a=await fixture(root,args);
 return {...a,receipt:await runGroundedReview({source,directory:root,
  report:a.report,semanticReceipt:a.semanticReceipt,
  comprehensionReceipt:a.comprehensionReceipt})};
}
async function temp(fn){
 const dir=await mkdtemp(join(tmpdir(),"fial4-independent-"));
 try{await fn(dir)}finally{await rm(dir,{recursive:true,force:true})}
}
test("FIAL 4 compiler fixes source, evidence, and zero-external-authority contracts",()=>{
 const program=compileGrounded(source);
 assert.equal(program.version,FIAL4_VERSION);
 assert.equal(program.maxCases,3);
 assert.ok(Object.values(program.permissions).every(x=>x===false));
 for(const [a,b] of [["SOURCE VERIFIED_SNAPSHOT","SOURCE INTERNET"],
  ["AUDIT SAVED_FIAL2_AND_FIAL3","AUDIT WEB_PAGES"],
  ["POLICY UNPROVEN_IS_HOLD","POLICY AUTO_APPROVE"]]){
  assert.throws(()=>compileGrounded(source.replace(a,b)),Fial4SyntaxError);
 }
 assert.throws(()=>compileGrounded(source+"SUBMIT"),Fial4SyntaxError);
});
test("independent case survives FIAL 2, FIAL 3, FIAL 4 chain without proving entailment",async()=>temp(async d=>{
 const {receipt}=await run(d);
 assert.equal(receipt.version,FIAL4_ENGINE);
 assert.equal(receipt.quotes_checked,1);
 assert.equal(receipt.claims_held,0);
 assert.equal(receipt.cases[0].outcome,"REVIEW_REQUIRED_VERIFIED_SNAPSHOT_NOT_ENTAILMENT");
 assert.equal(receipt.semantic_entailments_proven,0);
 assert.equal(receipt.verified_eligibilities,0);
 for(const k of ["network_requests","model_requests","rea_actions",
  "applications_submitted","money_spent","service_restarts"])assert.equal(receipt[k],0);
 const out=JSON.parse(await readFile(receipt.cases[0].audit_file,"utf8"));
 assert.equal(out.claims[0].review.status,"REVIEW_REQUIRED_SOURCE_QUOTE_CONFIRMED");
 const db=new DatabaseSync(join(d,"fial","grounded-v4","grounded-memory-v4.sqlite"),{readOnly:true});
 try{assert.equal(db.prepare("SELECT COUNT(*) AS n FROM runs").get().n,1)}
 finally{db.close()}
}));
test("invented money, applicant awards and changed polarity remain HOLD",()=>{
 const claims=[
  "Fun Industrial has definitely been awarded 800000 dollars.",
  "Not eligible to apply for any skilled nursing facility funding.",
  "The grant guarantees every company a 10000 dollar award."
 ];
 for(const interpretation of claims){
  const result=reviewClaim({field:"purpose",quote:QUOTE,interpretation,
   fields:{purpose:QUOTE}});
  assert.equal(result.status,"HOLD_CLAIM_REQUIRES_REVIEW");
  assert.equal(result.applicant_eligibility_verified,false);
 }
});
test("missing accepted model quotations remain an explicit HOLD",async()=>temp(async d=>{
 const {receipt}=await run(d,{accepted:false});
 assert.equal(receipt.quotes_checked,0);
 assert.equal(receipt.cases[0].outcome,"HOLD_NO_ACCEPTED_SOURCE_QUOTES");
}));
test("modified saved FIAL 3 audit fails without alternative source or model calls",async()=>temp(async d=>{
 const a=await fixture(d);
 const file=a.comprehensionReceipt.cases[0].audit_file;
 const before=JSON.parse(await readFile(file,"utf8"));
 before.claim_audits[0].audit.status="PLAUSIBLE_PROVEN";
 await writeFile(file,JSON.stringify(before));
 await assert.rejects(runGroundedReview({source,directory:d,report:a.report,
  semanticReceipt:a.semanticReceipt,comprehensionReceipt:a.comprehensionReceipt}),
  /PREVIOUS_AUDIT_TAMPER_OR_DRIFT/);
}));
test("modified saved government CSV fails SHA-256 verification",async()=>temp(async d=>{
 const a=await fixture(d);
 await writeFile(a.report.evidence_file,csv+"UNTRUSTED\n");
 await assert.rejects(runGroundedReview({source,directory:d,report:a.report,
  semanticReceipt:a.semanticReceipt,comprehensionReceipt:a.comprehensionReceipt}),
  /EVIDENCE_HASH_MISMATCH/);
}));
test("second run never replaces analyst Markdown annotations",async()=>temp(async d=>{
 const a=await fixture(d);
 const inputs={source,directory:d,report:a.report,
  semanticReceipt:a.semanticReceipt,comprehensionReceipt:a.comprehensionReceipt};
 const one=await runGroundedReview(inputs);
 const md=one.cases[0].summary_file;
 await writeFile(md,(await readFile(md,"utf8"))+"\nPRESERVE REVIEWER NOTE\n");
 const two=await runGroundedReview(inputs);
 assert.equal(one.cases[0].summary_file,two.cases[0].summary_file);
 assert.match(await readFile(md,"utf8"),/PRESERVE REVIEWER NOTE/);
}));
test("dashboard status reports unverified eligibility, safely without triggering anything",async()=>temp(async d=>{
 assert.equal((await readFial4DashboardStatus({directory:d})).state,"not_run");
 await run(d);
 const status=await readFial4DashboardStatus({directory:d});
 assert.equal(status.state,"local_review_complete");
 assert.equal(status.company_eligibility,"UNKNOWN");
 assert.equal(status.proven_entailments,0);
 assert.equal(status.submissions,0);
}));
