// FIAL5.13 — verified public fleet buyer and purchasing authority, NOT a sale.
// Exact official sources only; immutable SHA-256; no contact, orders or accounts.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,rename,unlink,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {CATALOG_VERSION,SOURCES,BUYER,GATES,BOUNDARIES,decision} from './buyer-catalog-v5-13.mjs';
export const VERSION='fial5.13-verified-fleet-buyer-v1';
export const DIRECTORY='FleetBuyerV513',FILENAME='last-buyer-cycle-v1.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const hold=x=>{throw Error('FIAL513_'+x)};
const evidenceFile=(dir,s,h)=>join(dir,s.id+'-'+h.slice(0,24)+'.html');
async function safeDir(root){
 if(typeof root!=='string'||!isAbsolute(root))hold('ROOT_INVALID');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())hold('ROOT_SYMLINK_REFUSED');
 const d=join(root,DIRECTORY);await mkdir(d,{recursive:true});
 if((await lstat(d)).isSymbolicLink())hold('EVIDENCE_DIRECTORY_SYMLINK_REFUSED');
 return d
}
async function optional(path){
 try{return JSON.parse(await readFile(path,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function atomic(file,value){
 const t=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(t,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(t,file)}
 catch(e){try{await unlink(t)}catch{}throw e}
}
const validHash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function validSource(x,s){
 return x?.id===s.id&&x.url===s.url&&
 ['RETRIEVED','HOLD','CHANGED_REQUIRES_REVIEW'].includes(x.state)&&
 (x.sha256===null||validHash(x.sha256))&&
 (x.state!=='RETRIEVED'||!(!validHash(x.sha256)||x.changed_requires_review))&&
 (x.state==='CHANGED_REQUIRES_REVIEW')===!!x.changed_requires_review
}
export function verifyBuyerRecord(r){
 if(!r||r.version!==VERSION||r.catalog_version!==CATALOG_VERSION||
  !Number.isFinite(Date.parse(r.as_of_utc))||
  JSON.stringify(r.buyer)!==JSON.stringify(BUYER)||
  JSON.stringify(r.requirements)!==JSON.stringify(GATES)||
  !r.boundaries||Object.keys(BOUNDARIES).some(k=>r.boundaries[k]!==BOUNDARIES[k])||
  !Array.isArray(r.sources)||r.sources.length!==SOURCES.length||!r.counts||
  r.counts.official_sources!==SOURCES.length||
  r.counts.documents_retrieved!==r.sources.filter(x=>x.state==='RETRIEVED').length||
  r.counts.source_holds!==r.sources.filter(x=>x.state!=='RETRIEVED').length||
  r.counts.verified_open_repair_bids!==0||r.counts.verified_ze_buses!==0||
  r.counts.verified_service_orders!==0||r.counts.verified_revenue_usd!==0||
  r.counts.verified_contact_permission!==0||
  !r.decision||r.decision.direct_bid_ready!==false||
  r.decision.contact_approved!==false||r.decision.verified_invoice_count!==0||
  r.decision.awarded_ze_bus_program_verified!==false||
  r.decision.current_need_status!=='NOT_VERIFIED')return false;
 for(let i=0;i<SOURCES.length;i++)if(!validSource(r.sources[i],SOURCES[i]))return false;
 const expected=decision({
  fleet:r.sources[0].state==='RETRIEVED',
  bids:r.sources[1].state==='RETRIEVED',
  vendor:r.sources[2].state==='RETRIEVED',
  zesbi:r.sources[3].state==='RETRIEVED'});
 if(JSON.stringify(r.decision)!==JSON.stringify(expected))return false;
 return true
}
async function auditEvidence(root,r){
 for(let i=0;i<SOURCES.length;i++){
  const s=SOURCES[i],x=r.sources[i];if(x.state!=='RETRIEVED')continue;
  const file=evidenceFile(join(root,DIRECTORY),s,x.sha256);
  const st=await lstat(file);
  if(st.isSymbolicLink()||!st.isFile())hold('EVIDENCE_NOT_REGULAR');
  const b=await readFile(file);
  if(b.length>s.max_bytes||sha(b)!==x.sha256)hold('EVIDENCE_HASH_MISMATCH');
  const html=b.toString('utf8').toLowerCase();
  if(!s.facts.every(f=>html.includes(f.toLowerCase())))hold('SAVED_SOURCE_FACTS_MISSING')
 }
}
async function boundedBody(response,max){
 if(!response||response.status!==200||response.redirected)hold('OFFICIAL_SOURCE_NOT_DIRECT_200');
 const len=Number(response.headers?.get?.('content-length')||0);
 if(len>max)hold('SOURCE_BODY_OVER_BUDGET');
 const stream=response.body?.getReader?.();if(!stream)hold('SOURCE_BODY_UNREADABLE');
 let bytes=0;const parts=[];
 try{while(true){
  const chunk=await stream.read();if(chunk.done)break;
  bytes+=chunk.value.length;if(bytes>max)hold('SOURCE_BODY_OVER_BUDGET');
  parts.push(chunk.value)
 }}finally{stream.releaseLock()}
 if(bytes<50)hold('SOURCE_BODY_TOO_SMALL');
 return Buffer.concat(parts)
}
async function checkSource(s,fetcher){
 const u=new URL(s.url);
 if(u.protocol!=='https:'||u.hostname!==s.host||u.username||u.password||
  (u.port&&u.port!=='443')||u.hash)hold('OFFICIAL_SOURCE_IDENTITY_REJECTED');
 const r=await fetcher(s.url,{method:'GET',redirect:'manual',
  signal:AbortSignal.timeout(9000),headers:{accept:'text/html',
   'user-agent':'FunIndustrial-FleetBuyerEvidence/1.0 (public-source-only)'}});
 const bytes=await boundedBody(r,s.max_bytes);
 const type=String(r.headers?.get?.('content-type')||'').toLowerCase();
 const html=bytes.toString('utf8');
 if(!type.includes('text/html')||!/<(?:html|!doctype|head|body)\b/i.test(html.slice(0,1500)))
  hold('OFFICIAL_HTML_TYPE_INVALID');
 if(!s.facts.every(t=>html.toLowerCase().includes(t.toLowerCase())))
  hold('OFFICIAL_FACTS_NOT_VERIFIED_IN_SOURCE');
 return bytes
}
function decorate(record,now){
 const current=record.sources.map((x,i)=>{
  const m=Date.parse(x.last_checked_utc||''),s=SOURCES[i];
  const valid=Number.isFinite(m)&&+now>=m&&+now-m<=s.ttl_hours*3600000&&x.state==='RETRIEVED';
  return {...x,evidence_current:valid,
   display_state:valid?'OFFICIAL_SOURCE_FACTS_VERIFIED':
    x.state==='CHANGED_REQUIRES_REVIEW'?'HUMAN_REVIEW_CHANGED_SOURCE':
    'OFFICIAL_SOURCE_UNAVAILABLE_OR_STALE'}
 });
 const buyerVerified=current.slice(0,3).every(x=>x.evidence_current);
 return {...record,sources:current,
  decision:{...decision({
    fleet:current[0].evidence_current,
    bids:current[1].evidence_current,
    vendor:current[2].evidence_current,
    zesbi:current[3].evidence_current
  }),buyer_evidence_state:buyerVerified?
   'PUBLIC_FLEET_OPERATOR_AND_PURCHASING_ROUTE_VERIFIED':
   'PUBLIC_BUYER_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED'},
  counts:{...record.counts,current_sources:current.filter(x=>x.evidence_current).length,
   verified_public_buyer_pathways:buyerVerified?1:0}
 }
}
export async function runBuyerCycle({root=ROOT(),now=new Date(),fetcher=fetch}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))hold('CLOCK_INVALID');
 const dir=await safeDir(root),dest=join(dir,FILENAME),prior=await optional(dest);
 if(prior){if(!verifyBuyerRecord(prior))hold('PRIOR_RECORD_INVALID');await auditEvidence(root,prior)}
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
   const bytes=await checkSource(s,fetcher),digest=sha(bytes);
   const path=evidenceFile(dir,s,digest);
   try{await writeFile(path,bytes,{flag:'wx',mode:0o600})}
   catch(e){if(e.code!=='EEXIST')throw e;
    if(sha(await readFile(path))!==digest)hold('EVIDENCE_HASH_COLLISION')
   }
   const wasChanged=!!old?.sha256&&old.sha256!==digest;
   if(wasChanged)changed++;
   const review=wasChanged||old?.state==='CHANGED_REQUIRES_REVIEW';
   sources.push({id:s.id,url:s.url,sha256:digest,
    state:review?'CHANGED_REQUIRES_REVIEW':'RETRIEVED',
    changed_requires_review:review,
    last_checked_utc:now.toISOString(),checked_this_cycle:true,
    reason:review?'PUBLISHED_SOURCE_CHANGED_HUMAN_REVIEW_REQUIRED':null})
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
  state:'VERIFIED_PUBLIC_BUYER_EVIDENCE_RESEARCH_ONLY',
  as_of_utc:now.toISOString(),buyer:BUYER,requirements:GATES,
  sources,decision:decision({
   fleet:sources[0].state==='RETRIEVED',
   bids:sources[1].state==='RETRIEVED',
   vendor:sources[2].state==='RETRIEVED',
   zesbi:sources[3].state==='RETRIEVED'}),
  counts:{official_sources:SOURCES.length,checked_this_cycle:checked,
   documents_retrieved:sources.filter(x=>x.state==='RETRIEVED').length,
   source_holds:sources.filter(x=>x.state!=='RETRIEVED').length,
   changed_sources_pending_review:changed,
   verified_open_repair_bids:0,verified_ze_buses:0,
   verified_service_orders:0,verified_contact_permission:0,verified_revenue_usd:0},
  boundaries:BOUNDARIES,
  disclaimer:'BCSD operates school buses and publishes purchasing policies. This is not proof of EV fleet ownership, open repair need, vendor approval, ZESBI award, existing PO or revenue.'
 };
 if(!verifyBuyerRecord(record))hold('RECEIPT_SCHEMA_REJECTED');
 await atomic(dest,record);
 return decorate(record,now)
}
export async function readBuyerStatus({root=ROOT(),now=new Date()}={}){
 const record=await optional(join(root,DIRECTORY,FILENAME));
 if(!record)return {version:VERSION,catalog_version:CATALOG_VERSION,
  state:'NOT_ACTIVATED',as_of_utc:null,buyer:BUYER,requirements:GATES,
  sources:[],decision:decision(),
  counts:{official_sources:SOURCES.length,checked_this_cycle:0,
   documents_retrieved:0,source_holds:0,changed_sources_pending_review:0,
   current_sources:0,verified_public_buyer_pathways:0,
   verified_open_repair_bids:0,verified_ze_buses:0,
   verified_service_orders:0,verified_contact_permission:0,verified_revenue_usd:0},
  boundaries:BOUNDARIES};
 if(!verifyBuyerRecord(record))hold('SAVED_RECORD_AUTHORITY_INVALID');
 await auditEvidence(root,record);
 return decorate(record,now)
}
