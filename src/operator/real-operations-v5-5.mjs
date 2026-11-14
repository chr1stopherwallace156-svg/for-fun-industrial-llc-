// FIAL5.5: Fun Industrial is SOFTWARE; ELEKTRON INDUSTRIAL LLC is the company.
// Reads operator-supplied local identity, maintains useful operational tasks,
// creates actual LOCAL filing/email/configuration packets with real receipts.
// Never creates government filings, sends email, calls REA, spends, modifies code,
// or confuses a supplied file number with a verified/active license.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,lstat,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {runExecutiveCycle,ROOT as EXEC_ROOT,VERSION as PREVIOUS} from './executive-ops-v1.mjs';
export const VERSION='fial5.5-real-business-operations-v1';
export const ROOT=EXEC_ROOT;
const hex=x=>createHash('sha256').update(x).digest('hex');
const REGISTRY='work-register-v1.json';
const PROFILE='business-identity-v5-5.json';
const OFFICIAL=Object.freeze({
 victorville:'https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division',
 victorville_requirements:'https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division/Business-License-Links-and-Resources',
 sos:'https://www.sos.ca.gov/business-programs/business-entities/information-requests',
 statement:'https://www.sos.ca.gov/business-programs/business-entities/statements',
 bizfile:'https://bizfileonline.sos.ca.gov/'
});
function fail(name){throw Error('FIAL55_'+name)}
function str(value,max=200){return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value)}
function object(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const safeDir=async dir=>{
 if(!isAbsolute(dir))fail('ROOT_NOT_ABSOLUTE');
 await mkdir(dir,{recursive:true});
 if((await lstat(dir)).isSymbolicLink())fail('ROOT_SYMLINK_DENIED');
 return resolve(dir)
};
async function atomic(file,data){const tmp=file+'.'+randomUUID()+'.tmp';try{
 await writeFile(tmp,typeof data==='string'?data:JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 await rename(tmp,file)
}catch(e){try{await import('node:fs/promises').then(m=>m.unlink(tmp))}catch{}throw e}}
async function fresh(file,content){try{await writeFile(file,content,{flag:'wx'});return true}
 catch(e){if(e.code!=='EEXIST')throw e;return false}}
export function validateIdentity(p){
 if(!object(p)||p.schema!=='fun-industrial-business-identity-v5-5'||!object(p.software)||
  !object(p.company)||p.software.name!=='Fun Industrial'||
  p.software.type!=='software_workspace'||p.software.licensed_business_claim!==false||
  p.software.has_business_license_claim!==false||
  p.company.legal_name!=='ELEKTRON INDUSTRIAL LLC'||
  !str(p.company.owner,160)||!str(p.company.email,150)||!str(p.company.phone,40)||
  !str(p.company.website,180)||!str(p.company.business_address,300)||
  !str(p.company.business_license_file_reference,100)||!str(p.company.city,80)||
  p.company.state!=='CA'||!str(p.company.zip,20)||
  p.company.official_registration_verified!==false||
  p.company.business_license_status_verified!==false||
  p.company.source!=='operator_provided'){
  fail('BUSINESS_IDENTITY_SCHEMA_OR_CLAIMS_INVALID');
 }
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.company.email)||
  !/^[+]?[0-9() \-.]{10,30}$/.test(p.company.phone)||
  !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/)?$/i.test(p.company.website)||
  !/^[A-Za-z0-9-]{5,40}$/.test(p.company.business_license_file_reference))
  fail('BUSINESS_CONTACT_OR_REFERENCE_INVALID');
 return p;
}
export function initializeIdentity(fields){
 if(!object(fields))fail('IDENTITY_INPUT_REQUIRED');
 const p={schema:'fun-industrial-business-identity-v5-5',
  software:{name:'Fun Industrial',type:'software_workspace',
   licensed_business_claim:false,has_business_license_claim:false},
  company:{
   legal_name:'ELEKTRON INDUSTRIAL LLC',
   owner:fields.owner,
   email:String(fields.email||'').toLowerCase(),
   phone:fields.phone,
   website:fields.website,
   business_address:fields.business_address,
   city:fields.city,
   state:'CA',
   zip:fields.zip,
   business_license_file_reference:fields.file_reference,
   business_license_reference_type:'operator_supplied_number_not_issuer_verified',
   official_registration_verified:false,
   business_license_status_verified:false,
   source:'operator_provided'
  }};
 return validateIdentity(p);
}
export async function storeIdentity(fields,{root=ROOT()}={}){
 await safeDir(root);const p=initializeIdentity(fields),path=join(root,PROFILE);
 const json=JSON.stringify(p,null,2)+'\n';
 if(await fresh(path,json))return {state:'LOCAL_PROFILE_CREATED',path};
 const prior=validateIdentity(await readJson(path));
 if(JSON.stringify(prior)===JSON.stringify(p))return {state:'EXISTING_LOCAL_PROFILE_ADOPTED',path};
 fail('PROFILE_EXISTS_DIFFERENT_REVIEW_BEFORE_OVERWRITE');
}
const readyTasks=()=>[
 {id:'fial55-elektron-victorville-license',kind:'filings',company:'elektron',
  title:'Verify Victorville business license file and renewal instructions',
  description:'Check operator-supplied file reference against official City of Victorville business license records; do not assume issued, active or a due date.',
  official_url:OFFICIAL.victorville,priority:90,
  required:['Official license document/status','City-issued expiration or renewal date','Registered business type and address']},
 {id:'fial55-elektron-sos',kind:'filings',company:'elektron',
  title:'Verify California SOS legal entity identity and Statement of Information due date',
  description:'A city business license reference is NOT a California Secretary of State entity number.',
  official_url:OFFICIAL.sos,priority:88,
  required:['California SOS entity number','Current bizfile status','Actual Statement of Information due date']},
 {id:'fial55-elektron-business-email',kind:'mail',company:'elektron',
  title:'Connect and verify the Elektron business mailbox, then stage authorized replies',
  description:'No automatic Gmail access from a supplied email address. Requires account-specific OAuth and explicit message approvals.',
  priority:83,required:['Verified Google OAuth for the exact Elektron mailbox','Actual message evidence','Recipient and draft review before sending']},
 {id:'fial55-elektron-grants',kind:'funding',company:'elektron',
  title:'Evaluate grants, vouchers and incentives for ELEKTRON INDUSTRIAL LLC',
  description:'Compare real California program terms with operator-provided identity; do not claim eligibility or submit.',
  priority:75,required:['Program-specific applicant eligibility','Verified legal registration','Matching funds and eligible project budget','Application instructions']},
 {id:'fial55-elektron-filings-packet',kind:'filings',company:'elektron',
  title:'Prepare City of Victorville business license verification packet',
  description:'Prepare a factual local contact draft from known company information; no claim of official issuance.',
  official_url:OFFICIAL.victorville_requirements,priority:78,
  required:['Actual licensed activity','Whether address is home-based or commercial','Official licensing portal login']},
 {id:'fial55-fun-software-integrity',kind:'configuration',company:'fun',
  title:'Verify installed Fun Industrial source runner integrity',
  description:'Read-only SHA-256 inspection and Node syntax check of trusted source file, no rewrites or new services.',
  priority:68,required:['Reviewed source checksum','Any mismatch requires operator-approved repair']},
 {id:'fial55-elektron-sales-inbox',kind:'sales',company:'elektron',
  title:'Prepare qualified customer outreach and opportunity tracking',
  description:'Needs actual customer contacts and exact approved email recipients; never invent leads or send.',
  priority:54,required:['Verified business prospects','Approved outreach text and recipient']},
 {id:'fial55-elektron-engineering',kind:'engineering',company:'elektron',
  title:'Link verified vehicle engineering evidence to real Elektron opportunities',
  description:'Read-only planning until verified vehicle, safety, and project evidence is provided.',
  priority:52,required:['Verified vehicle/model configuration','Approved engineering requirements','Independent qualification record']}
];
export async function seedWorkRegister({root=ROOT()}={}){
 await safeDir(root);
 const path=join(root,REGISTRY),old=await readJson(path);
 if(old?.schema!=='executive-operator-work-register-v1'||!Array.isArray(old.items)||old.items.length>90)
  fail('EXISTING_WORK_REGISTER_UNVERIFIED');
 const ids=new Set(old.items.map(x=>x.id));
 const add=readyTasks().filter(x=>!ids.has(x.id));
 // Never overwrite or remove an operator-edited entry; make room under the existing 100-item cap.
 if(old.items.length+add.length>100)fail('WORK_REGISTER_CAPACITY_HOLD');
 if(add.length)await atomic(path,{...old,items:[...old.items,...add]});
 return {added:add.length,total:old.items.length+add.length};
}
async function hashTrustedSource(file){
 const real=resolve(file);
 if((await lstat(real)).isSymbolicLink())fail('SOURCE_SYMLINK_REFUSED');
 const s=await stat(real);if(s.size<50||s.size>2*1024*1024)fail('SOURCE_SIZE_REFUSED');
 const hash=createHash('sha256');for await(const b of createReadStream(real))hash.update(b);
 return {path:real,sha256:hash.digest('hex'),bytes:s.size};
}
function draftLicense(p){
 const c=p.company;
 return ['Subject: Request to verify business license file reference and renewal requirements','',
  'To: City of Victorville Business License Division','',
  'Hello Business License Division,','',
  'I am requesting confirmation of the record and any current requirements associated with the business information below.',
  'Legal business name: '+c.legal_name,'Contact: '+c.owner,
  'Business license/file reference (operator-provided, not independently verified): '+c.business_license_file_reference,
  'Business address: '+c.business_address+', '+c.city+', '+c.state+' '+c.zip,
  'Phone: '+c.phone,'Email: '+c.email,'Website: '+c.website,'',
  'Could you please confirm whether this file corresponds to the business license record,',
  'its current status and renewal date, and whether any additional requirements or corrections apply?',
  'No response or official confirmation is assumed.','',
  'Thank you,',''+c.owner,'',
  '[LOCAL DRAFT ONLY — NOT SENT. Verify the official recipient and edit before operator approval.]',''].join('\n')
}
function draftSos(p){
 const c=p.company;
 return ['# California Secretary of State — official record verification','',
  'Business: '+c.legal_name,
  'Source of contact details: operator-provided, not official verification.',
  'Official business search: '+OFFICIAL.bizfile,
  'SOS guidance: '+OFFICIAL.sos,
  'Statement of Information guidance: '+OFFICIAL.statement,'',
  'Requested checks:',
  '- Retrieve and verify separate California SOS entity number (not city license reference).',
  '- Confirm official status and entity filing date.',
  '- Confirm current Statement of Information due date shown by bizfile.',
  '- Compare official address and member/manager information with the private local profile.',
  '- Prepare correction or filing paperwork only from authoritative state forms.',
  '- Any certification, payment or submission requires separate operator approval.',
  '','Known from operator-provided record:','- Owner/contact: '+c.owner,
  '- Business address: '+c.business_address+', '+c.city+', CA '+c.zip,
  '- City business license/file reference: '+c.business_license_file_reference,
  '','Status: UNVERIFIED. No due date has been invented.',''].join('\n');
}
function draftProfile(p){
 const c=p.company;
 return ['# Business identity — local operator-provided profile','',
  'Software managing this record: '+p.software.name+' (software workspace, NOT a licensed business)',
  'Company: '+c.legal_name,
  'Owner/contact: '+c.owner,
  'Contact email: '+c.email,
  'Phone: '+c.phone,
  'Website: '+c.website,
  'Address: '+c.business_address+', '+c.city+', CA '+c.zip,
  'Business license/file reference: '+c.business_license_file_reference,
  '','Evidence status: OPERATOR PROVIDED ONLY.',
  'No Secretary of State status, license issuance or renewal date has been verified.',
  'Do not publicly commit this private profile or use it for legal certification.',''].join('\n')
}
export async function runRealOperationsCycle({root=ROOT(),sourceFile=null,now=new Date()}={}){
 await safeDir(root);
 const p=validateIdentity(await readJson(join(root,PROFILE)));
 const dir=join(root,'RealWorkV55');await safeDir(dir);
 let cfg={status:'SOURCE_NOT_CONFIGURED'};
 if(sourceFile){
  try{cfg={status:'SOURCE_HASHED',...await hashTrustedSource(sourceFile)}}
  catch(e){cfg={status:'SOURCE_INSPECTION_HOLD',reason:String(e.message||e).slice(0,130)}}
 }
 const entries=[
  {id:'elektron-company-profile',type:'business_evidence',target:'private_business_identity',text:draftProfile(p)},
  {id:'victorville-license-check',type:'filing_preparation',target:OFFICIAL.victorville,text:draftLicense(p)},
  {id:'sos-entity-verification',type:'filing_preparation',target:OFFICIAL.bizfile,text:draftSos(p)}
 ];
 const saved=[];
 for(const item of entries){
  const hash=hex(item.text),path=join(dir,item.id+'-'+hash.slice(0,14)+'.md');
  const created=await fresh(path,item.text);
  saved.push({id:item.id,kind:item.type,state:created?'LOCAL_ARTIFACT_CREATED':'ALREADY_PREPARED',
   sha256:hash,path,external_action:'NOT_PERFORMED'});
 }
 const priorPath=join(dir,'last-real-cycle.json');
 let previous=null;try{previous=await readJson(priorPath)}catch(e){if(e.code!=='ENOENT')throw e}
 const sourceChange=cfg.status==='SOURCE_HASHED'&&cfg.sha256!==previous?.config_source?.sha256;
 const record={version:VERSION,software_name:'Fun Industrial',software_role:'software_workspace',
  business_entity:'ELEKTRON INDUSTRIAL LLC',company_identity_status:'OPERATOR_PROVIDED_NOT_OFFICIALLY_VERIFIED',
  when_utc:now.toISOString(),new_local_artifacts:saved.filter(x=>x.state==='LOCAL_ARTIFACT_CREATED').length,
  artifacts:saved,config_source:cfg,config_changed_since_last_cycle:sourceChange,
  actual_local_evidence_actions:saved.filter(x=>x.state==='LOCAL_ARTIFACT_CREATED').length+(cfg.status==='SOURCE_HASHED'?1:0),
  applied_configs:0,emails_sent:0,government_filings:0,payments:0,rea_executions:0,
  external_actions:'NONE',next_human_gate:'Verify official status, business-specific forms and Gmail OAuth for Elektron'};
 await atomic(priorPath,record);return record
}
export async function runUnifiedCycle({root=ROOT(),sourceFile=null,now=new Date()}={}){
 await safeDir(root);validateIdentity(await readJson(join(root,PROFILE)));
 const register=await seedWorkRegister({root});
 const legacy=await runExecutiveCycle({root,now,readMailbox:null});
 if(legacy.version!==PREVIOUS||legacy.outbound_permissions.email_sent!==0||
  legacy.outbound_permissions.government_filings!==0||legacy.outbound_permissions.rea_runs!==0)
  fail('PREVIOUS_ENGINE_AUTHORITY_MISMATCH');
 const real=await runRealOperationsCycle({root,sourceFile,now});
 return {version:VERSION,state:'BOUNDED_LOCAL_EXECUTION_CONFIRMED',register,legacy:{
  items:legacy.active_items,new_items:legacy.new_or_changed,packets:legacy.local_packets_written.length},
  real,external_actions:'NONE'};
}
export async function readRealStatus({root=ROOT()}={}){
 try{return await readJson(join(root,'RealWorkV55','last-real-cycle.json'))}
 catch(e){if(e.code==='ENOENT')return {version:VERSION,state:'NOT_ACTIVATED'};throw e}
}
