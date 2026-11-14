// FIAL5.7. A genuine business outcome requires evidence of external action.
// Scheduled runs are read-only wrt outside world, never send mail or file forms.
// Separate explicit single-use operator command can attempt the ONE reviewed email.
import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile,rename,lstat} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {ROOT as EXEC_ROOT} from '../operator/executive-ops-v1.mjs';
import {validateIdentity} from '../operator/real-operations-v5-5.mjs';
export const VERSION='fial5.7-verified-outcomes-v1';
export const CITY_EMAIL='businesslicense@victorvilleca.gov';
export const SOURCE_URL='https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division';
export const ROOT=EXEC_ROOT;
const NAME='verified-outcomes-v1.json';
const DIR='OutcomeV57';
const digest=s=>createHash('sha256').update(s).digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
async function safeRoot(root){
 if(!isAbsolute(root))throw Error('FIAL57_ROOT_NOT_ABSOLUTE');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())throw Error('FIAL57_ROOT_SYMLINK_DENIED');
 const dir=join(root,DIR);
 await mkdir(dir,{recursive:true});
 if((await lstat(dir)).isSymbolicLink())throw Error('FIAL57_OUTCOME_DIR_SYMLINK_DENIED');
 return resolve(dir);
}
async function optional(file){
 try{return JSON.parse(await readFile(file,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function save(file,data){
 const tmp=file+'.'+randomUUID()+'.tmp';
 try{
  await writeFile(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(tmp,file);
 }catch(e){try{const fs=await import('node:fs/promises');await fs.unlink(tmp)}catch{}throw e}
}
async function readBusiness(root){
 const id=await optional(join(root,'business-identity-v5-5.json'));
 return validateIdentity(id).company;
}
export function inquiryForBusiness(company){
 if(!object(company)||company.legal_name!=='ELEKTRON INDUSTRIAL LLC'||
  !/^[a-z0-9.@+ -]{3,80}$/i.test(company.owner||'')||
  !/^[a-z0-9-]{5,40}$/i.test(company.business_license_file_reference||'')||
  typeof company.email!=='string'||!/^[-\w.+]+@[-\w.]+\.\w+$/.test(company.email)||
  typeof company.business_address!=='string'||company.business_address.length>220||
  typeof company.city!=='string'||company.city.length>80||
  company.state!=='CA'||typeof company.zip!=='string')
  throw Error('FIAL57_BUSINESS_IDENTITY_UNVERIFIED_SCHEMA');
 const subject='ELEKTRON INDUSTRIAL LLC — Business License Reference Status Inquiry';
 const text=[
  'Hello City of Victorville Business License Division,','',
  'I am requesting assistance confirming the status and any applicable',
  'renewal or additional documentation requirements for the following file:',
  '',
  'Legal business: ELEKTRON INDUSTRIAL LLC',
  'File/reference number (provided by our business, not verified by the City): '+company.business_license_file_reference,
  'Business address: '+company.business_address+', '+company.city+', CA '+company.zip,
  'Contact: '+company.owner,
  'Return email: '+company.email,'',
  'Could you please confirm whether this reference matches your records,',
  'whether a license has been issued and is currently active, and any',
  'renewal date or missing requirements that apply?',
  '',
  'Thank you,',company.owner,
 ].join('\r\n');
 return {to:CITY_EMAIL,from:company.email,subject,text,
  source_url:SOURCE_URL,claim:'OPERATOR_PROVIDED_NOT_CITY_VERIFIED'};
}
export function contentFingerprint(message){
 if(!object(message)||message.to!==CITY_EMAIL||
  typeof message.from!=='string'||typeof message.subject!=='string'||
  typeof message.text!=='string'||message.text.length>5000||
  typeof message.source_url!=='string'||message.source_url!==SOURCE_URL)
  throw Error('FIAL57_MESSAGE_UNVERIFIED');
 return digest(JSON.stringify([message.to,message.from,message.subject,message.text,message.source_url]));
}
function blank(fingerprint,now){
 return {version:VERSION,scope:'ELEKTRON_INQUIRY_ONLY',fingerprint,
  state:'DRAFT_AWAITING_REVIEW',created_utc:now.toISOString(),
  send_attempts:0,send_id:null,sent_at_utc:null,thread_id:null,
  receipt_state:'NOT_SENT',reply_candidates:[],reply_state:'NO_VERIFIED_REPLY',
  external_form_submissions:0,purchases:0,rea_calls:0,
  notes:'Draft only; scheduled worker never sends anything.'}
}
export async function prepareOutcome({root=ROOT(),now=new Date()}={}){
 const dir=await safeRoot(root),company=await readBusiness(root);
 const draft=inquiryForBusiness(company);
 const fingerprint=contentFingerprint(draft);
 const file=join(dir,NAME);
 let record=await optional(file);
 if(!record){
  record=blank(fingerprint,now);await save(file,record);
 }else if(record.version!==VERSION||
  record.fingerprint!==fingerprint||
  record.scope!=='ELEKTRON_INQUIRY_ONLY'||
  !['DRAFT_AWAITING_REVIEW','SEND_ATTEMPT_STARTED','SENT_WITH_GMAIL_RECEIPT','HOLD_SEND_UNCERTAIN'].includes(record.state)||
  !Number.isInteger(record.send_attempts)||record.send_attempts<0||record.send_attempts>1){
  throw Error('FIAL57_EXISTING_OUTCOME_CONFLICT_NO_OVERWRITE');
 }
 const draftFile=join(dir,'victorville-license-inquiry-'+fingerprint.slice(0,16)+'.json');
 try{await writeFile(draftFile,JSON.stringify(draft,null,2)+'\n',{flag:'wx',mode:0o600})}
 catch(e){if(e.code!=='EEXIST')throw e}
 return {record,draft,fingerprint,file,draftFile};
}
export function authorizationPhrase(fingerprint){
 if(!/^[a-f0-9]{64}$/.test(fingerprint))throw Error('FIAL57_FINGERPRINT_INVALID');
 return 'SEND ELEKTRON INQUIRY '+fingerprint.slice(0,12)+' TO '+CITY_EMAIL;
}
export async function markAttempt({root=ROOT(),fingerprint,now=new Date()}={}){
 const {file,record}=await prepareOutcome({root,now});
 if(record.state!=='DRAFT_AWAITING_REVIEW'||record.send_attempts!==0||
  record.fingerprint!==fingerprint)throw Error('FIAL57_REPLAY_OR_IDENTITY_HOLD');
 const next={...record,state:'SEND_ATTEMPT_STARTED',send_attempts:1,
  attempt_utc:now.toISOString(),receipt_state:'PENDING_UNKNOWN_OUTCOME',
  notes:'A network send may have occurred. Never retry without independent reconciliation.'};
 await save(file,next);
 return next;
}
export async function recordGmailSend({root=ROOT(),fingerprint,response,now=new Date()}={}){
 const {file,record}=await prepareOutcome({root,now});
 if(record.state!=='SEND_ATTEMPT_STARTED'||record.send_attempts!==1||
  record.fingerprint!==fingerprint)throw Error('FIAL57_NO_SINGLE_APPROVED_ATTEMPT');
 if(!/^[a-f0-9]{8,40}$/i.test(response?.id||'')||
  !/^[a-f0-9]{8,40}$/i.test(response?.threadId||''))
  throw Error('FIAL57_GMAIL_RESPONSE_INVALID_HOLD_UNKNOWN');
 const next={...record,state:'SENT_WITH_GMAIL_RECEIPT',
  send_id:response.id,thread_id:response.threadId,
  sent_at_utc:now.toISOString(),receipt_state:'GMAIL_API_SEND_CONFIRMED',
  notes:'Gmail API accepted the outgoing message; this does not prove recipient delivery or an official response.'};
 await save(file,next);
 return next;
}
function senderAddress(from){
 if(typeof from!=='string')return '';
 const brackets=from.match(/<([^\s<>@]+@[^\s<>@]+)>/);
 return (brackets?.[1]||from.trim()).toLowerCase();
}
export function classifyInbox(record,inbox){
 if(!object(record)||!Array.isArray(inbox)||inbox.length>12)
  throw Error('FIAL57_INBOX_SCHEMA_HOLD');
 const candidates=inbox.filter(x=>x&&
  /^[a-f0-9]{8,40}$/i.test(x.id||'')&&
  senderAddress(x.from)===CITY_EMAIL&&
  typeof x.subject==='string'&&
  /\b(?:license|business|elektron|reference)\b/i.test(x.subject)
 ).map(x=>({message_id:x.id,subject:x.subject.slice(0,160),
   state:'UNVERIFIED_RESPONSE_CANDIDATE',external_delivery_verified:false}));
 return {...record,reply_candidates:candidates.slice(0,6),
  reply_state:candidates.length?'POSSIBLE_REPLY_REQUIRES_HUMAN_REVIEW':record.reply_state};
}
export async function observeOutcome({root=ROOT(),now=new Date(),readMailbox=null}={}){
 const {file,record}=await prepareOutcome({root,now});
 let next={...record,last_observed_utc:now.toISOString(),
  mailbox_state:'NOT_CONNECTED',mailbox_read:false};
 if(readMailbox){
  try{
   const answer=await readMailbox();
   if(answer?.account_verified===true&&Array.isArray(answer.messages)){
    next=classifyInbox(next,answer.messages);
    next.mailbox_state='CONNECTED_READ_ONLY';next.mailbox_read=true;
   }else next.mailbox_state='MAILBOX_NOT_VERIFIED';
  }catch(e){next.mailbox_state='MAILBOX_UNAVAILABLE'}
 }
 await save(file,next);
 return outcomeSummary(next);
}
export function outcomeSummary(record){
 if(!object(record)||record.version!==VERSION)return {version:VERSION,state:'NOT_ACTIVATED'};
 return {version:VERSION,state:record.state,
  inquiry:{recipient:'City of Victorville Business License Division',
   source:SOURCE_URL,sent:record.state==='SENT_WITH_GMAIL_RECEIPT',
   gmail_receipt_id:record.send_id||null,
   receipt_state:record.receipt_state},
  reply_candidate_count:Array.isArray(record.reply_candidates)?record.reply_candidates.length:0,
  reply_state:record.reply_state,mailbox_state:record.mailbox_state||'NOT_CONNECTED',
  send_attempts:record.send_attempts,external_form_submissions:0,
  verified_customer_revenue:0,certified_license_status:false,
  progress_measure:record.state==='SENT_WITH_GMAIL_RECEIPT'?'ONE_GMAIL_SEND_RECEIPT':'NO_CONFIRMED_EXTERNAL_OUTCOME',
  next_gate:record.state==='DRAFT_AWAITING_REVIEW'?'REVIEW_AND_AUTHORIZE_SINGLE_EMAIL':
   record.state==='SENT_WITH_GMAIL_RECEIPT'?'WAIT_FOR_REVIEWABLE_REPLY':'RECONCILE_POSSIBLE_UNKNOWN_SEND'};
}
export async function readOutcomeStatus({root=ROOT()}={}){
 const record=await optional(join(root,DIR,NAME));
 return outcomeSummary(record);
}
