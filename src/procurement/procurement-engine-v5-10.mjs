// FIAL5.10 official-buyer evidence. A submitted bid, award or supplier fit
// is never inferred from a published RFP. Exact official source changes HOLD.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {CATALOG_VERSION,NOTICE,SOURCES,SAFETY,deadlineState,
 validateOfficialListing} from './procurement-catalog-v5-10.mjs';
export const VERSION='fial5.10-published-procurement-v1';
export const FOLDER='ProcurementV510',FILE='last-procurement-cycle-v1.json';
const hash=x=>createHash('sha256').update(x).digest('hex');
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const fail=reason=>{throw Error('FIAL510_'+reason)};
const sourceFile=(dir,s,h)=>join(dir,s.id+'-'+h.slice(0,24)+(s.kind==='pdf'?'.pdf':'.html'));
async function location(root){
 if(!isAbsolute(root))fail('ROOT_NOT_ABSOLUTE');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())fail('ROOT_LINK');
 const dir=join(root,FOLDER);
 await mkdir(dir,{recursive:true});if((await lstat(dir)).isSymbolicLink())fail('LEDGER_LINK');
 return dir
}
async function save(file,value){
 const temp=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,file)}
 catch(e){try{await unlink(temp)}catch{}throw e}
}
async function optional(path){
 try{return JSON.parse(await readFile(path,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function bytesFrom(response,max){
 if(!response||response.redirected||response.status!==200)fail('OFFICIAL_SOURCE_NOT_HTTP_200');
 const size=Number(response.headers?.get?.('content-length')||0);
 if(Number.isFinite(size)&&size>max)fail('OFFICIAL_BODY_TOO_LARGE');
 const reader=response.body?.getReader?.();if(!reader)fail('OFFICIAL_BODY_UNREADABLE');
 let sizeRead=0;const chunks=[];
 try{while(true){const part=await reader.read();if(part.done)break;
  sizeRead+=part.value.length;if(sizeRead>max)fail('OFFICIAL_BODY_TOO_LARGE');
  chunks.push(part.value);
 }}finally{reader.releaseLock()}
 if(sizeRead<20)fail('OFFICIAL_BODY_EMPTY');
 return Buffer.concat(chunks)
}
async function fetchOfficial(s,fetcher){
 const u=new URL(s.url);
 if(u.protocol!=='https:'||u.hostname!==s.host||u.username||u.password||u.port||
   u.search||u.hash)fail('OFFICIAL_SOURCE_IDENTITY_REJECTED');
 const r=await fetcher(s.url,{method:'GET',redirect:'manual',
  signal:AbortSignal.timeout(9000),
  headers:{accept:s.kind==='pdf'?'application/pdf':'text/html',
   'user-agent':'FunIndustrial-PublicProcurementEvidence/1.0 (non-authenticated local cache)'}});
 const bytes=await bytesFrom(r,s.limit_bytes);
 const type=String(r.headers?.get?.('content-type')||'').toLowerCase();
 if(s.kind==='pdf'){
  if(!type.includes('application/pdf')||bytes.toString('ascii',0,5)!=='%PDF-')
   fail('OFFICIAL_PDF_TYPE_OR_MAGIC_INVALID');
 }else if(!type.includes('text/html')||
   !/<(?:html|!doctype)\b/i.test(bytes.toString('utf8',0,1500)))fail('OFFICIAL_HTML_TYPE_INVALID');
 return bytes
}
function safePrior(r){
 if(!isObj(r)||r.version!==VERSION||r.catalog_version!==CATALOG_VERSION||
  !Array.isArray(r.sources)||r.sources.length!==SOURCES.length||
  r.notice?.solicitation_id!==NOTICE.solicitation_id||
  r.notice?.due_utc!==NOTICE.due_utc||r.notice?.scope!==NOTICE.scope||
  r.notice?.source_notice_url!==NOTICE.source_notice_url||
  r.notice?.elektron_fit!==NOTICE.elektron_fit||
  r.notice?.verified_contract_value_usd!==0||
  !isObj(r.boundaries)||Object.keys(SAFETY).some(k=>r.boundaries[k]!==SAFETY[k])||
  r.counts?.verified_current_published_notices!==r.verified_current_published_notices?.length||
  r.counts?.verified_current_published_notices>1||
  r.counts?.verified_fit_for_elektron!==0||
  r.counts?.verified_bid_awards!==0||r.counts?.actual_revenue_usd!==0||
  !Array.isArray(r.verified_current_published_notices)||r.verified_current_published_notices.length>1)
  return false;
 if(r.verified_current_published_notices.some(x=>x.id!==NOTICE.id||
    x.solicitation_id!==NOTICE.solicitation_id||x.due_utc!==NOTICE.due_utc||
    x.buyer_portal_live_status_verified!==false||
    x.elektron_vendor_fit_verified!==false||
    x.current_contract_value_verified!==false))return false;
 for(let i=0;i<SOURCES.length;i++){
  const x=r.sources[i],s=SOURCES[i];
  if(x.id!==s.id||x.url!==s.url||
   !['FETCHED','UNAVAILABLE','REVIEW_CHANGED'].includes(x.state)||
   (x.sha256!==null&&!/^[a-f0-9]{64}$/.test(x.sha256))||
   (x.state==='FETCHED'&&(!x.sha256||!x.last_checked_utc||x.changed_requires_review)))
   return false
 }
 return true
}
async function auditedSourceFiles(r,root){
 const dir=join(root,FOLDER);
 for(let i=0;i<SOURCES.length;i++){
  const x=r.sources[i],s=SOURCES[i];
  if(x.state!=='FETCHED')continue;
  const file=sourceFile(dir,s,x.sha256);
  if((await lstat(file)).isSymbolicLink())return false;
  const bytes=await readFile(file);
  if(bytes.length>s.limit_bytes||hash(bytes)!==x.sha256)return false;
  if(s.kind==='html'&&!validateOfficialListing(bytes.toString('utf8')))return false
 }
 return true
}
function statusFor(record,now){
 const good=record.sources.length===SOURCES.length&&
  record.sources.every(x=>x.state==='FETCHED'&&!x.changed_requires_review&&
   Date.parse(x.last_checked_utc)<=+now&&
   +now-Date.parse(x.last_checked_utc) <=
   SOURCES.find(s=>s.id===x.id).ttl_hours*3600000);
 const pending=deadlineState(now)==='BEFORE_PUBLISHED_DEADLINE';
 return good&&pending?
  'OFFICIAL_ISSUER_LISTING_AND_NOTICE_RETRIEVED_FUTURE_DEADLINE':
  pending?'PUBLISHED_NOTICE_REQUIRES_CURRENT_SOURCE_REVIEW':
  'PUBLISHED_NOTICE_DEADLINE_ELAPSED';
}
function buildNotice(record,now){
 return statusFor(record,now)==='OFFICIAL_ISSUER_LISTING_AND_NOTICE_RETRIEVED_FUTURE_DEADLINE'?[
  {...NOTICE,
   public_notice_verified:true,
   source_checks_utc:now.toISOString(),
   buyer_portal_live_status_verified:false,elektron_vendor_fit_verified:false,
   current_contract_value_verified:false,
   eligibility_state:'QUALIFIED_TRANSPORT_OPERATOR_REQUIREMENTS_UNREVIEWED',
   solicitation_status:'PUBLISHED_OFFICIAL_FUTURE_DEADLINE_PORTAL_AMENDMENTS_NOT_INDEPENDENTLY_CHECKED'}
 ]:[];
}
export async function runProcurementCycle({root=ROOT(),now=new Date(),fetcher=fetch}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))fail('CLOCK_INVALID');
 const dir=await location(root),file=join(dir,FILE),prior=await optional(file);
 if(prior&&(!safePrior(prior)||!(await auditedSourceFiles(prior,root))))
  fail('PRIOR_RECORD_AUTHORITY_OR_EVIDENCE_DRIFT');
 const previous=new Map((prior?.sources||[]).map(x=>[x.id,x]));
 const sources=[];let checked=0,held=0,changes=0;
 for(const s of SOURCES){
  const old=previous.get(s.id);
  if(old?.state==='FETCHED'&&!old.changed_requires_review&&
    +now>=Date.parse(old.last_checked_utc)&&
    +now-Date.parse(old.last_checked_utc)<s.ttl_hours*3600000){
   sources.push({...old,checked_this_cycle:false});continue
  }
  checked++;
  try{
   const bytes=await fetchOfficial(s,fetcher),fingerprint=hash(bytes);
   const page=s.kind==='html'?bytes.toString('utf8'):'';
   if(s.kind==='html'&&!validateOfficialListing(page))fail('OFFICIAL_NOTICE_NOT_LISTED');
   const f=sourceFile(dir,s,fingerprint);
   try{await writeFile(f,bytes,{flag:'wx',mode:0o600})}
   catch(e){if(e.code!=='EEXIST')throw e;
    const previousBytes=await readFile(f);
    if(hash(previousBytes)!==fingerprint)fail('SOURCE_FILE_HASH_COLLISION');
   }
   const changed=!!old?.sha256&&old.sha256!==fingerprint;
   if(changed)changes++;
   const review=changed||old?.changed_requires_review===true||old?.state==='REVIEW_CHANGED';
   sources.push({id:s.id,url:s.url,sha256:fingerprint,kind:s.kind,
    state:review?'REVIEW_CHANGED':'FETCHED',
    changed_requires_review:review,checked_this_cycle:true,bytes:bytes.length,
    last_checked_utc:now.toISOString(),reason:review?'OFFICIAL_SOURCE_CHANGED_HUMAN_REVIEW_REQUIRED':null});
  }catch(e){
   held++;
   sources.push({id:s.id,url:s.url,sha256:old?.sha256||null,kind:s.kind,
    state:old?.changed_requires_review?'REVIEW_CHANGED':'UNAVAILABLE',
    changed_requires_review:!!old?.changed_requires_review,
    checked_this_cycle:true,bytes:old?.bytes??null,last_checked_utc:now.toISOString(),
    reason:String(e?.message||e).slice(0,180)});
  }
 }
 const preliminary={sources};
 const confirmed=buildNotice(preliminary,now);
 const state=statusFor(preliminary,now);
 const record={version:VERSION,catalog_version:CATALOG_VERSION,
  state,as_of_utc:now.toISOString(),
  notice:NOTICE,
  sources,verified_current_published_notices:confirmed,
  counts:{official_source_checks:checked,official_source_holds:held,
   changed_sources_requiring_review:changes,
   verified_current_published_notices:confirmed.length,
   verified_fit_for_elektron:0,verified_bid_awards:0,actual_revenue_usd:0},
  boundaries:SAFETY,
  review_notes:[
   'Jurupa Unified: qualified student transportation provider procurement, NOT a fleet conversion or EV charger bid',
   'All amendments, withdrawal, actual live bidder portal status and ELEKTRON suitability remain subject to direct official verification',
   'A future published deadline is not a guaranteed accepting state on the PlanetBids portal',
   'No external actions, email, filing, procurement account registration, or bid submission authorized'
  ],
  research_only_after_deadline:deadlineState(now)!=='BEFORE_PUBLISHED_DEADLINE'};
 if(!safePrior(record))fail('RECEIPT_SCHEMA_OR_AUTHORITY_REJECTED');
 await save(file,record);return record
}
export async function readProcurementStatus({root=ROOT(),now=new Date()}={}){
 const file=join(root,FOLDER,FILE),record=await optional(file);
 if(!record)return {version:VERSION,catalog_version:CATALOG_VERSION,state:'NOT_ACTIVATED',
  notice:NOTICE,sources:[],verified_current_published_notices:[],
  counts:{official_source_checks:0,official_source_holds:0,
   changed_sources_requiring_review:0,verified_current_published_notices:0,
   verified_fit_for_elektron:0,verified_bid_awards:0,actual_revenue_usd:0},
  boundaries:SAFETY,review_notes:[]};
 if(!safePrior(record)||!(await auditedSourceFiles(record,root)))
  fail('SAVED_OFFICIAL_EVIDENCE_OR_AUTHORITY_INVALID');
 // Never report an expired/freshness-lapsed notice as still open from cached JSON.
 const confirmed=buildNotice(record,now);
 return {...record,state:statusFor(record,now),
  verified_current_published_notices:confirmed,
  counts:{...record.counts,verified_current_published_notices:confirmed.length},
  sources:record.sources.map(({bytes,...x})=>x)}
}
