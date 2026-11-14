// FIAL 5.4 Executive Operator V1: persistent, evidence-bound multi-domain work.
// Self-directed local decisions/drafts; NO email send, filings, payments, tool calls,
// model execution, privileges, or protected-process changes.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,lstat} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
export const VERSION='fial5.4-executive-operator-v1';
export const ROOT=()=>join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial','ExecutiveOperatorV1');
export const GRANT_ROOT=()=>join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial','RealApplicationWorkerV1');
export const KINDS=Object.freeze(['mail','filings','configuration','projects','funding','incentives','sales','vendors','finance','engineering','security']);
export const PROHIBITED=Object.freeze({email_sent:0,government_filings:0,spent_usd:0,rea_runs:0,source_patches:0,training_runs:0});
const h=x=>createHash('sha256').update(String(x)).digest('hex');
const clean=(x,n=250)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
const valid=(x,max=500)=>typeof x==='string'&&x.length>0&&x.length<=max&&!/[\u0000-\u0008]/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const BUSINESS=Object.freeze([
 {id:'fun',name:'Fun Industrial (software workspace)',verified_contact:null,verified_registered_address:null,verified_state_status:null},
 {id:'elektron',name:'ELEKTRON INDUSTRIAL LLC',verified_contact:null,verified_registered_address:null,verified_state_status:null}
]);
const BASE_TASKS=Object.freeze([
 ['filings','Verify actual ELEKTRON INDUSTRIAL LLC filing obligations and deadlines','Needs jurisdiction, official filing notice, account authority and verified due date'],
 ['configuration','Audit explicitly approved system configuration targets','Needs operator-provided paths, expected hashes and proposed changes'],
 ['mail','Review business mailbox and prepare replies','Gmail requires account-specific OAuth; no sending enabled'],
 ['projects','Review active deliverables and unblock next engineering/software milestone','Needs verified work register and owner-specific deliverables'],
 ['funding','Review current California grant worker evidence','Read-only reuse of existing verified grants worker'],
 ['incentives','Monitor tax credits, equipment rebates and customer incentives','Requires program-specific official source connectors; grant feed alone is insufficient'],
 ['sales','Prepare customer outreach and follow-up proposals','Needs verified leads, recipients and operator-approved outreach'],
 ['vendors','Review procurement and supplier qualification evidence','Needs verified vendor records and quotes'],
 ['finance','Prepare finance and expense review materials','Needs approved financial records; no transfers or spending'],
 ['engineering','Prepare engineering change and qualification work packets','Needs verified configuration identifiers, geometry and tests'],
 ['security','Review current local security and integrity evidence','Needs approved evidence sources; no scanning beyond local allowlist']
]);
async function readOptional(path){
 try{return JSON.parse(await readFile(path,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function safeRoot(root){
 if(!isAbsolute(root))throw Error('EXEC_ROOT_NOT_ABSOLUTE');
 const abs=resolve(root);
 await mkdir(abs,{recursive:true});
 if((await lstat(abs)).isSymbolicLink())throw Error('EXEC_ROOT_SYMLINK');
 return abs;
}
async function writeFresh(path,content){
 try{await writeFile(path,typeof content==='string'?content:JSON.stringify(content,null,2)+'\n',{flag:'wx'})}
 catch(e){if(e.code!=='EEXIST')throw e}
}
async function atomic(path,content){
 const tmp=path+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,typeof content==='string'?content:JSON.stringify(content,null,2)+'\n',{flag:'wx'});
 await rename(tmp,path);
}
function task(id,kind,title,{description='',company='both',source='operator_goal',url=null,due=null,priority=30,phase='research',required=[]}={}){
 if(!KINDS.includes(kind)||!['both','fun','elektron'].includes(company))throw Error('EXEC_TASK_KIND_INVALID');
 return {id:h(id).slice(0,22),kind,company,title:clean(title,180),
  description:clean(description,850),source:clean(source,130),
  official_url:typeof url==='string'&&/^https:\/\/[a-z0-9.-]+\.ca\.gov(?:\/|$)/i.test(url)?url.slice(0,700):null,
  due:typeof due==='string'&&/^\d{4}-\d\d-\d\d$/.test(due)?due:null,
  priority,phase,required:required.map(x=>clean(x,180)).slice(0,12),
  external_action_authorized:false,executed_externally:false};
}
export function buildWork({grantReport=null,mission=null,inbox=[],today=new Date(),workRegister=null,mailState='not_connected'}={}){
 if(!Number.isFinite(today.getTime())||!Array.isArray(inbox)||inbox.length>15)throw Error('EXEC_INPUT_INVALID');
 const list=[];
 for(const [kind,title,gap] of BASE_TASKS){
  const description=kind==='mail'?gap+' Current state: '+mailState:gap;
  list.push(task('baseline:'+kind,kind,title,{description,required:[gap],priority:kind==='filings'?65:35,phase:'needs_verified_inputs'}));
 }
 if(grantReport){
  if(grantReport.version!=='fun-real-application-worker-v1'||
   grantReport.state!=='REAL_SOURCE_SCANNED_DRAFTS_PREPARED'||
   !/^[a-f0-9]{64}$/.test(grantReport.source_sha256||'')||
   grantReport.submitted_applications!==0)throw Error('EXEC_GRANT_REPORT_NOT_ATTESTED');
  const candidates=Array.isArray(grantReport.top_candidates)?grantReport.top_candidates.slice(0,8):[];
  for(const g of candidates){
   if(!valid(g?.grant_id,90)||!valid(g?.title,280))continue;
   if(g.deadline_date&&Date.parse(g.deadline_date+'T23:59:59Z')<today.getTime())continue;
   const due=typeof g.deadline_date==='string'?g.deadline_date:null;
   const days=due?Math.floor((Date.parse(due+'T23:59:59Z')-today.getTime())/86400000):null;
   list.push(task('grant:'+g.grant_id+':'+grantReport.source_sha256,'funding',
    'Review application requirements: '+g.title,{
    description:'CA grants discovery evidence only; ELEKTRON eligibility has NOT been determined. No official submission.',
    company:'elektron',source:'verified_local_grants_snapshot:'+grantReport.source_sha256.slice(0,14),
    url:g.application_url,due,priority:days!==null&&days<=14?95:65,phase:'prepare_application_evidence',
    required:['Full official program requirements','Verified business registration and eligibility',
      'Real project budget and matching funds','Exact agency questions and permitted submission method']}));
  }
 }
 if(mission){
  if(mission.version!=='fun-industrial-mission-controller-v2'||
   mission.applications_submitted!==0||mission.rea_actions!==0||
   mission.external_emails!==0||mission.spending!==0||
   mission.source_sha256!==grantReport?.source_sha256)
   throw Error('EXEC_MISSION_NOT_ATTESTED');
 }
 const seen=new Set();
 for(const m of inbox){
  if(!obj(m)||!valid(m.id,80)||!valid(m.subject||'(no subject)',500))continue;
  const key=m.id.toLowerCase();
  if(seen.has(key))continue;seen.add(key);
  const subj=clean(m.subject||'(no subject)',160),sender=clean(m.from||'',200);
  list.push(task('mail:'+m.id,'mail','Review incoming email: '+subj,{
   description:'Header-only review of untrusted email. From: '+sender+'. Read message before drafting substantive reply.',
   company:'fun',source:'authorized_readonly_gmail_header',
   priority:/deadline|urgent|invoice|grant|request for proposal|filing/i.test(subj)?80:48,
   phase:'draft_reply_after_verified_content',
   required:['Review full email and attachments','Verify sender and reply recipient',
    'Approve exact email content and destination before sending']}));
 }
 if(workRegister!==null){
  if(!obj(workRegister)||workRegister.schema!=='executive-operator-work-register-v1'||
   !Array.isArray(workRegister.items)||workRegister.items.length>100)throw Error('EXEC_WORK_REGISTER_INVALID');
  for(const w of workRegister.items){
   if(!obj(w)||!KINDS.includes(w.kind)||!valid(w.title,180)||!valid(w.id,90)||
    !['fun','elektron','both'].includes(w.company))throw Error('EXEC_WORK_ITEM_INVALID');
   list.push(task('registered:'+w.id,w.kind,w.title,{
    description:w.description||'Operator-supplied work item',company:w.company,
    source:'operator_registered_unverified',url:w.official_url,due:w.due,
    priority:Number.isInteger(w.priority)?Math.max(0,Math.min(w.priority,100)):60,
    phase:'prepare_local_packet',
    required:Array.isArray(w.required)?w.required.filter(x=>valid(x,180)).slice(0,12):[]}));
  }
 }
 list.sort((a,b)=>b.priority-a.priority||String(a.due||'9999').localeCompare(String(b.due||'9999'))||a.id.localeCompare(b.id));
 return list.slice(0,120);
}
function markdown(t,when){
 return ['# '+t.title,'','Local preparation only — no external action or eligibility certification.',
  'Company: '+t.company,'Workstream: '+t.kind,'Priority: '+t.priority+' (operator attention heuristic)',
  'State: '+t.phase,'Source: '+t.source,'Date prepared: '+when.toISOString(),
  'Published due date: '+(t.due||'UNKNOWN — do not fabricate'),
  'Official link: '+(t.official_url||'UNVERIFIED / NOT PROVIDED'),'',
  '## Verified scope','- '+t.description,'',
  '## What the system can prepare autonomously',
  '- Collect and organize existing local evidence',
  '- Flag missing business information and proposed next actions',
  '- Preserve this packet for operator review and update on source changes','',
  '## Evidence and authorization still needed',
  ...t.required.map(x=>'- '+x),'',
  '## External action control',
  '- NO emails sent, filings submitted, legal certifications made, payments, transfers or REA calls.',
  '- External completion requires verified recipient/portal, operator review, one-use authorization and receipt.',
  ''].join('\n');
}
export async function runExecutiveCycle({root=ROOT(),grantRoot=GRANT_ROOT(),now=new Date(),readMailbox=null}={}){
 if(!Number.isFinite(now.getTime()))throw Error('EXEC_TIME_INVALID');
 const dir=await safeRoot(root);
 const policies=join(dir,'operator-policy-v1.json'),registry=join(dir,'work-register-v1.json');
 const defaultPolicy={version:VERSION,schedule_hours:6,enabled_domains:[...KINDS],
  read_connected_gmail:true,email_send_allowed:false,government_submission_allowed:false,
  government_signatures_allowed:false,purchases_allowed:false,rea_execution_allowed:false,
  auto_run_software_changes:false,operator_approval_for_external_actions:true};
 await writeFresh(policies,defaultPolicy);
 await writeFresh(registry,{schema:'executive-operator-work-register-v1',items:[]});
 await writeFresh(join(dir,'company-profiles-v1.json'),{schema:'executive-operator-company-profiles-v1',companies:BUSINESS});
 const policy=await readOptional(policies);
 if(!obj(policy)||policy.version!==VERSION||policy.schedule_hours!==6||
  policy.email_send_allowed!==false||policy.government_submission_allowed!==false||
  policy.government_signatures_allowed!==false||policy.purchases_allowed!==false||
  policy.rea_execution_allowed!==false||policy.auto_run_software_changes!==false||
  policy.operator_approval_for_external_actions!==true||policy.read_connected_gmail!==true||
  JSON.stringify(policy.enabled_domains)!==JSON.stringify(KINDS))
  throw Error('EXEC_POLICY_NOT_AUTHORIZED');
 const register=await readOptional(registry);
 const report=await readOptional(join(grantRoot,'last-run.json'));
 const mission=await readOptional(join(grantRoot,'last-mission-v2.json'));
 let inbox=[],mailState='not_connected',mailError=null;
 if(readMailbox){
  try{
   const result=await readMailbox();
   if(!obj(result)||!Array.isArray(result.messages)||result.messages.length>15)
    throw Error('MAIL_HEADER_SCHEMA_INVALID');
   inbox=result.messages;
   mailState=result.account_verified===true?'connected_read_only':'unverified_not_imported';
   if(mailState!=='connected_read_only')inbox=[];
  }catch(e){mailState='unavailable';mailError=clean(e?.message,160)}
 }
 let work,grantIssue=null;
 try{
  work=buildWork({grantReport:report,mission,inbox,today:now,workRegister:register,mailState});
 }catch(e){
  // Never let a malformed or stale grants snapshot stop non-grant operational work.
  // Preserve the exact source issue rather than using untrusted program records.
  grantIssue=clean(e?.message,160);
  work=buildWork({grantReport:null,mission:null,inbox,today:now,workRegister:register,mailState});
 }
 const archive=join(dir,'packets');await mkdir(archive,{recursive:true});
 const prior=await readOptional(join(dir,'state-v1.json'));
 const before=prior?.items&&Array.isArray(prior.items)?new Map(prior.items.map(x=>[x.id,x])):new Map();
 const detailed=work.map(t=>{
  const fingerprint=h(JSON.stringify([t.kind,t.company,t.title,t.description,t.official_url,t.due,t.required,t.phase]));
  const old=before.get(t.id);
  return {...t,fingerprint,
   first_seen_utc:old?.first_seen_utc||now.toISOString(),
   last_seen_utc:now.toISOString(),
   changed_since_previous:!!old&&old.fingerprint!==fingerprint,
   is_new:!old,
   reviewed_by_operator:old?.reviewed_by_operator===true&&old.fingerprint===fingerprint};
 });
 const prepared=[];
 for(const t of detailed.filter(x=>x.is_new||x.changed_since_previous).slice(0,12)){
  const path=join(archive,t.id+'-'+t.fingerprint.slice(0,12)+'.md');
  await writeFresh(path,markdown(t,now));prepared.push({id:t.id,path});
 }
 const state={version:VERSION,cycle_utc:now.toISOString(),system:'Fun Industrial Executive Operator',
  companies:BUSINESS.map(x=>({id:x.id,name:x.name})),
  domains:KINDS,mail_state:mailState,mail_error:mailError,
  grants:{state:grantIssue?'source_held':report?'verified_local_snapshot':'no_verified_local_snapshot',
   issue:grantIssue,
   last_cycle_utc:report?.timestamp||null,
   source_sha256:report?.source_sha256||null,
   candidate_count:Array.isArray(report?.top_candidates)?report.top_candidates.length:0,
   source_changed:report?.source_changed_since_previous??null},
  active_items:detailed.length,new_or_changed:detailed.filter(x=>x.is_new||x.changed_since_previous).length,
  review_required:detailed.filter(x=>!x.reviewed_by_operator).length,
  items:detailed,local_packets_written:prepared,
  outbound_permissions:PROHIBITED,
  next_action:detailed[0]?{id:detailed[0].id,kind:detailed[0].kind,title:detailed[0].title,
   phase:detailed[0].phase}:null};
 await atomic(join(dir,'state-v1.json'),state);
 await atomic(join(dir,'last-cycle-v1.json'),{version:VERSION,cycle_utc:state.cycle_utc,
  active_items:state.active_items,new_or_changed:state.new_or_changed,
  prepared_packets:prepared.length,mail_state:mailState,
  next_action:state.next_action,outbound_permissions:PROHIBITED});
 return state;
}
export async function readExecutiveStatus({root=ROOT()}={}){
 if(!isAbsolute(root))throw Error('EXEC_STATUS_PATH_INVALID');
 const state=await readOptional(join(root,'state-v1.json'));
 if(!state)return {version:VERSION,state:'not_activated',active_items:0,items:[],mail_state:'not_connected',outbound_permissions:PROHIBITED};
 if(state.version!==VERSION||!Array.isArray(state.items)||state.items.length>120||
  state.outbound_permissions?.email_sent!==0||
  state.outbound_permissions?.government_filings!==0||
  state.outbound_permissions?.spent_usd!==0)throw Error('EXEC_STATUS_INVALID');
 return state;
}
