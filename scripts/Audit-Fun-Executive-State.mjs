// FIAL5.4 Execution Audit: read-only measurement of actual local cycle,
// ranked evidence and remaining unimplemented authorities. No simulated work,
// model calls, automatic retries, remote APIs, or changes to source files.
import {readFile,readdir,stat,lstat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {homedir} from 'node:os';
export const VERSION='fial54-execution-audit-v1';
const ROOT=()=>join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial','ExecutiveOperatorV1');
const GRANT=()=>join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial','RealApplicationWorkerV1');
const OPTIONAL=async path=>{try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const isZero=x=>x===0;
export function inspectCycle({state,receipt,now=new Date(),packetsCount=null,grantReport=null,sourceEvidence=null,companyProfiles=null}={}){
 const errors=[],warnings=[];
 if(!isObject(state)||!isObject(receipt))return {version:VERSION,ledger_status:'HOLD_MISSING_STATE_OR_RECEIPT',errors:['Local state or cycle receipt missing'],warnings,expectation_met:false};
 if(state.version!=='fial5.4-executive-operator-v1'||receipt.version!==state.version)
  errors.push('Unrecognized worker or receipt version');
 if(!Array.isArray(state.items)||state.items.length!==state.active_items||
  state.active_items!==receipt.active_items||state.new_or_changed!==receipt.new_or_changed)
  errors.push('Work queue and receipt do not agree');
 if(state.cycle_utc!==receipt.cycle_utc||!Number.isFinite(Date.parse(state.cycle_utc)))
  errors.push('Cycle timestamp or receipt mismatch');
 const p=state.outbound_permissions||{},r=receipt.outbound_permissions||{};
 const actionNames=['email_sent','government_filings','spent_usd','rea_runs','source_patches','training_runs'];
 if(!actionNames.every(name=>isZero(p[name])&&isZero(r[name])))
  errors.push('External action ledger contains unsupported nonzero or missing permissions');
 const domains=['mail','filings','configuration','projects','funding','incentives','sales','vendors','finance','engineering','security'];
 if(!Array.isArray(state.domains)||domains.some(x=>!state.domains.includes(x)))
  errors.push('Eleven-domain inventory not present');
 const tasks=Array.isArray(state.items)?state.items:[];
 const buckets={generic_checklists:0,grant_candidates:0,read_only_email_headers:0,registered_projects:0,other:0};
 for(const t of tasks){
  if(t?.source==='operator_goal')buckets.generic_checklists++;
  else if(String(t?.source||'').startsWith('verified_local_grants_snapshot:'))buckets.grant_candidates++;
  else if(t?.source==='authorized_readonly_gmail_header')buckets.read_only_email_headers++;
  else if(t?.source==='operator_registered_unverified')buckets.registered_projects++;
  else buckets.other++;
  if(t?.executed_externally!==false||t?.external_action_authorized!==false)
   errors.push('Unverified external execution claim in work item');
 }
 const ageHours=(+now-Date.parse(state.cycle_utc))/36e5;
 if(!Number.isFinite(ageHours)||ageHours<-.05)errors.push('Cycle time invalid or in the future');
 else if(ageHours>8)warnings.push('Executive task may be overdue (>8 h); check Windows Task Scheduler');
 if(buckets.generic_checklists>=10)
  warnings.push('Most configured workstreams are generic checklists, not evidence-backed completed jobs');
 if(buckets.registered_projects===0)
  warnings.push('No real operator work-register projects loaded');
 if(state.mail_state!=='connected_read_only')
  warnings.push('Gmail inbox not connected; cannot triage live mail');
 if(buckets.read_only_email_headers===0)
  warnings.push('No live email messages in the work queue');
 const reportAge=grantReport&&Number.isFinite(Date.parse(grantReport.timestamp))?
 (+now-Date.parse(grantReport.timestamp))/36e5:null;
 const grantsFresh=reportAge!==null&&reportAge>=0&&reportAge<=36;
 if(!grantsFresh)warnings.push('No fresh (<36 h) signed-off local grants snapshot is confirmed');
 if(sourceEvidence?.status!=='SHA256_MATCHED')warnings.push('Official grants CSV bytes not verified against the saved SHA-256 during audit');
 if(packetsCount===null)warnings.push('Packet directory not checked');
 if(state.local_packets_written?.length!==receipt.prepared_packets)
  errors.push('Packet count in state does not match current-cycle receipt');
 const companies=Array.isArray(companyProfiles?.companies)?companyProfiles.companies:[];
 const verifiedCompanies=companies.filter(x=>x?.verified_registered_address&&x?.verified_state_status).length;
 if(verifiedCompanies<2)warnings.push('Both company profiles still lack verified registration or address evidence');
 if(!Array.isArray(state.items)||state.items.filter(x=>x.phase==='complete'||x.phase==='submitted').length===0)
  warnings.push('No confirmed completed work item or submitted external action in this ledger');
 // Current worker creates packets and prioritized work, but intentionally has
 // no email send, filing submission, project execution or autonomous code-edit adapter.
 const capabilities={
  scheduled_cycle_file:true,
  stateful_work_queue:errors.length===0,
  new_local_packets:Math.max(0,receipt.prepared_packets||0),
  actual_external_email_sends:false,
  actual_government_submissions:false,
  actual_configuration_changes:false,
  actual_completed_project_work:false,
  official_eligibility_automatically_verified:false,
  proactive_operator_review_packets:true
 };
 return {version:VERSION,ledger_status:errors.length?'HOLD_INVALID_LEDGER':'VALID_LOCAL_CYCLE',
  cycle_utc:state.cycle_utc,age_hours:Math.round(ageHours*10)/10,
  item_count:tasks.length,created_this_cycle:receipt.prepared_packets||0,
  new_or_changed:state.new_or_changed,packet_file_count:packetsCount,
  source_classes:buckets,mail_state:state.mail_state||'unknown',
  grants:{state:state.grants?.state||'unknown',last_scan_utc:grantReport?.timestamp||null,
   scan_age_hours:reportAge===null?null:Math.round(reportAge*10)/10,
   source_sha256:sourceEvidence?.status||'NOT_VERIFIED'},
  companies_with_verifiable_registration:verifiedCompanies,
  external_actions:errors.length?'UNVERIFIED':'ZERO_RECORDED',
  capabilities,errors,warnings,
  expectation_met:false,
  assessment:errors.length?'Cannot trust this local cycle evidence':
   'Executive is a scheduled evidence organizer; full autonomous email, filings and operational execution are NOT implemented'};
}
async function shaEvidence(report,grantRoot){
 if(!isObject(report)||!/^[a-f0-9]{64}$/.test(report.source_sha256||'')||typeof report.evidence_file!=='string')
  return {status:'REPORT_MISSING_SOURCE'};
 const evidenceDir=resolve(grantRoot,'evidence'),file=resolve(report.evidence_file);
 if(!isAbsolute(report.evidence_file)||!(file.startsWith(evidenceDir+sep))||!file.endsWith('.csv'))
  return {status:'UNTRUSTED_SOURCE_PATH'};
 try{
  if((await lstat(file)).isSymbolicLink())return {status:'SYMLINK_SOURCE_REFUSED'};
  const st=await stat(file);
  if(st.size>64*1024*1024||st.size===0)return {status:'SOURCE_SIZE_INVALID'};
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  return {status:hash.digest('hex')===report.source_sha256?'SHA256_MATCHED':'SHA256_MISMATCH'};
 }catch(e){if(e.code==='ENOENT')return {status:'SOURCE_FILE_MISSING'};return {status:'SOURCE_READ_FAILED'}}
}
export async function collectAudit({root=ROOT(),grantRoot=GRANT(),now=new Date()}={}){
 const state=await OPTIONAL(join(root,'state-v1.json'));
 const receipt=await OPTIONAL(join(root,'last-cycle-v1.json'));
 const report=await OPTIONAL(join(grantRoot,'last-run.json'));
 const profiles=await OPTIONAL(join(root,'company-profiles-v1.json'));
 let packetsCount=null;
 try{packetsCount=(await readdir(join(root,'packets'))).filter(x=>/^[a-f0-9]{22}-[a-f0-9]{12}\.md$/.test(x)).length}
 catch(e){if(e.code!=='ENOENT')throw e}
 const evidence=await shaEvidence(report,grantRoot);
 return inspectCycle({state,receipt,grantReport:report,companyProfiles:profiles,
  sourceEvidence:evidence,packetsCount,now});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1].replaceAll('\\','/')).href){
 if(process.argv.length!==3||process.argv[2]!=='--json'){
  console.error('FIAL54_AUDIT_READ_ONLY_JSON_REQUIRED');process.exitCode=2;
 }else{
  try{console.log(JSON.stringify(await collectAudit()))}
  catch(e){console.error('FIAL54_AUDIT_READ_HOLD='+String(e.message||e).slice(0,180));process.exitCode=1}
 }
}
