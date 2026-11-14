// FIAL5.6: business competence processing of real local executive tasks.
// Reads existing FIAL5.5 state and receipt. New local review packets only; no
// inference calls, emails, filings, new servers, process restarts or code changes.
import {readFile,writeFile,mkdir,rename,lstat} from 'node:fs/promises';
import {join,isAbsolute,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {VERSION as REAL_VERSION} from '../operator/real-operations-v5-5.mjs';
import {VERSION,planBusinessDecision,selectFrameworks} from './business-knowledge-v5-6.mjs';
import {reviewBusinessWriting} from './business-writing-v5-6.mjs';
export const OPERATOR_VERSION='fial5.6-business-operator-v1';
export const DIR='BusinessCompetenceV56';
const hash=x=>createHash('sha256').update(x).digest('hex');
async function optional(path){
 try{return JSON.parse(await readFile(path,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function fixedDirectory(root){
 if(typeof root!=='string'||!isAbsolute(root))throw Error('FIAL56_ROOT_NOT_ABSOLUTE');
 const abs=resolve(root);
 const dirs=[abs,join(abs,DIR),join(abs,DIR,'packets')];
 for(const dir of dirs){
  await mkdir(dir,{recursive:true});
  if((await lstat(dir)).isSymbolicLink())throw Error('FIAL56_ROOT_SYMLINK');
 }
 return abs;
}
async function atomic(file,obj){
 const tmp=file+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(obj,null,2)+'\n',{flag:'wx'});
 await rename(tmp,file);
}
async function newFile(file,data){
 try{await writeFile(file,data,{flag:'wx'});return true}
 catch(e){if(e.code==='EEXIST')return false;throw e}
}
function packageFor(t,now){
 const plan=planBusinessDecision(t.title+' '+String(t.description||'').slice(0,450),{
  company:t.company==='elektron'?'ELEKTRON INDUSTRIAL LLC':'Fun Industrial (software workspace)',
  evidence:[String(t.source||'')].filter(Boolean)});
 const input=[t.id,t.title,t.description,t.phase,t.source,t.required,plan.framework_ids,VERSION];
 const fingerprint=hash(JSON.stringify(input));
 const text=[
  '# Business competence review: '+t.title,'',
  'Prepared '+now.toISOString(),'Workstream: '+t.kind,
  'Company: '+(t.company==='elektron'?'ELEKTRON INDUSTRIAL LLC':'Fun Industrial (software workspace)'),
  'Source: '+String(t.source||'unknown'),'Local task ID: '+t.id,
  'Original phase: '+String(t.phase||'unknown'),'',
  '## Business and management methodology',
  ...plan.frameworks.map(f=>'### '+f.name+'\n'+f.reason+
   '\nDecision control: '+f.decision_guard),
  ...(plan.frameworks.length?[]:['No matching framework — requires a specific management question.']),
  '','## Evidence needed before the decision',
  ...plan.needed_evidence.map(x=>'- '+x),'',
  '## Existing task evidence gaps',
  ...((Array.isArray(t.required)?t.required:[]).slice(0,12).map(x=>'- '+String(x).slice(0,180))),
  '','## Business decision and work state',
  'Decision: NOT REACHED — evidence is not verified here.',
  'External execution: NOT AUTHORIZED. This packet is not a completed filing or email.',
  'Local next step: '+plan.next_step,
  '','## Quality controls',
  '- No numerical assumptions were invented.',
  '- Any external submission, certification, spending, source edit, or email must use a separately verified adapter and approval.',
  '- Review and preserve negative evidence before closing the work item.'
 ].join('\n');
 const check=reviewBusinessWriting(text);
 return {id:t.id,kind:t.kind,title:t.title,company:t.company,priority:t.priority||0,
  framework_ids:plan.framework_ids,fingerprint,text,writing_issues:check.issue_count,
  decision_reached:false,external_action_authorized:false};
}
export async function runBusinessCompetenceCycle({root=ROOT(),now=new Date()}={}){
 if(!Number.isFinite(now.getTime()))throw Error('FIAL56_TIME_INVALID');
 const abs=await fixedDirectory(root),source=await optional(join(abs,'state-v1.json'));
 const receipt=await optional(join(abs,'RealWorkV55','last-real-cycle.json'));
 if(!source||source.version!=='fial5.4-executive-operator-v1'||
  !Array.isArray(source.items)||source.items.length>120||
  source.outbound_permissions?.email_sent!==0||
  source.outbound_permissions?.government_filings!==0||
  source.outbound_permissions?.rea_runs!==0||
  !receipt||receipt.version!==REAL_VERSION||
  receipt.government_filings!==0||receipt.emails_sent!==0||
  receipt.rea_executions!==0||receipt.payments!==0)
  throw Error('FIAL56_UPSTREAM_RECEIPT_OR_POLICY_HOLD');
 const eligible=source.items.filter(t=>t&&typeof t.id==='string'&&/^[a-f0-9]{22}$/.test(t.id)&&
  typeof t.title==='string'&&t.title.length<=180&&
  ['elektron','fun'].includes(t.company)&&
  (t.source==='operator_registered_unverified'||
   String(t.source||'').startsWith('verified_local_grants_snapshot:')))
  .slice(0,30);
 const prepared=eligible.map(t=>packageFor(t,now));
 const prior=await optional(join(abs,DIR,'last-cycle.json'));
 const priorMap=new Map((Array.isArray(prior?.tasks)?prior.tasks:[]).map(t=>[t.id,t]));
 let added=0,changes=0;
 const details=[];
 for(const t of prepared){
  const before=priorMap.get(t.id);
  if(before&&before.fingerprint!==t.fingerprint)changes++;
  const file=join(abs,DIR,'packets',t.id+'-'+t.fingerprint.slice(0,12)+'.md');
  const created=await newFile(file,t.text);
  if(created)added++;
  details.push({id:t.id,title:t.title,company:t.company,workstream:t.kind,
   priority:t.priority,framework_ids:t.framework_ids,writing_issues:t.writing_issues,
   fingerprint:t.fingerprint,phase:'LOCAL_PLAN_PREPARED',
   changed:!!before&&before.fingerprint!==t.fingerprint,
   newly_prepared:created,
   packet_sha256:hash(t.text),external_actions:0,decision_reached:false});
 }
 const result={version:OPERATOR_VERSION,methodology_version:VERSION,
  state:'EXECUTED_LOCAL_BUSINESS_COMPETENCE_CYCLE',
  cycle_utc:now.toISOString(),upstream_exec_utc:source.cycle_utc,
  upstream_business_utc:receipt.when_utc,eligible_tasks:eligible.length,
  packets_created:added,changed_tasks:changes,
  tracked_tasks:details.length,framework_count:18,
  tasks:details,actions:{mail_sent:0,government_filings:0,purchases:0,
   code_mutations:0,rea_executions:0,model_invocations:0},
  constraints:{full_erp_installed:false,docling_installed_unverified:true,
   vale_installed_unverified:true,verified_legal_eligibility:false},
  external_execution:'NOT_PERFORMED'};
 await atomic(join(abs,DIR,'last-cycle.json'),result);
 return result;
}
export async function readBusinessCompetenceStatus({root=ROOT()}={}){
 const r=await optional(join(root,DIR,'last-cycle.json'));
 if(!r)return {version:OPERATOR_VERSION,state:'NOT_ACTIVATED',tasks:[],
  actions:{mail_sent:0,government_filings:0,purchases:0,code_mutations:0,rea_executions:0,model_invocations:0}};
 if(r.version!==OPERATOR_VERSION||!Array.isArray(r.tasks)||r.tasks.length>30||
  Object.values(r.actions||{}).some(x=>x!==0))
  throw Error('FIAL56_COMPETENCE_STATUS_INVALID');
 // Never expose packet paths, raw private profile or embedded document text via HTTP.
 return r;
}
