// FIAL v0.1: bytecode interpreter + SQLite transactional durable memory.
// Runs no OS commands, AI tool calls, web requests, applications, or grant submissions.
import {createHash,randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile,realpath,lstat} from "node:fs/promises";
import {resolve,join,sep} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {compileFial,FIAL_VERSION} from "./compiler-v1.mjs";

const DIGEST=/^[a-f0-9]{64}$/;
const SHA=value=>createHash("sha256").update(value).digest("hex");
const CLEAN=(v,cap=500)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,cap);
const MAX_CANDIDATES=60;
const SAFE_GRANT=/^[a-zA-Z0-9_./ -]{1,100}$/;
export const FIAL_RUNTIME="fial-runtime-v0.1";

function reportValid(report){
 if(!report||report.version!=="fun-real-application-worker-v1"||
    report.state!=="REAL_SOURCE_SCANNED_DRAFTS_PREPARED"||
    !DIGEST.test(report.source_sha256||"")||
    report.submitted_applications!==0||report.approved_spending!==0||
    !Array.isArray(report.top_candidates)||report.top_candidates.length>MAX_CANDIDATES)
  throw Error("FIAL_REJECTED_UNVERIFIED_GRANT_REPORT");
}
export async function verifyReportEvidence(report,directory){
 reportValid(report);
 const base=await realpath(resolve(directory));
 const evidenceDir=await realpath(join(base,"evidence"));
 const candidate=resolve(String(report.evidence_file||""));
 if(!candidate.startsWith(evidenceDir+sep))throw Error("FIAL_EVIDENCE_PATH_OUTSIDE_TRUST_ROOT");
 const info=await lstat(candidate);
 if(!info.isFile()||info.isSymbolicLink()||info.size>15*1024*1024)throw Error("FIAL_EVIDENCE_FILE_UNTRUSTED");
 const file=await readFile(candidate);
 if(SHA(file)!==report.source_sha256)throw Error("FIAL_EVIDENCE_HASH_MISMATCH");
 return {sha256:report.source_sha256,bytes:file.length,source_path:candidate};
}
function remainingDays(raw,now){
 const value=String(raw||"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const ms=Date.parse(value+"T23:59:59Z");
 return Number.isFinite(ms)?Math.ceil((ms-now.getTime())/86400000):null;
}
function fingerprint(g){
 return SHA(JSON.stringify([g.grant_id,g.agency,g.title,g.status,g.deadline_date,
  g.purpose,g.description_excerpt,g.estimated_awards,g.application_url]));
}
function missing(profile){
 return !profile||profile.eligible_business_verified!==true||
   !profile.registered_address||!profile.contact_name||
   !profile.proposed_project||!profile.verified_project_budget;
}
function predicates(g,prior,profile,now){
 const fp=fingerprint(g);
 const days=remainingDays(g.deadline_date,now);
 return {fp,days,flags:{
  new:!prior,
  changed:!!prior&&prior.fingerprint!==fp,
  deferred:!!prior&&prior.pending===1,
  urgent:days!==null&&days>=0&&days<=14,
  missing_evidence:missing(profile),
  always:true
 }};
}
function validGrant(g){
 return g&&typeof g.grant_id==="string"&&SAFE_GRANT.test(g.grant_id)&&
  typeof g.agency==="string"&&g.agency.length<=200&&
  typeof g.title==="string"&&g.title.length>0&&g.title.length<=400;
}
function initialise(db){
 db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000;");
 db.exec("CREATE TABLE IF NOT EXISTS memory (grant_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, pending INTEGER NOT NULL CHECK(pending IN (0,1)), last_rule TEXT NOT NULL, last_action TEXT NOT NULL, last_seen_utc TEXT NOT NULL)");
 db.exec("CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, grant_key TEXT NOT NULL, source_sha TEXT NOT NULL, program_sha TEXT NOT NULL, rule_name TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL, made_utc TEXT NOT NULL)");
}
function readState(db,key){
 return db.prepare("SELECT fingerprint,pending,last_rule,last_action FROM memory WHERE grant_key=?").get(key)||null;
}
function selectRule(program,flags){
 const active=program.instructions.filter(x=>flags[x.when]===true)
  .sort((a,b)=>b.score-a.score||a.line-b.line);
 return active[0]||null;
}
function safeBrief(g,{decision,rule,sourceHash,programHash,date,days,missingEvidence}){
 return [
 "# FIAL v0.1 — Grant Research Brief",
 "",
 "**PROGRAM:** "+CLEAN(programHash,64),
 "**SOURCE SHA-256:** "+sourceHash,
 "**GENERATED UTC:** "+date.toISOString(),
 "**STATUS:** LOCAL DRAFT — NOT SUBMITTED; ELIGIBILITY UNVERIFIED",
 "",
 "## Grant",
 "ID: "+CLEAN(g.grant_id,100),
 "Title: "+CLEAN(g.title,400),
 "Agency: "+CLEAN(g.agency,200),
 "Published deadline: "+CLEAN(g.deadline_date||"UNVERIFIED",90),
 "Days remaining: "+(days??"UNKNOWN"),
 "Published purpose: "+CLEAN(g.purpose||"NOT SUPPLIED",1800),
 "Published description excerpt: "+CLEAN(g.description_excerpt||"NOT SUPPLIED",1800),
 "Published applicant type: "+CLEAN(g.applicant_type||"UNVERIFIED",300),
 "Published grant URL: "+CLEAN(g.application_url||"UNVERIFIED",500),
 "",
 "## FIAL autonomous decision",
 "Rule: "+rule.name,
 "Reason: "+decision,
 "Operator business details missing: "+String(missingEvidence),
 "",
 "## Required review",
 "Validate actual grant eligibility and program deadline on the agency website.",
 "Complete real project details, budget, registration and contacts from approved company documents.",
 "Do not certify, sign, send, spend or submit without separate operator approval.",
 ""
 ].join("\n");
}
export async function executeFial({source,report,profile,directory,now=new Date()}={}){
 if(typeof directory!=="string"||!directory.trim())throw Error("FIAL_STORAGE_REQUIRED");
 const clock=new Date(now);if(!Number.isFinite(clock.getTime()))throw Error("FIAL_INVALID_TIME");
 const program=compileFial(source);
 if(program.bytecode!==FIAL_VERSION||program.source!=="GRANTS"||
   Object.values(program.authority).some(Boolean))throw Error("FIAL_CAPABILITY_VIOLATION");
 const base=resolve(directory);
 const witness=await verifyReportEvidence(report,base);
 const store=join(base,"fial");
 await mkdir(store,{recursive:true});
 const storeStat=await lstat(store);
 if(!storeStat.isDirectory()||storeStat.isSymbolicLink())throw Error("FIAL_STORAGE_UNTRUSTED");
 const dbPath=join(store,"fial-memory-v1.sqlite");
 try{
  const info=await lstat(dbPath);
  if(!info.isFile()||info.isSymbolicLink())throw Error("FIAL_SQLITE_PATH_UNTRUSTED");
 }catch(e){if(e.code!=="ENOENT")throw e}
 const db=new DatabaseSync(dbPath);
 const programHash=SHA(Buffer.from(source,"utf8"));
 const decisions=[],prepared=[];
 let skipped=0;
 try{
  initialise(db);
  db.exec("BEGIN IMMEDIATE");
  try{
   const insert=db.prepare("INSERT INTO decisions (id,grant_key,source_sha,program_sha,rule_name,action,reason,made_utc) VALUES (?,?,?,?,?,?,?,?)");
   const upsert=db.prepare("INSERT INTO memory (grant_key,fingerprint,pending,last_rule,last_action,last_seen_utc) VALUES (?,?,?,?,?,?) ON CONFLICT(grant_key) DO UPDATE SET fingerprint=excluded.fingerprint,pending=excluded.pending,last_rule=excluded.last_rule,last_action=excluded.last_action,last_seen_utc=excluded.last_seen_utc");
   const candidates=report.top_candidates.slice(0,MAX_CANDIDATES);
   const selected=[];
   for(const g of candidates){
    if(!validGrant(g)){skipped++;continue}
    const key=SHA(g.agency+"\n"+g.grant_id).slice(0,24);
    const previous=readState(db,key);
    const state=predicates(g,previous,profile,clock);
    const matched=selectRule(program,state.flags);
    if(!matched)continue;
    const eligibleForBrief=matched.action==="BRIEF"&&selected.length<program.budget;
    const act=matched.action==="BRIEF"&&!eligibleForBrief?"DEFER":matched.action;
    const reason=matched.when+" condition matched (score "+matched.score+"); "+act+" chosen";
    const d={key,grant_id:g.grant_id,title:CLEAN(g.title,300),rule:matched.name,
     condition:matched.when,action:act,reason,score:matched.score,
     fingerprint:state.fp,days_until_deadline:state.days};
    decisions.push(d);
    if(eligibleForBrief)selected.push({g,key,state,matched,d});
    upsert.run(key,state.fp,act==="DEFER"?1:0,matched.name,act,clock.toISOString());
    insert.run(randomUUID(),key,witness.sha256,programHash,matched.name,act,reason,clock.toISOString());
   }
   for(const {g,key,state,matched,d} of selected){
    const filename=key+"-"+state.fp.slice(0,12)+".md";
    const path=join(store,"briefs",filename);
    await mkdir(join(store,"briefs"),{recursive:true});
    const body=safeBrief(g,{decision:d.reason,rule:matched,sourceHash:witness.sha256,
     programHash,date:clock,days:state.days,missingEvidence:state.flags.missing_evidence});
    let created=false;
    try{await writeFile(path,body,{flag:"wx"});created=true}
    catch(e){if(e.code!=="EEXIST")throw e}
    prepared.push({grant_id:g.grant_id,path,new_file:created,rule:matched.name});
   }
   // Commit the decision ledger only after requested local output writes succeed.
   db.exec("COMMIT");
  }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}
 }finally{db.close()}
 const receipt={runtime:FIAL_RUNTIME,bytecode:program.bytecode,
  mission:program.mission,program_sha256:programHash,source_sha256:witness.sha256,
  completed_utc:clock.toISOString(),candidates_considered:report.top_candidates.length,
  skipped_invalid_ids:skipped,decisions:decisions.length,
  chosen_actions:decisions,briefs:prepared,
  applications_submitted:0,emails_sent:0,rea_actions:0,purchases:0,
  status:"FIAL_INTERPRETER_EXECUTED_LOCAL_ONLY"};
 const temp=join(store,"last-run-"+randomUUID()+".tmp");
 await writeFile(temp,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
 await (await import("node:fs/promises")).rename(temp,join(store,"last-run.json"));
 return receipt;
}
