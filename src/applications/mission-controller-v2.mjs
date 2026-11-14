// FUN INDUSTRIAL MISSION CONTROLLER V2
// A persistent goal-driven operating worker. Acts on real California grant evidence.
// Authority: read public source, prioritize, write local briefs. NEVER submit or spend.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
export const VERSION='fun-industrial-mission-controller-v2';
const H=x=>createHash('sha256').update(x).digest('hex');
const clean=(x,n=2400)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n).trim();
const MAX_PAGE=220000;
export const DEFAULT_MISSION=Object.freeze({
 schema:'fun-industrial-mission-policy-v2',
 goal:'Find real California funding opportunities for Fun Industrial, independently research the best candidates, and prepare evidence-backed application materials.',
 max_briefs_per_cycle:3,max_official_pages_per_cycle:1,
 grant_submissions_allowed:false,external_emails_allowed:false,purchases_allowed:false,
 rea_execution_allowed:false,eligibility_autocertification_allowed:false
});
async function load(file,fallback){
 try{return JSON.parse(await readFile(file,'utf8'))}
 catch(e){if(e.code==='ENOENT')return fallback;throw e}
}
async function atomic(file,value){
 const tmp=file+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 await rename(tmp,file);
}
function official(url){
 try{
  const p=new URL(url);
  return p.protocol==='https:'&&!p.username&&!p.password&&!p.port&&
   /(?:^|\.)ca\.gov$|(?:^|\.)grants\.gov$/.test(p.hostname)&&p.href.length<=1200?p.href:null;
 }catch{return null}
}
function until(date,now){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const d=Date.parse(date+'T23:59:59Z');
 return Number.isFinite(d)?Math.ceil((d-now.getTime())/86400000):null;
}
function gaps(profile){
 const missing=[];
 for(const [key,label] of [['registered_address','registered address'],['contact_name','contact person'],
 ['contact_email','business email'],['proposed_project','actual project narrative'],
 ['verified_project_budget','documented project budget']]){
  if(typeof profile?.[key]!=='string'||!profile[key].trim())missing.push(label);
 }
 if(profile?.eligible_business_verified!==true)missing.push('verified organization and program eligibility');
 return missing;
}
export function chooseWork(report,prior={},profile={},mission=DEFAULT_MISSION,now=new Date()){
 if(report?.version!=='fun-real-application-worker-v1'||report?.state!=='REAL_SOURCE_SCANNED_DRAFTS_PREPARED'||
  report.submitted_applications!==0||!/^[a-f0-9]{64}$/.test(report?.source_sha256||''))
  throw Error('MISSION_VERIFIED_LIVE_SCAN_REQUIRED');
 if(mission?.schema!==DEFAULT_MISSION.schema||mission.grant_submissions_allowed!==false||
  mission.external_emails_allowed!==false||mission.purchases_allowed!==false||
  mission.rea_execution_allowed!==false||mission.eligibility_autocertification_allowed!==false||
  !Number.isInteger(mission.max_briefs_per_cycle)||mission.max_briefs_per_cycle<0||mission.max_briefs_per_cycle>3||
  !Number.isInteger(mission.max_official_pages_per_cycle)||mission.max_official_pages_per_cycle<0||
  mission.max_official_pages_per_cycle>1)throw Error('MISSION_AUTHORITY_POLICY_DENIED');
 if(!Number.isFinite(new Date(now).getTime()))throw Error('MISSION_TIME_INVALID');
 const choices=[],old=prior?.entries&&typeof prior.entries==='object'?prior.entries:{};
 for(const grant of Array.isArray(report.top_candidates)?report.top_candidates.slice(0,12):[]){
  if(!grant||typeof grant.grant_id!=='string'||typeof grant.title!=='string')continue;
  // Reject malformed agency identifiers instead of treating corrupt CSV fields
  // as valid submissions or filesystem identities.
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(grant.grant_id))continue;
  // Use fixed-size hashes instead of untrusted grant IDs for local file names.
  const key=H(grant.grant_id+'\n'+grant.agency).slice(0,22);
  const fingerprint=H(JSON.stringify([grant.title,grant.agency,grant.deadline_date,grant.status,
   grant.purpose,grant.description_excerpt,grant.application_url,grant.estimated_awards,grant.matching_funds]));
  const before=old[key],remaining=until(grant.deadline_date,new Date(now));
  if(remaining!==null&&remaining<0)continue;
  const newGrant=!before,changed=!!before&&before.fingerprint!==fingerprint;
  const deferred=before?.brief_pending===true;
  const urgent=remaining!==null&&remaining<=14;
  const reason=newGrant?'NEW_ELIGIBLE_BUSINESS_RESEARCH_LEAD':changed?'PUBLISHED_GRANT_RECORD_UPDATED':
    deferred?'COMPLETE_PREVIOUSLY_DEFERRED_RESEARCH':
    urgent?'DEADLINE_APPROACHING':'NO_CHANGE_MONITOR';
  const link=official(grant.application_url);
  choices.push({key,fingerprint,grant_id:clean(grant.grant_id,150),
   title:clean(grant.title,260),agency:clean(grant.agency,200),
   reason,deadline:grant.deadline_date||null,days_remaining:remaining,
   priority:Math.min(120,(Number(grant.priority)||30)+(urgent?15:0)+(newGrant?10:changed?5:0)),
   action:reason==='NO_CHANGE_MONITOR'?'MONITOR':'PREPARE_LOCAL_RESEARCH_BRIEF',
   official_link:link,source_sha256:report.source_sha256,
   missing_profile_evidence:gaps(profile),
   eligibility_state:'NOT_VERIFIED',submissions_allowed:false,
   _last_detail:before?.last_detail_checked||null});
 }
 choices.sort((a,b)=>b.priority-a.priority||String(a.deadline||'9999').localeCompare(String(b.deadline||'9999')));
 const briefs=choices.filter(x=>x.action==='PREPARE_LOCAL_RESEARCH_BRIEF').slice(0,mission.max_briefs_per_cycle);
 const detail=mission.max_official_pages_per_cycle?briefs.find(x=>x.official_link&&
  (!x._last_detail||new Date(now).getTime()-Date.parse(x._last_detail)>=86400000)):null;
 return {version:VERSION,decided_utc:new Date(now).toISOString(),
  goal:mission.goal,source_sha256:report.source_sha256,
  decisions:choices.map(({_last_detail,...x})=>x),
  local_briefs_to_write:briefs.map(x=>x.key),
  official_page_to_research:detail?{key:detail.key,url:detail.official_link}:null,
  deferred_briefs:Math.max(0,choices.filter(x=>x.action!=='MONITOR').length-briefs.length),
  company_information_needed:gaps(profile),applications_submitted:0,
  review_required:true};
}
async function officialDetail(url,fetchImpl,now){
 if(!official(url))throw Error('MISSION_UNTRUSTED_PAGE');
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),10500);
 try{
  const r=await fetchImpl(url,{method:'GET',redirect:'error',signal:c.signal,headers:{accept:'text/html'}});
  if(!r.ok||!r.body||!String(r.headers.get('content-type')||'').includes('text/html'))
   throw Error('MISSION_OFFICIAL_PAGE_UNAVAILABLE');
  if(Number(r.headers.get('content-length')||0)>MAX_PAGE)throw Error('MISSION_OFFICIAL_PAGE_LIMIT');
  let n=0,parts=[];
  for await(const part of r.body){n+=part.length;if(n>MAX_PAGE)throw Error('MISSION_OFFICIAL_PAGE_LIMIT');parts.push(part)}
  const raw=Buffer.concat(parts);
  const excerpt=raw.toString('utf8').replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
   .replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi,' ')
   .replace(/\s+/g,' ').slice(0,3000).trim();
  if(excerpt.length<50)throw Error('MISSION_PAGE_CONTENT_INSUFFICIENT');
  return {url,sha256:H(raw),when:new Date(now).toISOString(),excerpt,raw};
 }finally{clearTimeout(timer)}
}
export function researchBrief(decision,detail=null){
 return [
 '# Fun Industrial LLC — Autonomous Research Brief',
 '',
 'Status: DRAFT; NOT SUBMITTED; ELIGIBILITY NOT VERIFIED.',
 'Grant: '+decision.title,
 'Agency: '+decision.agency,
 'Grant identifier: '+decision.grant_id,
 'Deadline: '+(decision.deadline||'UNVERIFIED'),
 'Decision: '+decision.reason,
 'Research priority: '+decision.priority+' (heuristic, not probability of an award)',
 'Official page: '+(decision.official_link||'UNVERIFIED / MISSING'),
 'Source SHA-256: '+decision.source_sha256,
 'Record SHA-256: '+decision.fingerprint,
 '',
 '## What the worker decided and did',
 'Selected for local application preparation because '+decision.reason+'.',
 'Independent grant eligibility remains unverified. No agency form was submitted.',
 '',
 '## Applicant information still missing',
 ...decision.missing_profile_evidence.map(x=>'- '+x),
 '',
 '## Additional source evidence',
 detail?'Official page: '+detail.url+'\nPage SHA-256: '+detail.sha256+
  '\nCaptured: '+detail.when+'\nUntrusted public page text excerpt:\n\n'+detail.excerpt:
  'No verified official program page was captured in this cycle.',
 '',
 '## Next authorized work',
 '- Preserve previous application worksheets and human edits',
 '- Monitor agency source for revisions and approaching deadlines',
 '',
 '## Operator-only work',
 '- Verify full grant eligibility and official agency form questions',
 '- Confirm legal identifiers, project description, budget and attachments',
 '- Review and explicitly authorize any application submission',
 '',
 'No signatures, submissions, government form changes, payments or external messages were made.'
 ].join('\n')+'\n';
}
export async function runMissionCycle({directory,report,now=new Date(),fetchImpl=fetch}={}){
 if(typeof directory!=='string'||!directory)throw Error('MISSION_STORAGE_REQUIRED');
 const policyFile=join(directory,'mission-policy-v2.json');
 let policy=await load(policyFile,null);
 if(!policy){policy=DEFAULT_MISSION;await writeFile(policyFile,JSON.stringify(policy,null,2)+'\n',{flag:'wx'})}
 const profile=await load(join(directory,'business-profile.json'),{});
 const stateFile=join(directory,'mission-state-v2.json');
 const previous=await load(stateFile,{version:VERSION,entries:{}});
 if(previous.version!==VERSION||!previous.entries||typeof previous.entries!=='object'||
    Array.isArray(previous.entries))throw Error('MISSION_LEDGER_INVALID');
 const plan=chooseWork(report,previous,profile,policy,now);
 const briefsDir=join(directory,'mission-briefs'),evidenceDir=join(directory,'mission-evidence');
 await mkdir(briefsDir,{recursive:true});await mkdir(evidenceDir,{recursive:true});
 await atomic(join(directory,'mission-plan-v2.json'),plan);
 let detail=null,pageReadError=null,pageReads=0;
 if(plan.official_page_to_research){
  try{
   detail=await officialDetail(plan.official_page_to_research.url,fetchImpl,now);
   try{await writeFile(join(evidenceDir,'official-page-'+detail.sha256+'.html'),detail.raw,{flag:'wx'})}
   catch(e){if(e.code!=='EEXIST')throw e}
   pageReads=1;delete detail.raw;
  }catch(e){pageReadError=String(e.message||e).slice(0,200)}
 }
 const entry={...previous.entries},files=[];
 const prepared=new Set(plan.local_briefs_to_write);
 for(const d of plan.decisions){
  const old=entry[d.key]||{};
  entry[d.key]={...old,fingerprint:d.fingerprint,last_seen_utc:new Date(now).toISOString(),
   brief_pending:d.action==='PREPARE_LOCAL_RESEARCH_BRIEF'&&!prepared.has(d.key),
   // Record the attempt even if the official site refuses access; don't retry
   // the same unresponsive page four times daily.
   last_detail_checked:d.key===plan.official_page_to_research?.key?new Date(now).toISOString():
    old.last_detail_checked||null};
  if(!plan.local_briefs_to_write.includes(d.key))continue;
  const path=join(briefsDir,d.key+'-'+d.fingerprint.slice(0,12)+'.md');
  let written=false;
  try{
   await writeFile(path,researchBrief(d,detail&&d.key===plan.official_page_to_research?.key?detail:null),{flag:'wx'});
   written=true;
  }catch(e){if(e.code!=='EEXIST')throw e}
  entry[d.key].latest_brief=path;
  files.push({grant_id:d.grant_id,title:d.title,decision:d.reason,path,new_file:written,
   official_page_evidence:!!(detail&&d.key===plan.official_page_to_research?.key)});
 }
 const keep=Object.entries(entry).sort((a,b)=>String(b[1].last_seen_utc||'').localeCompare(String(a[1].last_seen_utc||''))).slice(0,120);
 const ledger={version:VERSION,updated_utc:new Date(now).toISOString(),entries:Object.fromEntries(keep)};
 const receipt={version:VERSION,cycle_utc:new Date(now).toISOString(),goal:policy.goal,
  source_sha256:report.source_sha256,decisions_made:plan.decisions.length,
  new_local_briefs:files.filter(x=>x.new_file).length,processed_briefs:files.length,
  official_pages_read:pageReads,official_page_attempts:plan.official_page_to_research?1:0,
  official_page_error:pageReadError,
  actions:files,next_priority:plan.decisions[0]?{
   grant_id:plan.decisions[0].grant_id,title:plan.decisions[0].title,
   reason:plan.decisions[0].reason,deadline:plan.decisions[0].deadline}:null,
  pending_evidence:plan.company_information_needed,
  applications_submitted:0,rea_actions:0,external_emails:0,spending:0,
  state:'INDEPENDENT_RESEARCH_ACTIONS_COMPLETED_REVIEW_REQUIRED'};
 await atomic(stateFile,ledger);
 await atomic(join(directory,'last-mission-v2.json'),receipt);
 const journal=join(directory,'mission-actions.jsonl');
 await appendFile(journal,JSON.stringify({utc:receipt.cycle_utc,source_sha256:receipt.source_sha256,
  choices:plan.decisions.map(x=>({grant_id:x.grant_id,reason:x.reason,action:x.action,priority:x.priority})),
  executed:files.map(x=>({grant_id:x.grant_id,created:x.new_file})),
  official_pages_read:pageReads,official_pages_attempted:plan.official_page_to_research?1:0,
  applications_submitted:0})+'\n');
 return receipt;
}
