// FIAL5.14 official purchasing-intent monitoring. Raw PDF is untrusted
// bytes; semantic addendum claims came from independent document review.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {CATALOG_VERSION,SOURCES,VVTA,QUALIFICATION_GATES,AUTHORITY,
 classify,validateProcurementHtml} from './demand-catalog-v5-14.mjs';
export const VERSION='fial5.14-official-purchase-demand-v1';
export const DIRECTORY='PurchaseDemandV514',FILENAME='last-purchase-demand-cycle-v1.json';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('FIAL514_'+x)};
const pathOf=(dir,s,h)=>join(dir,s.id+'-'+h.slice(0,24)+(s.type==='pdf'?'.pdf':'.html'));
async function safeDirectory(root){
 if(typeof root!=='string'||!isAbsolute(root))fail('ROOT_INVALID');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())fail('ROOT_LINK_UNTRUSTED');
 const dir=join(root,DIRECTORY);
 await mkdir(dir,{recursive:true});
 if((await lstat(dir)).isSymbolicLink())fail('SOURCE_DIR_LINK_UNTRUSTED');
 return dir;
}
async function optional(file){
 try{return JSON.parse(await readFile(file,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function atomic(file,value){
 const tmp=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(tmp,file)}
 catch(e){try{await unlink(tmp)}catch{}throw e}
}
function isSource(x,s){
 return x?.id===s.id&&x.url===s.url&&
  ['RETRIEVED','HOLD','CHANGED_REQUIRES_REVIEW'].includes(x.state)&&
  (x.sha256===null||/^[a-f0-9]{64}$/.test(x.sha256))&&
  (x.state==='RETRIEVED'?!x.changed_requires_review&&!!x.sha256:
   x.state==='CHANGED_REQUIRES_REVIEW'?x.changed_requires_review===true:
   x.changed_requires_review===false)
}
export function verifyDemandRecord(r){
 if(!r||r.version!==VERSION||r.catalog_version!==CATALOG_VERSION||
  r.state!=='OFFICIAL_FOLLOW_ON_PURCHASING_INTENT_RESEARCH_ONLY'||
  !Number.isFinite(Date.parse(r.as_of_utc))||
  JSON.stringify(r.notice)!==JSON.stringify(VVTA)||
  JSON.stringify(r.qualification_gates)!==JSON.stringify(QUALIFICATION_GATES)||
  !r.boundaries||Object.keys(AUTHORITY).some(k=>r.boundaries[k]!==AUTHORITY[k])||
  !Array.isArray(r.sources)||r.sources.length!==SOURCES.length||
  !r.counts||r.counts.official_sources!==SOURCES.length||
  r.counts.documents_retrieved!==r.sources.filter(x=>x.state==='RETRIEVED').length||
  r.counts.source_holds!==r.sources.filter(x=>x.state!=='RETRIEVED').length||
  r.counts.current_maintenance_rfps_verified!==0||
  r.counts.qualified_elektron_bids!==0||
  r.counts.awarded_contracts!==0||
  r.counts.verified_revenue_usd!==0||
  !r.classification||r.classification.current_service_rfps_verified!==0||
  r.classification.qualified_elektron_bids!==0||
  r.classification.vendor_approval_verified!==false||
  r.classification.open_specialty_service_procurement_verified!==false||
  r.classification.supporting_pdf_semantically_reparsed_by_runtime!==false||
  r.classification.direct_submission_authorized!==false||
  r.classification.contract_awarded!==false)return false;
 for(let i=0;i<SOURCES.length;i++)if(!isSource(r.sources[i],SOURCES[i]))return false;
 const expect=classify({
  listing:r.sources[0].state==='RETRIEVED',
  addendum:r.sources[1].state==='RETRIEVED'},new Date(r.as_of_utc));
 return JSON.stringify(r.classification)===JSON.stringify(expect)
}
async function audit(root,r){
 for(let i=0;i<SOURCES.length;i++){
  const s=SOURCES[i],x=r.sources[i];
  if(x.state!=='RETRIEVED')continue;
  const f=pathOf(join(root,DIRECTORY),s,x.sha256);
  const st=await lstat(f);
  if(st.isSymbolicLink()||!st.isFile())fail('EVIDENCE_NOT_REGULAR_FILE');
  const bytes=await readFile(f);
  if(bytes.length>s.max_bytes||sha(bytes)!==x.sha256)fail('EVIDENCE_HASH_MISMATCH');
  if(s.type==='pdf'&&bytes.toString('ascii',0,5)!=='%PDF-')
   fail('SAVED_PDF_MAGIC_INVALID');
  if(s.type==='html'&&!validateProcurementHtml(bytes.toString('utf8')))
   fail('SAVED_BUYER_LISTING_FACTS_MISSING')
 }
}
async function getBytes(res,budget){
 if(!res||res.status!==200||res.redirected)fail('PUBLISHER_HTTP_NON_2XX_OR_REDIRECT');
 const length=Number(res.headers?.get?.('content-length')||0);
 if(length>budget)fail('SOURCE_CONTENT_LENGTH_OVER_BUDGET');
 const reader=res.body?.getReader?.();
 if(!reader)fail('SOURCE_BODY_UNREADABLE');
 let n=0;const chunks=[];
 try{while(true){
  const x=await reader.read();if(x.done)break;
  n+=x.value.length;if(n>budget)fail('SOURCE_BYTES_OVER_BUDGET');
  chunks.push(x.value)
 }}finally{reader.releaseLock()}
 if(n<80)fail('SOURCE_TOO_SHORT');
 return Buffer.concat(chunks)
}
async function checkedSource(s,fetcher){
 const u=new URL(s.url);
 if(u.protocol!=='https:'||u.hostname!==s.host||u.username||u.password||
   (u.port&&u.port!=='443')||u.hash)fail('PUBLISHER_URL_REJECTED');
 const response=await fetcher(s.url,{method:'GET',redirect:'manual',
  signal:AbortSignal.timeout(10000),
  headers:{'accept':s.type==='pdf'?'application/pdf':'text/html',
   'user-agent':'FunIndustrial-VVTA-PublicEvidence/1.0 (read only)'}});
 const bytes=await getBytes(response,s.max_bytes);
 const media=String(response.headers?.get?.('content-type')||'').toLowerCase();
 if(s.type==='pdf'){
  if(!media.includes('application/pdf')||bytes.toString('ascii',0,5)!=='%PDF-')
   fail('PUBLISHER_PDF_CONTENT_TYPE_OR_MAGIC_INVALID')
 }else{
  const html=bytes.toString('utf8');
  if(!media.includes('text/html')||
    !/<(?:!doctype|html|head|body)\b/i.test(html.slice(0,1500))||
    !validateProcurementHtml(html))
   fail('PUBLISHED_IFB_ID_OPEN_STATUS_OR_ADDENDUM_LINK_MISSING')
 }
 return bytes
}
function decorate(r,now){
 const current=r.sources.map((x,i)=>{
  const s=SOURCES[i],ts=Date.parse(x.last_checked_utc||'');
  const valid=x.state==='RETRIEVED'&&Number.isFinite(ts)&&+now>=ts&&
   +now-ts<=s.ttl_hours*3600000;
  return {...x,evidence_current:valid,display_state:valid?'OFFICIAL_SOURCE_RETRIEVED':
    x.state==='CHANGED_REQUIRES_REVIEW'?'CHANGED_SOURCE_HUMAN_REVIEW_REQUIRED':
    'OFFICIAL_SOURCE_UNAVAILABLE_OR_STALE'}
 });
 const classification=classify({listing:current[0].evidence_current,
  addendum:current[1].evidence_current},now);
 return {...r,sources:current,classification,
  counts:{...r.counts,current_source_docs:current.filter(x=>x.evidence_current).length,
   documented_future_service_intents:classification.documented_future_service_intents}};
}
export async function runDemandCycle({root=ROOT(),now=new Date(),fetcher=fetch}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))fail('CLOCK_INVALID');
 const dir=await safeDirectory(root),receipt=join(dir,FILENAME),prior=await optional(receipt);
 if(prior){if(!verifyDemandRecord(prior))fail('PRIOR_RECEIPT_TAMPERED');await audit(root,prior)}
 const previous=new Map((prior?.sources||[]).map(x=>[x.id,x]));
 const sources=[];let checked=0,changed=0;
 for(const s of SOURCES){
  const old=previous.get(s.id),ts=Date.parse(old?.last_checked_utc||'');
  if(old?.state==='RETRIEVED'&&Number.isFinite(ts)&&+now>=ts&&
   +now-ts<s.ttl_hours*3600000){
   sources.push({...old,checked_this_cycle:false});continue
  }
  checked++;
  try{
   const bytes=await checkedSource(s,fetcher),h=sha(bytes),file=pathOf(dir,s,h);
   try{await writeFile(file,bytes,{flag:'wx',mode:0o600})}
   catch(e){
    if(e.code!=='EEXIST')throw e;
    if(sha(await readFile(file))!==h)fail('IMMUTABLE_SOURCE_FILE_COLLISION')
   }
   const modified=!!old?.sha256&&old.sha256!==h;
   if(modified)changed++;
   const review=modified||old?.state==='CHANGED_REQUIRES_REVIEW';
   sources.push({id:s.id,url:s.url,sha256:h,
    state:review?'CHANGED_REQUIRES_REVIEW':'RETRIEVED',
    changed_requires_review:!!review,
    last_checked_utc:now.toISOString(),checked_this_cycle:true,
    reason:review?'OFFICIAL_DOCUMENT_CHANGED_REQUIRES_HUMAN_REVIEW':null});
  }catch(e){
   const review=old?.state==='CHANGED_REQUIRES_REVIEW';
   sources.push({id:s.id,url:s.url,sha256:old?.sha256||null,
    state:review?'CHANGED_REQUIRES_REVIEW':'HOLD',
    changed_requires_review:!!review,
    last_checked_utc:now.toISOString(),checked_this_cycle:true,
    reason:String(e?.message||e).slice(0,190)})
  }
 }
 const record={version:VERSION,catalog_version:CATALOG_VERSION,
  state:'OFFICIAL_FOLLOW_ON_PURCHASING_INTENT_RESEARCH_ONLY',
  as_of_utc:now.toISOString(),notice:VVTA,qualification_gates:QUALIFICATION_GATES,
  sources,classification:classify({listing:sources[0].state==='RETRIEVED',
   addendum:sources[1].state==='RETRIEVED'},now),
  counts:{official_sources:SOURCES.length,checked_this_cycle:checked,
   documents_retrieved:sources.filter(x=>x.state==='RETRIEVED').length,
   source_holds:sources.filter(x=>x.state!=='RETRIEVED').length,
   changes_pending_review:changed,
   current_maintenance_rfps_verified:0,qualified_elektron_bids:0,
   awarded_contracts:0,verified_revenue_usd:0},
  boundaries:AUTHORITY,
  note:'A published IFB is for construction. VVTA addendum explicitly promises separate subsequent safety-system calibration/maintenance procurement. No separate service RFP, supplier eligibility, customer response, PO or contract exists in this evidence.'
 };
 if(!verifyDemandRecord(record))fail('RECEIPT_SCHEMA_INVALID');
 await atomic(receipt,record);
 return decorate(record,now)
}
export async function readDemandStatus({root=ROOT(),now=new Date()}={}){
 const r=await optional(join(root,DIRECTORY,FILENAME));
 if(!r)return {version:VERSION,catalog_version:CATALOG_VERSION,
  state:'NOT_ACTIVATED',as_of_utc:null,notice:VVTA,
  qualification_gates:QUALIFICATION_GATES,sources:[],
  classification:classify({},now),
  counts:{official_sources:SOURCES.length,checked_this_cycle:0,
   documents_retrieved:0,source_holds:0,changes_pending_review:0,
   current_source_docs:0,documented_future_service_intents:0,
   current_maintenance_rfps_verified:0,qualified_elektron_bids:0,
   awarded_contracts:0,verified_revenue_usd:0},
  boundaries:AUTHORITY};
 if(!verifyDemandRecord(r))fail('SAVED_RECEIPT_INVALID');
 await audit(root,r);
 return decorate(r,now)
}
