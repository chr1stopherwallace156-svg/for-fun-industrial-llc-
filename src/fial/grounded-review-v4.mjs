// FIAL 4: independent deterministic review of preserved FIAL 2 + FIAL 3 evidence.
// No network, model, REA, shell, approval, spending, or application action.
// "Source grounded" never means logically entailed or currently eligible.
import {createHash,randomUUID} from "node:crypto";
import {readFile,writeFile,mkdir,rename,lstat,realpath} from "node:fs/promises";
import {join,resolve,sep} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {compileGrounded} from "./grounded-compiler-v4.mjs";
import {auditInterpretation} from "./comprehension-audit-v3.mjs";
import {verifyReportEvidence} from "./interpreter-v1.mjs";
import {matchGovernmentRecord} from "./semantic-engine-v2.mjs";
import {parseCsv} from "../applications/opportunity-worker-v1.mjs";

export const FIAL4_ENGINE="fial-grounded-review-v0.4";
const sha=x=>createHash("sha256").update(x).digest("hex");
const safe=(x,n=350)=>String(x??"").replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,n);
const FIELD_COLUMNS=Object.freeze({applicant_type:"ApplicantType",purpose:"Purpose",
 description:"Description",geography:"Geography",deadline:"ApplicationDeadline",
 funding:"EstAmounts"});
const HEX30=/^[a-f0-9]{30}$/;
async function fileJson(path,max=150000){
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size>max||st.size<2)
  throw Error("FIAL4_UNTRUSTED_EVIDENCE_FILE");
 return JSON.parse(await readFile(path,"utf8"));
}
async function verifyCasePath(root,section,caseId){
 if(!HEX30.test(caseId||""))throw Error("FIAL4_INVALID_CASE_ID");
 const folder=await realpath(join(root,"fial",section));
 const path=resolve(folder,caseId+".json");
 if(!path.startsWith(folder+sep))throw Error("FIAL4_PATH_ESCAPE");
 return path;
}
function canonicalFields(row,fields){
 if(!fields||typeof fields!=="object"||Array.isArray(fields)||
  Object.keys(fields).some(k=>!Object.hasOwn(FIELD_COLUMNS,k)))
  throw Error("FIAL4_SOURCE_FIELD_SCHEMA_INVALID");
 for(const k of Object.keys(fields)){
  const actual=safe(row[FIELD_COLUMNS[k]],900);
  if(fields[k]!==actual)throw Error("FIAL4_SOURCE_FIELDS_DIVERGED_FROM_SNAPSHOT");
 }
}
export function reviewClaim({field,quote,interpretation,fields}){
 const basic=auditInterpretation({field,quote,interpretation},fields);
 const flags=[...basic.findings];
 const text=String(interpretation||"");
 // A quote about a program does not establish an applicant's eligibility.
 if(/\b(?:our company|our business|fun industrial|elektron industrial)\b/i.test(text)||
    /\b(?:we (?:qualify|are eligible)|company is eligible|applicant is approved)\b/i.test(text))
  flags.push("APPLICANT_CLAIM_REQUIRES_VERIFIED_ENTITY_EVIDENCE");
 if(/\b(?:guaranteed|certain|definitely|automatically)\b/i.test(text) &&
    /\b(?:award|fund|qualif|eligib|approv)/i.test(text))
  flags.push("CERTAINTY_NOT_SUPPORTED");
 // Original published summary may be incomplete and is not current guidance.
 return {status:basic.status!=="PLAUSIBLE_PARAPHRASE_REVIEW_REQUIRED"||flags.length?
   "HOLD_CLAIM_REQUIRES_REVIEW":"REVIEW_REQUIRED_SOURCE_QUOTE_CONFIRMED",
  findings:[...new Set(flags)],quote_matched:basic.status!=="HOLD_QUOTE_NOT_VERIFIED",
  lexical_overlap:basic.lexical_overlap,semantic_entailment_proven:false,
  applicant_eligibility_verified:false,official_page_current:false};
}
function init(db){
 db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1500");
 db.exec("CREATE TABLE IF NOT EXISTS runs(run_id TEXT PRIMARY KEY,utc TEXT NOT NULL,source_sha TEXT NOT NULL,total INTEGER NOT NULL)");
 db.exec("CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,grant_id TEXT NOT NULL,outcome TEXT NOT NULL,claims_held INTEGER NOT NULL)");
}
function summary(caseResult){
 const lines=["# FIAL 4 — Source-grounded review","",
 "Grant: "+safe(caseResult.title,250),
 "Grant ID: "+safe(caseResult.grant_id,100),
 "Outcome: "+caseResult.outcome,
 "Saved government CSV SHA-256: "+caseResult.source_sha256,
 "Official live program-page verification: NOT PERFORMED",
 "Company eligibility: UNKNOWN",
 "Semantic entailment proven: NO","",
 "## Rechecked claims"];
 if(!caseResult.claims.length)lines.push("No accepted source quotations; cannot endorse an interpretation.");
 for(const claim of caseResult.claims){
  lines.push("### "+safe(claim.field,40),
   "Quote: "+safe(claim.quote,210),
   "Interpretation (untrusted): "+safe(claim.interpretation,360),
   "Result: "+claim.review.status,
   "Findings: "+(claim.review.findings.join(", ")||"No deterministic red flags"));
 }
 lines.push("","## Hold boundaries",
 "Compare the current official program guidelines, eligibility criteria, dates and company evidence separately.",
 "No external request, submission, approval, spending, model call, REA or service change.");
 return lines.join("\n")+"\n";
}
export async function runGroundedReview({source,report,semanticReceipt,
 comprehensionReceipt,directory,now=new Date()}={}){
 const program=compileGrounded(source);
 if(typeof directory!=="string"||!directory.trim())throw Error("FIAL4_STORAGE_REQUIRED");
 const date=new Date(now);
 if(!Number.isFinite(+date))throw Error("FIAL4_INVALID_DATE");
 const root=await realpath(resolve(directory));
 const evidence=await verifyReportEvidence(report,root);
 if(semanticReceipt?.version!=="fial-semantic-engine-v0.2"||
  comprehensionReceipt?.version!=="fial-comprehension-audit-v0.3"||
  semanticReceipt.source_sha256!==evidence.sha256||
  comprehensionReceipt.source_sha256!==evidence.sha256||
  !Array.isArray(semanticReceipt.cases)||!Array.isArray(comprehensionReceipt.cases)||
  semanticReceipt.cases.length>program.maxCases||
  semanticReceipt.cases.length!==comprehensionReceipt.cases.length)
  throw Error("FIAL4_RECEIPT_SOURCE_CHAIN_MISMATCH");
 const rows=parseCsv((await readFile(evidence.source_path)).toString("utf8"));
 const outDir=join(root,"fial","grounded-v4"),audits=join(outDir,"audits");
 await mkdir(audits,{recursive:true});
 if((await lstat(audits)).isSymbolicLink())throw Error("FIAL4_OUTPUT_SYMLINK_DENIED");
 const results=[];
 for(const item of comprehensionReceipt.cases){
  const caseId=item?.case_id;
  if(!HEX30.test(caseId||""))throw Error("FIAL4_CASE_ID_INVALID");
  const matchV2=semanticReceipt.cases.filter(x=>x.case_id===caseId);
  if(matchV2.length!==1||matchV2[0].grant_id!==item.grant_id||
     matchV2[0].title!==item.title)throw Error("FIAL4_CASE_RECEIPT_MISMATCH");
  const [v2,v3]=await Promise.all([
   fileJson(await verifyCasePath(root,"semantic-v2/cases",caseId)),
   fileJson(await verifyCasePath(root,"semantic-v3/audits",caseId))
  ]);
  if(v2.case_id!==caseId||v3.case_id!==caseId||
   v2.grant_id!==item.grant_id||v3.grant_id!==item.grant_id||
   v2.title!==item.title||v3.title!==item.title||
   v2.source_sha256!==evidence.sha256||v3.source_sha256!==evidence.sha256||
   v3.outcome!==item.outcome)throw Error("FIAL4_CASE_EVIDENCE_CHAIN_MISMATCH");
  const listing=report.top_candidates.find(x=>x.grant_id===item.grant_id&&x.title===item.title);
  const matched=listing?matchGovernmentRecord(listing,rows):{status:"UNVERIFIED_RECORD"};
  const accepted=v2.model?.accepted;
  if(!Array.isArray(accepted)||accepted.length>12||
     !Array.isArray(v3.claim_audits)||accepted.length!==v3.claim_audits.length)
   throw Error("FIAL4_CLAIMS_SCHEMA_MISMATCH");
  if(matched.status==="MATCHED_TO_SHA256_SNAPSHOT")canonicalFields(matched.row,v2.source_fields);
  const claims=accepted.map((x,index)=>{
   const prior=v3.claim_audits[index];
   if(!x||!Object.hasOwn(FIELD_COLUMNS,x.field)||
      prior.field!==safe(x.field,40)||
      prior.source_quote!==safe(x.source_quote,200)||
      prior.model_interpretation_unverified!==safe(x.model_interpretation_unverified,350)||
      JSON.stringify(prior.audit)!==JSON.stringify(auditInterpretation({
       field:x.field,quote:x.source_quote,interpretation:x.model_interpretation_unverified
      },v2.source_fields||{})))
    throw Error("FIAL4_PREVIOUS_AUDIT_TAMPER_OR_DRIFT");
   return {field:x.field,quote:x.source_quote,
    interpretation:x.model_interpretation_unverified,
    review:reviewClaim({field:x.field,quote:x.source_quote,
     interpretation:x.model_interpretation_unverified,fields:v2.source_fields||{}})};
  });
  const held=claims.filter(x=>x.review.status.startsWith("HOLD")).length;
  const outcome=matched.status!=="MATCHED_TO_SHA256_SNAPSHOT"?
   "HOLD_GOVERNMENT_RECORD_UNVERIFIED":claims.length===0?
   "HOLD_NO_ACCEPTED_SOURCE_QUOTES":held>0?
   "HOLD_UNSUPPORTED_INTERPRETATION":"REVIEW_REQUIRED_VERIFIED_SNAPSHOT_NOT_ENTAILMENT";
  const record={version:FIAL4_ENGINE,case_id:caseId,grant_id:item.grant_id,title:item.title,
   source_sha256:evidence.sha256,record_verification:matched.status,
   outcome,claims,held_claims:held,official_page_current:false,
   company_eligibility:"UNKNOWN",semantic_entailment_proven:false};
  const key=sha(JSON.stringify(record)).slice(0,30),json=join(audits,key+".json");
  const md=join(audits,key+".md");
  for(const [path,content] of [[json,JSON.stringify(record,null,2)+"\n"],[md,summary(record)]]){
   try{await writeFile(path,content,{flag:"wx"})}
   catch(e){if(e.code!=="EEXIST")throw e}
  }
  results.push({case_id:caseId,grant_id:item.grant_id,title:item.title,outcome,
   claims_checked:claims.length,claims_held:held,audit_file:json,summary_file:md});
 }
 const sqlite=join(outDir,"grounded-memory-v4.sqlite");
 try{const st=await lstat(sqlite);if(!st.isFile()||st.isSymbolicLink())
  throw Error("FIAL4_SQLITE_UNTRUSTED")}
 catch(e){if(e.code!=="ENOENT")throw e}
 const runId=randomUUID(),db=new DatabaseSync(sqlite);
 try{
  init(db);db.exec("BEGIN IMMEDIATE");
  try{
   db.prepare("INSERT INTO runs VALUES(?,?,?,?)").run(runId,date.toISOString(),evidence.sha256,results.length);
   const insert=db.prepare("INSERT INTO cases VALUES(?,?,?,?,?)");
   for(const c of results)insert.run(randomUUID(),runId,c.grant_id,c.outcome,c.claims_held);
   db.exec("COMMIT");
  }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}
 }finally{db.close()}
 const receipt={version:FIAL4_ENGINE,run_id:runId,utc:date.toISOString(),
  source_sha256:evidence.sha256,source_type:"SHA256_VERIFIED_SAVED_GOVERNMENT_CSV",
  official_page_live_reverification:"NOT_PERFORMED",cases:results,
  cases_audited:results.length,quotes_checked:results.reduce((n,c)=>n+c.claims_checked,0),
  claims_held:results.reduce((n,c)=>n+c.claims_held,0),
  semantic_entailments_proven:0,verified_eligibilities:0,
  network_requests:0,model_requests:0,rea_actions:0,
  applications_submitted:0,money_spent:0,service_restarts:0,
  status:"FIAL4_LOCAL_SOURCE_REVIEW_COMPLETE_NOT_ELIGIBILITY_PROOF"};
 const tmp=join(outDir,"last-run-"+randomUUID()+".tmp");
 await writeFile(tmp,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
 await rename(tmp,join(outDir,"last-run.json"));
 return receipt;
}
