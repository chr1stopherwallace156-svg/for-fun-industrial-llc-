// FIAL5.12 — immutable, bounded official-source monitoring and honest bid gates.
// A website refresh is NEVER proof of the company's licenses or bid eligibility.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,rename,unlink,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {VERSION as CATALOG,SOURCES,LEADS,QUALIFICATIONS,
 BOUNDARIES,stage} from './readiness-catalog-v5-12.mjs';
export const VERSION='fial5.12-bid-readiness-v1';
export const DIRECTORY='BidReadinessV512',FILENAME='last-bid-readiness-cycle-v1.json';
const sha=x=>createHash('sha256').update(x).digest('hex');
const hold=reason=>{throw Error('FIAL512_'+reason)};
const evidencePath=(dir,s,digest)=>join(dir,s.id+'-'+digest.slice(0,24)+(s.type==='pdf'?'.pdf':'.html'));
const sourceState=x=>x.state==='RETRIEVED'?'RETRIEVED':x.state;
async function safeRoot(root){
 if(typeof root!=='string'||!isAbsolute(root))hold('ROOT_NOT_ABSOLUTE');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())hold('ROOT_SYMLINK');
 const d=join(root,DIRECTORY);await mkdir(d,{recursive:true});
 if((await lstat(d)).isSymbolicLink())hold('DATA_DIRECTORY_SYMLINK');
 return d
}
async function optional(file){
 try{return JSON.parse(await readFile(file,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function atomic(file,r){
 const tmp=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(tmp,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});await rename(tmp,file)}
 catch(e){try{await unlink(tmp)}catch{}throw e}
}
function validSource(x,s){
 return x?.id===s.id&&x.url===s.url&&
  ['RETRIEVED','HOLD','CHANGED_REQUIRES_REVIEW'].includes(x.state)&&
  (x.sha256===null||/^[a-f0-9]{64}$/.test(x.sha256))&&
  (x.state!=='RETRIEVED'||!!x.sha256)
}
export function verifyReadinessRecord(r){
 if(!r||r.version!==VERSION||r.catalog_version!==CATALOG||
  !Number.isFinite(Date.parse(r.as_of_utc))||
  JSON.stringify(r.qualification_profile)!==JSON.stringify(QUALIFICATIONS)||
  !r.boundaries||Object.keys(BOUNDARIES).some(k=>r.boundaries[k]!==BOUNDARIES[k])||
  !Array.isArray(r.sources)||r.sources.length!==SOURCES.length||
  !Array.isArray(r.leads)||r.leads.length!==LEADS.length||!r.counts||
  r.counts.official_sources!==SOURCES.length||
  r.counts.verified_bid_ready!==0||r.counts.actual_revenue_usd!==0||
  r.counts.source_holds!==r.sources.filter(x=>sourceState(x)!=='RETRIEVED').length||
  r.counts.documents_retrieved!==r.sources.filter(x=>sourceState(x)==='RETRIEVED').length)
  return false;
 for(let i=0;i<SOURCES.length;i++)if(!validSource(r.sources[i],SOURCES[i]))return false;
 for(let i=0;i<LEADS.length;i++){
  const l=r.leads[i],b=LEADS[i],derived=stage(b,new Date(r.as_of_utc));
  if(l.id!==b.id||l.source_url!==b.source_url||
   l.published_deadline_utc!==b.published_deadline_utc||
   l.direct_bid_status!==b.direct_bid_status||
   l.type!==b.type||l.contract_value_usd_verified!==0||
   l.contract_awarded!==false||l.direct_bid_ready!==false||
   l.verified_eligibility!==false||
   l.deadline_state!==derived.deadline_state||
   l.fit_state!==derived.fit_state)return false
 }
 return true
}
async function audit(root,r){
 for(let i=0;i<SOURCES.length;i++){
  const s=SOURCES[i],x=r.sources[i];
  if(x.state!=='RETRIEVED')continue;
  const file=evidencePath(join(root,DIRECTORY),s,x.sha256);
  const stat=await lstat(file);
  if(stat.isSymbolicLink()||!stat.isFile())hold('EVIDENCE_NOT_REGULAR_FILE');
  const b=await readFile(file);
  if(b.length>s.max_bytes||sha(b)!==x.sha256)hold('EVIDENCE_HASH_TAMPERED')
 }
}
async function boundedBody(r,max){
 if(!r||r.status!==200||r.redirected)hold('OFFICIAL_RESPONSE_NOT_DIRECT_200');
 const len=Number(r.headers?.get?.('content-length')||0);
 if(len>max)hold('CONTENT_LENGTH_OVER_BUDGET');
 const reader=r.body?.getReader?.();if(!reader)hold('RESPONSE_BODY_UNREADABLE');
 let size=0;const chunks=[];
 try{while(true){const v=await reader.read();if(v.done)break;
  size+=v.value.length;if(size>max)hold('BODY_OVER_BUDGET');chunks.push(v.value)
 }}finally{reader.releaseLock()}
 if(size<35)hold('BODY_TOO_SHORT');
 return Buffer.concat(chunks)
}
async function officialFetch(source,fetcher){
 const u=new URL(source.url);
 if(u.protocol!=='https:'||u.hostname!==source.host||u.username||u.password||u.hash||
  (u.port&&u.port!=='443'))hold('NOT_PINNED_OFFICIAL_HOST');
 const response=await fetcher(source.url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(9000),
  headers:{accept:source.type==='pdf'?'application/pdf':'text/html',
   'user-agent':'FunIndustrial-BidReadiness/1.0 (public official document monitor)'}});
 const bytes=await boundedBody(response,source.max_bytes);
 const media=String(response.headers?.get?.('content-type')||'').toLowerCase();
 if(source.type==='pdf'){
  if(!media.includes('application/pdf')||bytes.toString('ascii',0,5)!=='%PDF-')
   hold('PDF_TYPE_OR_MAGIC_INVALID');
 }else{
  const html=bytes.toString('utf8');
  if(!media.includes('text/html')||!/<(?:html|!doctype|head|body)\b/i.test(html.slice(0,1500)))
   hold('HTML_TYPE_OR_HEADER_INVALID');
  if(!source.anchors.every(anchor=>html.toLowerCase().includes(anchor.toLowerCase())))
   hold('OFFICIAL_PAGE_REQUIRED_ANCHOR_MISSING');
 }
 return bytes
}
function decorate(r,now){
 const sources=r.sources.map((x,i)=>{
  const s=SOURCES[i],time=Date.parse(x.last_checked_utc||'');
  const fresh=x.state==='RETRIEVED'&&Number.isFinite(time)&&+now>=time&&
   +now-time<=s.ttl_hours*3600000;
  return {...x,evidence_current:fresh,
   display_state:fresh?'OFFICIAL_DOCUMENT_RETRIEVED':
    x.state==='CHANGED_REQUIRES_REVIEW'?'CHANGED_REQUIRES_HUMAN_REVIEW':
    'SOURCE_UNAVAILABLE_OR_STALE'};
 });
 return {...r,sources,leads:r.leads.map((lead,i)=>{
  const basis=LEADS[i],rank=stage(basis,now);
  const matchingSource=sources.find(x=>x.id===basis.source_id);
  return {...lead,...rank,
   source_evidence_current:!!matchingSource?.evidence_current,
   buyer_accepting_submissions_verified:false,
   candidate_status:rank.deadline_state==='PUBLISHED_DEADLINE_EXPIRED'?
    'DEADLINE_EXPIRED':matchingSource?.evidence_current?
    'RESEARCH_SOURCE_RETRIEVED_BUT_QUALIFICATIONS_MISSING':
    'UNVERIFIED_OR_STALE_PUBLISHED_SOURCE'};
 }),counts:{...r.counts,source_documents_current:sources.filter(x=>x.evidence_current).length}}
}
export async function runReadinessCycle({root=ROOT(),now=new Date(),fetcher=fetch}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))hold('CLOCK_INVALID');
 const dir=await safeRoot(root),path=join(dir,FILENAME),prior=await optional(path);
 if(prior){if(!verifyReadinessRecord(prior))hold('PREVIOUS_RECORD_INVALID');await audit(root,prior)}
 const prev=new Map((prior?.sources||[]).map(x=>[x.id,x]));
 const sources=[];let checked=0,changes=0;
 for(const s of SOURCES){
  const old=prev.get(s.id);
  const ms=Date.parse(old?.last_checked_utc||'');
  if(old?.state==='RETRIEVED'&&Number.isFinite(ms)&&+now>=ms&&
    +now-ms<s.ttl_hours*3600000){
   sources.push({...old,checked_this_cycle:false});continue
  }
  checked++;
  try{
   const bytes=await officialFetch(s,fetcher),digest=sha(bytes),file=evidencePath(dir,s,digest);
   try{await writeFile(file,bytes,{flag:'wx',mode:0o600})}
   catch(e){if(e.code!=='EEXIST')throw e;
    if(sha(await readFile(file))!==digest)hold('EVIDENCE_COLLISION_OR_TAMPERING')
   }
   const changed=!!old?.sha256&&old.sha256!==digest;
   if(changed)changes++;
   const review=changed||old?.state==='CHANGED_REQUIRES_REVIEW';
   sources.push({id:s.id,url:s.url,sha256:digest,
    state:review?'CHANGED_REQUIRES_REVIEW':'RETRIEVED',
    last_checked_utc:now.toISOString(),checked_this_cycle:true,
    reason:review?'SOURCE_CHANGED_HUMAN_REVIEW_REQUIRED':null});
  }catch(e){
   sources.push({id:s.id,url:s.url,sha256:old?.sha256||null,
    state:old?.state==='CHANGED_REQUIRES_REVIEW'?'CHANGED_REQUIRES_REVIEW':'HOLD',
    last_checked_utc:now.toISOString(),checked_this_cycle:true,
    reason:String(e?.message||e).slice(0,190)});
  }
 }
 const record={version:VERSION,catalog_version:CATALOG,
  as_of_utc:now.toISOString(),state:'VERIFIED_BUSINESS_REQUIREMENTS_RESEARCH_ONLY',
  qualification_profile:QUALIFICATIONS,
  sources,leads:LEADS.map(l=>({...l,...stage(l,now)})),
  counts:{official_sources:SOURCES.length,checked_this_cycle:checked,
   source_holds:sources.filter(x=>x.state!=='RETRIEVED').length,
   documents_retrieved:sources.filter(x=>x.state==='RETRIEVED').length,
   changed_docs_pending_review:changes,lead_paths:LEADS.length,
   verified_bid_ready:0,actual_revenue_usd:0},
  boundaries:BOUNDARIES,
  constraints:[
   'Neither a bid portal nor a retrieved eligibility page proves ELEKTRON qualified',
   'Mandatory Long Beach prebid attendance was in October; actual attendance is not verified',
   'ZESBI eligible service costs require an actual awarded LEA recipient and purchasing process',
   'Never send emails, submit bids, join supplier sites or incur money without operator authorization'
  ]};
 if(!verifyReadinessRecord(record))hold('RECORD_INVALID');
 await atomic(path,record);
 return decorate(record,now)
}
export async function readReadinessStatus({root=ROOT(),now=new Date()}={}){
 const record=await optional(join(root,DIRECTORY,FILENAME));
 if(!record)return {version:VERSION,catalog_version:CATALOG,
  state:'NOT_ACTIVATED',as_of_utc:null,qualification_profile:QUALIFICATIONS,
  sources:[],leads:LEADS.map(l=>({...l,...stage(l,now),
   source_evidence_current:false,buyer_accepting_submissions_verified:false,
   candidate_status:'LOCAL_SOURCE_CHECK_NOT_PERFORMED'})),
  counts:{official_sources:SOURCES.length,checked_this_cycle:0,source_holds:0,
   documents_retrieved:0,changed_docs_pending_review:0,source_documents_current:0,
   lead_paths:LEADS.length,verified_bid_ready:0,actual_revenue_usd:0},
  boundaries:BOUNDARIES};
 if(!verifyReadinessRecord(record))hold('RECEIPT_INVALID');
 await audit(root,record);
 return decorate(record,now)
}
