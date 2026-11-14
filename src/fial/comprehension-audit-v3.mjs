// FIAL 3: deterministic second-pass audits of local FIAL 2 interpretations.
// Not a semantic entailment oracle. Plausible paraphrases remain unverified.
import {createHash,randomUUID} from "node:crypto";
import {readFile,writeFile,mkdir,rename,lstat,realpath} from "node:fs/promises";
import {join,resolve,sep} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {compileComprehension} from "./comprehension-compiler-v3.mjs";
import {verifyReportEvidence} from "./interpreter-v1.mjs";
import {matchGovernmentRecord} from "./semantic-engine-v2.mjs";
import {parseCsv} from "../applications/opportunity-worker-v1.mjs";

export const FIAL3_ENGINE="fial-comprehension-audit-v0.3";
const sha=x=>createHash("sha256").update(x).digest("hex");
const short=(s,n=240)=>String(s??"").replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,n);
const COLUMN={applicant_type:"ApplicantType",purpose:"Purpose",description:"Description",
 geography:"Geography",deadline:"ApplicationDeadline",funding:"EstAmounts"};
const STOP=new Set(["a","an","the","to","for","of","is","are","be","by","it","its",
 "as","in","on","at","and","or","this","that","these","those","with","from",
 "which","who","they","their","may","can","will","would","could","should",
 "has","have","been","being","provides","provide","purpose"]);
function words(text){
 const v=short(text,1200).toLowerCase().replace(/[\u2019']/g,"");
 return [...new Set((v.match(/[a-z0-9]+/g)||[])
  .filter(x=>x.length>2&&!STOP.has(x)).map(x=>x.endsWith("ies")?x.slice(0,-3)+"y":
    x.endsWith("ing")&&x.length>6?x.slice(0,-3):
    x.endsWith("s")&&x.length>4?x.slice(0,-1):x))];
}
function numbers(s){return [...new Set((String(s).match(/\b\d[\d,.]*(?:%|(?:st|nd|rd|th))?\b/g)||[]))]}
export function auditInterpretation({field,quote,interpretation},fields){
 const findings=[],source=fields?.[field];
 if(typeof quote!=="string"||typeof interpretation!=="string"||
  typeof field!=="string"||!Object.hasOwn(fields||{},field)||
  quote.length<8||quote.length>200||!String(source||"").includes(quote)){
  return {status:"HOLD_QUOTE_NOT_VERIFIED",findings:["QUOTE_NOT_IN_ORIGINAL_SOURCE_FIELD"],
   lexical_overlap:null,new_numbers:[],interpretation_verified:false};
 }
 const q=words(quote),a=words(interpretation);
 const shared=a.filter(t=>q.includes(t));
 const ratio=a.length?shared.length/a.length:0;
 const fresh=numbers(interpretation).filter(t=>!numbers(quote).includes(t));
 if(fresh.length)findings.push("NUMERIC_ASSERTION_NOT_IN_QUOTED_EVIDENCE");
 const certainty=/(?:\b(?:automatically|guaranteed|definitely|certainly)\b.{0,35}\b(?:qualif|eligible|approv|award|receive)\w*|\b(?:is|are|was|has been|have been)\s+(?:approved|awarded|eligible|qualified)\b|\b(?:will|shall)\s+(?:receive|qualify|be approved|be awarded)\b)/i;
 if(certainty.test(interpretation)&&!certainty.test(quote))
  findings.push("UNSUPPORTED_ELIGIBILITY_OR_AWARD_CERTAINTY");
 if(/\b(?:fun industrial|elektron industrial|our company|our business)\b/i.test(interpretation)&&
    !/\b(?:fun industrial|elektron industrial|our company|our business)\b/i.test(quote))
  findings.push("COMPANY_SPECIFIC_INFERENCE_NOT_IN_QUOTE");
 const qNeg=/(?:\b(?:not|no|never|cannot|prohibited|ineligible)\b)/i.test(quote);
 const aNeg=/(?:\b(?:not|no|never|cannot|prohibited|ineligible)\b)/i.test(interpretation);
 if(qNeg!==aNeg)findings.push("POSSIBLE_POLARITY_DIFFERENCE");
 if(shared.length<2||ratio<0.25)findings.push("LOW_LEXICAL_ALIGNMENT_NOT_A_DISPROOF");
 return {status:findings.length?"HOLD_FOR_COMPREHENSION_REVIEW":"PLAUSIBLE_PARAPHRASE_REVIEW_REQUIRED",
  findings,shared_lexical_terms:shared.slice(0,14),
  lexical_overlap:Number(ratio.toFixed(3)),new_numbers:fresh.slice(0,12),
  interpretation_verified:false};
}
function canonicalFields(row,fields){
 const clean=x=>String(x??"").replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,900);
 return Object.fromEntries(Object.keys(fields).map(k=>[k,clean(row?.[COLUMN[k]])]));
}
async function loadOrdinaryJson(path,maxBytes){
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size>maxBytes)throw Error("FIAL3_UNTRUSTED_INPUT_FILE");
 return JSON.parse(await readFile(path,"utf8"));
}
function renderAudit(a){
 const lines=["# FIAL v0.3 — Independent comprehension audit",
  "**Grant:** "+short(a.title,240),
  "**Source:** "+a.government_source_status,
  "**Outcome:** "+a.outcome,
  "**Eligibility:** UNKNOWN — never inferred from a model paraphrase",
  "**Original snapshot SHA-256:** "+a.source_sha256,
  "",
  "## Model statements and evidence checks"];
 if(!a.claim_audits.length)lines.push("No accepted source-grounded model claims available to audit.");
 for(const x of a.claim_audits){
  lines.push("### "+short(x.field,40),
   "Source quote: "+short(x.source_quote,210),
   "Model interpretation: "+short(x.model_interpretation_unverified,360),
   "Audit status: "+x.audit.status,
   "Lexical overlap (descriptive heuristic only): "+(x.audit.lexical_overlap??"N/A"),
   "Findings: "+(x.audit.findings.join(", ")||"No deterministic red flags"));
 }
 lines.push("","## Unsupported model quotes",
  "Prior rejection count: "+a.rejected_quote_count,
  "A rejected quote is not proof of a false interpretation; verify the original wording.",
  "","## Authority",
  "No outreach, spending, approval, application submission, model call or REA action.",
  "This audit does NOT establish semantic entailment or grant eligibility.");
 return lines.join("\n")+"\n";
}
function initDb(db){
 db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1500");
 db.exec("CREATE TABLE IF NOT EXISTS audit_runs (run_id TEXT PRIMARY KEY, created_utc TEXT NOT NULL, snapshot_sha TEXT NOT NULL, cases INTEGER NOT NULL, provisional INTEGER NOT NULL)");
 db.exec("CREATE TABLE IF NOT EXISTS audit_cases (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, grant_id TEXT NOT NULL, outcome TEXT NOT NULL, provisional_claims INTEGER NOT NULL, held_claims INTEGER NOT NULL)");
}
export async function runComprehensionAudit({source,report,semanticReceipt,directory,now=new Date()}={}){
 const program=compileComprehension(source);
 if(typeof directory!=="string"||!directory.trim())throw Error("FIAL3_STORAGE_REQUIRED");
 const date=new Date(now);if(!Number.isFinite(+date))throw Error("FIAL3_INVALID_DATE");
 const root=resolve(directory), evidence=await verifyReportEvidence(report,root);
 if(semanticReceipt?.version!=="fial-semantic-engine-v0.2"||
  semanticReceipt?.source_sha256!==evidence.sha256||
  !Array.isArray(semanticReceipt.cases)||semanticReceipt.cases.length>program.maximumCases)
  throw Error("FIAL3_REPORT_AND_SOURCE_MISMATCH");
 const csv=await readFile(evidence.source_path),rows=parseCsv(csv.toString("utf8"));
 const v2Dir=await realpath(join(root,"fial","semantic-v2","cases"));
 const outputDir=join(root,"fial","semantic-v3"),auditsDir=join(outputDir,"audits");
 await mkdir(auditsDir,{recursive:true});
 if((await lstat(auditsDir)).isSymbolicLink())throw Error("FIAL3_OUTPUT_DIR_LINK_REFUSED");
 const results=[],runId=randomUUID();
 for(const candidate of semanticReceipt.cases){
  if(!/^[a-f0-9]{30}$/.test(candidate?.case_id||""))throw Error("FIAL3_INVALID_CASE_ID");
  const name=candidate.case_id+".json",input=resolve(v2Dir,name);
  if(!input.startsWith(v2Dir+sep))throw Error("FIAL3_CASE_ESCAPE");
  const caseFile=await loadOrdinaryJson(input,100_000);
  if(caseFile.case_id!==candidate.case_id||caseFile.grant_id!==candidate.grant_id||
   caseFile.title!==candidate.title||caseFile.source_sha256!==evidence.sha256)
   throw Error("FIAL3_CASE_INTEGRITY_MISMATCH");
  const listing=report.top_candidates.find(x=>x.grant_id===caseFile.grant_id&&
   x.title===caseFile.title);
  const match=listing?matchGovernmentRecord(listing,rows):{status:"NO_MATCHING_CANDIDATE"};
  const fields=caseFile.source_fields||{};
  if(!fields||typeof fields!=="object"||Array.isArray(fields)||
   Object.keys(fields).some(k=>!Object.hasOwn(COLUMN,k)))
    throw Error("FIAL3_INVALID_FIELD_MAP");
  if(match.row){
   const canonical=canonicalFields(match.row,fields);
   if(Object.keys(canonical).some(k=>String(fields[k])!==canonical[k]))
    throw Error("FIAL3_SOURCE_FIELD_TAMPER_DETECTED");
  }
  const accepted=caseFile.model?.accepted;
  if(!Array.isArray(accepted)||accepted.length>12)throw Error("FIAL3_INVALID_MODEL_CLAIMS");
  const audited=accepted.map(x=>({field:short(x.field,40),source_quote:short(x.source_quote,200),
   model_interpretation_unverified:short(x.model_interpretation_unverified,350),
   audit:auditInterpretation({field:x.field,quote:x.source_quote,
    interpretation:x.model_interpretation_unverified},fields)}));
  const good=audited.filter(x=>x.audit.status==="PLAUSIBLE_PARAPHRASE_REVIEW_REQUIRED").length;
  const held=audited.length-good;
  const outcome=match.status!=="MATCHED_TO_SHA256_SNAPSHOT"?
    "HOLD_GOVERNMENT_RECORD_NOT_VERIFIED":audited.length===0?
    "HOLD_NO_ACCEPTED_SOURCE_QUOTES":held>0?
    "HOLD_UNSUPPORTED_OR_AMBIGUOUS_INFERENCES":"PROVISIONAL_TEXTUAL_CONSISTENCY_ONLY";
  const audit={version:FIAL3_ENGINE,case_id:candidate.case_id,
   grant_id:caseFile.grant_id,title:caseFile.title,
   government_source_status:match.status,source_sha256:evidence.sha256,
   outcome,claim_audits:audited,plausible_claims:good,held_claims:held,
   rejected_quote_count:caseFile.model?.rejected?.length||0,
   interpretation_verified:false,company_eligibility:"UNKNOWN"};
  const file=join(auditsDir,candidate.case_id+".json");
  const md=join(auditsDir,candidate.case_id+".md");
  try{await writeFile(file,JSON.stringify(audit,null,2)+"\n",{flag:"wx"})}
  catch(e){if(e.code!=="EEXIST")throw e}
  try{await writeFile(md,renderAudit(audit),{flag:"wx"})}
  catch(e){if(e.code!=="EEXIST")throw e}
  results.push({case_id:audit.case_id,grant_id:audit.grant_id,title:audit.title,
   outcome,plausible_claims:good,held_claims:held,
   accepted_quotes:audited.length,rejected_quotes:audit.rejected_quote_count,
   audit_file:file,summary_file:md});
 }
 const dbPath=join(outputDir,"comprehension-memory-v3.sqlite");
 try{const info=await lstat(dbPath);if(!info.isFile()||info.isSymbolicLink())
  throw Error("FIAL3_UNTRUSTED_SQLITE_FILE")}
 catch(e){if(e.code!=="ENOENT")throw e}
 const db=new DatabaseSync(dbPath);
 try{
  initDb(db);db.exec("BEGIN IMMEDIATE");
  try{
   db.prepare("INSERT INTO audit_runs VALUES(?,?,?,?,?)").run(runId,date.toISOString(),
    evidence.sha256,results.length,results.reduce((n,x)=>n+x.plausible_claims,0));
   const add=db.prepare("INSERT INTO audit_cases VALUES(?,?,?,?,?,?)");
   for(const r of results)add.run(randomUUID(),runId,r.grant_id,r.outcome,
    r.plausible_claims,r.held_claims);
   db.exec("COMMIT");
  }catch(e){try{db.exec("ROLLBACK")}catch{}throw e}
 }finally{db.close()}
 const receipt={version:FIAL3_ENGINE,run_id:runId,created_utc:date.toISOString(),
  mission:program.mission,source_sha256:evidence.sha256,cases:results,
  count:results.length,plausible_claims:results.reduce((n,x)=>n+x.plausible_claims,0),
  claims_held:results.reduce((n,x)=>n+x.held_claims,0),
  sqlite_memory:dbPath,claims_proven_by_entailment:0,verified_eligibilities:0,
  tool_actions:0,external_requests:0,applications_submitted:0,money_spent:0,
  status:"FIAL3_LOCAL_COMPREHENSION_AUDIT_COMPLETE_NOT_PROOF_OF_UNDERSTANDING"};
 const temp=join(outputDir,"last-run-"+randomUUID()+".tmp");
 await writeFile(temp,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
 await rename(temp,join(outputDir,"last-run.json"));
 return receipt;
}
