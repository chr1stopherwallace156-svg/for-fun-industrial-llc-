// FIAL 4 Live: official California Grants Portal daily CSV verification.
// Bounded official GET only. No model, REA, company eligibility claim, submissions or spending.
import {createHash,randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile,rename,lstat,realpath} from "node:fs/promises";
import {join,resolve,sep} from "node:path";
import {homedir} from "node:os";
import {DatabaseSync} from "node:sqlite";
import {parseCsv,SOURCE_CSV,SOURCE_PAGE} from "../applications/opportunity-worker-v1.mjs";

export const LIVE_VERSION="fial-live-official-v0.4.1";
export const DEFAULT_DIR=join(process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),
 "FunIndustrial","RealApplicationWorkerV1");
const SOURCE_HOST=new URL(SOURCE_CSV).hostname;
const MAX_BYTES=15*1024*1024;
const HASH=x=>createHash("sha256").update(x).digest("hex");
const safe=(x,n=450)=>String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,n);
const KEYS=Object.freeze(["Status","LastUpdated","Purpose","Description","ApplicantType",
 "ApplicantTypeNotes","Geography","MatchingFunds","EstAmounts","EstAvailFunds",
 "ApplicationDeadline","OpenDate","GrantURL","AgencyDept","Title"]);
const COLUMNS=Object.freeze({applicant_type:"ApplicantType",purpose:"Purpose",
 description:"Description",geography:"Geography",deadline:"ApplicationDeadline",
 funding:"EstAmounts"});
const CASE=/^[0-9a-f]{30}$/;
async function ordinary(path,max=200000){
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>max)
  throw Error("FIAL4_LIVE_UNTRUSTED_INPUT");
 return JSON.parse(await readFile(path,"utf8"));
}
async function directory(path){
 await mkdir(path,{recursive:true});
 const st=await lstat(path);
 if(!st.isDirectory()||st.isSymbolicLink())throw Error("FIAL4_LIVE_UNTRUSTED_DIRECTORY");
 return realpath(path);
}
function officialPage(row){
 const id=String(row?.PortalID||"").trim();
 return /^\d{1,10}$/.test(id)?"https://www.grants.ca.gov/grants/"+id+"/":null;
}
function publishedValues(row){
 return Object.fromEntries(KEYS.map(k=>[k,safe(row?.[k],k==="Description"?1200:650)]));
}
async function boundedGet(fetchImpl){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),50000);
 async function request(url,redirect){
  return fetchImpl(url,{method:"GET",redirect,signal:ctl.signal,
   headers:{accept:"text/csv,application/octet-stream;q=0.8,*/*;q=0.1"}});
 }
 try{
  let response=await request(SOURCE_CSV,"manual");
  if([301,302,303,307,308].includes(response.status)){
   const to=new URL(response.headers.get("location")||"",SOURCE_CSV);
   if(to.protocol!=="https:"||to.username||to.password||to.port||
      !/^[0-9a-f]{32}\.us\.r2\.cloudflarestorage\.com$/i.test(to.hostname))
    throw Error("FIAL4_LIVE_REDIRECT_REFUSED");
   response=await request(to.href,"error");
  }
  if(!response.ok||!response.body)throw Error("FIAL4_LIVE_SOURCE_HTTP_"+response.status);
  if(Number(response.headers.get("content-length")||0)>MAX_BYTES)
   throw Error("FIAL4_LIVE_SOURCE_SIZE_LIMIT");
  let size=0;const parts=[];
  for await(const block of response.body){
   size+=block.length;
   if(size>MAX_BYTES)throw Error("FIAL4_LIVE_SOURCE_SIZE_LIMIT");
   parts.push(block);
  }
  const bytes=Buffer.concat(parts);
  if(bytes.length<200)throw Error("FIAL4_LIVE_SOURCE_TOO_SMALL");
  return bytes;
 }finally{clearTimeout(timer)}
}
function caseIntegrity(caseFile,item,sha){
 if(caseFile.case_id!==item.case_id||caseFile.grant_id!==item.grant_id||
    caseFile.title!==item.title||caseFile.source_sha256!==sha||
    !caseFile.source_fields||typeof caseFile.source_fields!=="object"||
    Array.isArray(caseFile.source_fields)||Object.keys(caseFile.source_fields)
    .some(x=>!Object.hasOwn(COLUMNS,x)))
  throw Error("FIAL4_LIVE_SAVED_CASE_MISMATCH");
}
async function loadBaseline(root){
 const receipt=await ordinary(join(root,"fial","grounded-v4","last-run.json"));
 if(receipt.version!=="fial-grounded-review-v0.4"||
    !/^[0-9a-f]{64}$/.test(receipt.source_sha256||"")||
    !Array.isArray(receipt.cases)||receipt.cases.length>3||
    receipt.network_requests!==0||receipt.applications_submitted!==0)
  throw Error("FIAL4_LIVE_UNVERIFIED_BASELINE");
 const folder=await realpath(join(root,"fial","semantic-v2","cases"));
 const selected=[];
 for(const item of receipt.cases){
  if(!CASE.test(item.case_id||""))throw Error("FIAL4_LIVE_CASE_ID_INVALID");
  const path=resolve(folder,item.case_id+".json");
  if(!path.startsWith(folder+sep))throw Error("FIAL4_LIVE_CASE_PATH_ESCAPE");
  const caseFile=await ordinary(path);
  caseIntegrity(caseFile,item,receipt.source_sha256);
  selected.push({grant_id:item.grant_id,title:item.title,case_id:item.case_id,
   baseline_fields:caseFile.source_fields});
 }
 return {snapshot_sha256:receipt.source_sha256,cases:selected};
}
export function compareCurrentRecord(candidate,rows,priorCase=null){
 const id=safe(candidate.grant_id,120);
 const matches=rows.filter(x=>safe(x.GrantID||x.PortalID,120)===id);
 if(matches.length!==1){
  return {grant_id:id,title:safe(candidate.title,240),
   state:matches.length?"HOLD_DUPLICATE_OFFICIAL_ID":"HOLD_ID_NOT_FOUND_IN_LIVE_FEED",
   changed_fields:[],baseline_differences:[],published:{},official_page:null,
   record_sha256:null};
 }
 const row=matches[0],values=publishedValues(row);
 const previous=priorCase?.published||{};
 const changed=Object.keys(previous).length?
  KEYS.filter(k=>previous[k]!==values[k]):[];
 const baselineDiff=Object.entries(candidate.baseline_fields||{})
  .filter(([k,v])=>Object.hasOwn(COLUMNS,k)&&v!==safe(row[COLUMNS[k]],900))
  .map(([k])=>k);
 const identityOK=safe(row.Title,240)===safe(candidate.title,240);
 const state=!identityOK?"HOLD_OFFICIAL_RECORD_TITLE_CHANGED":
  safe(row.AgencyDept,180)? "OFFICIAL_PORTAL_RECORD_RETRIEVED":"HOLD_AGENCY_MISSING";
 return {grant_id:id,title:safe(row.Title,240),state,
  changed_fields:changed,baseline_differences:baselineDiff,
  published:values,official_page:officialPage(row),
  record_sha256:HASH(JSON.stringify(values))};
}
function init(db){
 db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000");
 db.exec("CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,utc TEXT NOT NULL,source_sha TEXT NOT NULL,records INTEGER NOT NULL,cases INTEGER NOT NULL)");
 db.exec("CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,grant_id TEXT NOT NULL,state TEXT NOT NULL,changed INTEGER NOT NULL)");
}
async function latestReceipt(path){
 try{
  const last=await ordinary(path,500000);
  return last.version===LIVE_VERSION&&Array.isArray(last.cases)&&last.cases.length<=3?last:null;
 }catch(e){if(e.code==="ENOENT")return null;throw e}
}
export async function refreshOfficialGrants({directory:rootDir=DEFAULT_DIR,fetchImpl=fetch,now=new Date()}={}){
 const when=new Date(now);
 if(!Number.isFinite(+when))throw Error("FIAL4_LIVE_DATE_INVALID");
 const root=await realpath(resolve(rootDir));
 const baseline=await loadBaseline(root);
 const bytes=await boundedGet(fetchImpl);
 const rows=parseCsv(bytes.toString("utf8"));
 if(rows.length<100)throw Error("FIAL4_LIVE_DATASET_UNEXPECTEDLY_SMALL");
 const sha=HASH(bytes);
 const live=await directory(join(root,"fial","live-v4"));
 const snapshotDir=await directory(join(live,"snapshots"));
 const auditsDir=await directory(join(live,"audits"));
 const lastPath=join(live,"last-run.json"),previous=await latestReceipt(lastPath);
 const prevById=new Map((previous?.cases||[]).map(x=>[x.grant_id,x]));
 const cases=baseline.cases.map(x=>compareCurrentRecord(x,rows,prevById.get(x.grant_id)));
 const snapshot=join(snapshotDir,sha+".csv");
 try{await writeFile(snapshot,bytes,{flag:"wx"})}
 catch(e){
  if(e.code!=="EEXIST")throw e;
  const stat=await lstat(snapshot);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==bytes.length||
     HASH(await readFile(snapshot))!==sha)throw Error("FIAL4_LIVE_SNAPSHOT_COLLISION");
 }
 const runId=randomUUID(),receipt={version:LIVE_VERSION,run_id:runId,
  verified_at_utc:when.toISOString(),
  official_source:SOURCE_PAGE,official_csv_source:SOURCE_CSV,
  official_feed_host:SOURCE_HOST,official_source_sha256:sha,
  baseline_source_sha256:baseline.snapshot_sha256,
  saved_snapshot:snapshot,records_in_official_feed:rows.length,
  cases,official_feed_record_matches:cases.filter(x=>x.state==="OFFICIAL_PORTAL_RECORD_RETRIEVED").length,
  state:cases.every(x=>x.state==="OFFICIAL_PORTAL_RECORD_RETRIEVED")?
   "LIVE_OFFICIAL_FEED_RETRIEVED":"LIVE_FEED_RETRIEVED_WITH_RECORD_HOLDS",
  agency_program_rules_verified:false,company_eligibility:"UNKNOWN",
  network_requests:1,rea_actions:0,submissions:0,money_spent:0,service_restarts:0};
 const audit=join(auditsDir,runId+".json");
 await writeFile(audit,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
 const dbPath=join(live,"live-memory-v4.sqlite");
 try{
  const st=await lstat(dbPath);
  if(!st.isFile()||st.isSymbolicLink())throw Error("FIAL4_LIVE_SQLITE_PATH_UNTRUSTED");
 }catch(e){if(e.code!=="ENOENT")throw e}
 const db=new DatabaseSync(dbPath);
 try{
  init(db);db.exec("BEGIN IMMEDIATE");
  try{
   db.prepare("INSERT INTO runs VALUES(?,?,?,?,?)").run(runId,when.toISOString(),sha,rows.length,cases.length);
   const insert=db.prepare("INSERT INTO cases VALUES(?,?,?,?,?)");
   for(const c of cases)insert.run(randomUUID(),runId,c.grant_id,c.state,c.changed_fields.length);
   db.exec("COMMIT");
  }catch(e){try{db.exec("ROLLBACK")}catch{}throw e}
 }finally{db.close()}
 const tmp=join(live,"last-run-"+runId+".tmp");
 await writeFile(tmp,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
 await rename(tmp,lastPath);
 return receipt;
}
export function compactReceipt(r,{now=new Date()}={}){
 const ageMs=Date.now()-new Date(r.verified_at_utc).getTime();
 return {version:r.version,state:r.state,
  freshness:Number.isFinite(ageMs)&&ageMs<30*3600*1000?"recent":"stale",
  verified_at_utc:r.verified_at_utc,official_source:r.official_source,
  official_source_sha256:r.official_source_sha256,
  rows:r.records_in_official_feed,matches:r.official_feed_record_matches,
  company_eligibility:"UNKNOWN",agency_program_rules_verified:false,
  cases:r.cases.map(c=>({grant_id:c.grant_id,title:c.title,state:c.state,
   changed_fields:c.changed_fields,baseline_differences:c.baseline_differences,
   published:{Status:c.published.Status,LastUpdated:c.published.LastUpdated,
    ApplicationDeadline:c.published.ApplicationDeadline,
    ApplicantType:c.published.ApplicantType,EstAmounts:c.published.EstAmounts},
   official_page:c.official_page})),
  submissions:0,rea_actions:0,money_spent:0};
}
export async function currentLiveStatus({directory:rootDir=DEFAULT_DIR}={}){
 try{
  const last=await latestReceipt(join(rootDir,"fial","live-v4","last-run.json"));
  if(!last)return {version:LIVE_VERSION,state:"not_run",company_eligibility:"UNKNOWN"};
  if(last.network_requests!==1||last.rea_actions!==0||last.submissions!==0||
     last.money_spent!==0||last.service_restarts!==0||
     last.company_eligibility!=="UNKNOWN")
   throw Error("UNTRUSTED_LIVE_RECEIPT");
  return compactReceipt(last);
 }catch(e){
  return {version:LIVE_VERSION,state:"hold",
   reason:"CACHED_RECEIPT_UNAVAILABLE_OR_UNTRUSTED",company_eligibility:"UNKNOWN"};
 }
}
export function createLiveController({refresh=refreshOfficialGrants,status=currentLiveStatus}={}){
 let running=false,lastError=null,latestAttempt=null;
 return Object.freeze({
  async refresh(){
   if(running)return {version:LIVE_VERSION,state:"busy",last_attempt_utc:latestAttempt};
   running=true;latestAttempt=new Date().toISOString();
   try{
    const r=await refresh();
    lastError=null;return compactReceipt(r);
   }catch(e){
    lastError=safe(e?.message||e,180);
    return {version:LIVE_VERSION,state:"hold",reason:lastError,
     company_eligibility:"UNKNOWN",last_attempt_utc:latestAttempt};
   }finally{running=false}
  },
  async status(){
   const cached=await status();
   return {...cached,refresh_running:running,last_error:lastError,
    last_attempt_utc:latestAttempt};
  }
 });
}
