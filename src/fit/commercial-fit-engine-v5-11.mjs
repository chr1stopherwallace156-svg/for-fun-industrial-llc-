// FIAL5.11 bounded official-public-source watch & honest commercial fit.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {VERSION as CATALOG,OPPORTUNITIES,OFFICIAL_SOURCES,PROFILE,
 AUTHORITY,rankCommercialFit} from './commercial-fit-catalog-v5-11.mjs';
export const VERSION='fial5.11-commercial-fit-v1';
export const FOLDER='CommercialFitV511',FILENAME='last-fit-cycle-v1.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=s=>{throw Error('FIAL511_'+s)};
function file(dir,s,h){return join(dir,s.id+'-'+h.slice(0,24)+(s.kind==='pdf'?'.pdf':'.html'))}
async function location(root){
 if(typeof root!=='string'||!isAbsolute(root))fail('INVALID_ROOT');
 await mkdir(root,{recursive:true});if((await lstat(root)).isSymbolicLink())fail('ROOT_SYMLINK');
 const dir=join(root,FOLDER);
 await mkdir(dir,{recursive:true});if((await lstat(dir)).isSymbolicLink())fail('DATA_SYMLINK');
 return dir
}
async function optional(path){
 try{return JSON.parse(await readFile(path,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function atomic(path,r){
 const tmp=path+'.'+randomUUID()+'.tmp';
 try{await writeFile(tmp,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});await rename(tmp,path)}
 catch(e){try{await unlink(tmp)}catch{}throw e}
}
function same(r,entry){
 return r?.id===entry.id&&r.official_document===entry.official_document&&
  r.submission_deadline_utc===entry.submission_deadline_utc&&
  r.kind===entry.kind&&r.fit===entry.fit&&
  r.direct_bid_eligibility_verified===false&&r.validated_award_usd===0
}
export function verifyFitRecord(r){
 if(!r||r.version!==VERSION||r.catalog_version!==CATALOG||
  !Array.isArray(r.opportunities)||r.opportunities.length!==OPPORTUNITIES.length||
  !Array.isArray(r.sources)||r.sources.length!==OFFICIAL_SOURCES.length||
  !r.counts||r.counts.directly_qualified_bids!==0||
  r.counts.contracts_awarded!==0||r.counts.actual_revenue_usd!==0||
  r.counts.offical_source_count!==OFFICIAL_SOURCES.length||
  r.counts.eligible_funding_awards!==0||
  !r.boundaries||Object.keys(AUTHORITY).some(k=>r.boundaries[k]!==AUTHORITY[k])||
  !r.profile||JSON.stringify(r.profile)!==JSON.stringify(PROFILE))return false;
 for(let i=0;i<OPPORTUNITIES.length;i++){
  const o=r.opportunities[i],expected=OPPORTUNITIES[i],rank=rankCommercialFit(expected,new Date(r.as_of_utc));
  if(!same(o,expected)||o.direct_bid_ready!==false||
   o.vendor_eligibility_verified!==false||o.contract_amount_usd_verified!==0||
   o.readiness_state!==rank.readiness_state||o.research_priority!==rank.research_priority||
   o.deadline_state!==rank.deadline_state)return false
 }
 for(let i=0;i<OFFICIAL_SOURCES.length;i++){
  const x=r.sources[i],s=OFFICIAL_SOURCES[i];
  if(!x||x.id!==s.id||x.url!==s.url||
   !['RETRIEVED','HOLD','CHANGED_REQUIRES_REVIEW'].includes(x.state)||
   (x.sha256!==null&&!/^[a-f0-9]{64}$/.test(x.sha256)))return false
 }
 if(r.counts.official_source_holds!==r.sources.filter(x=>x.state!=='RETRIEVED').length||
   r.counts.source_docs_retrieved!==r.sources.filter(x=>x.state==='RETRIEVED').length)return false;
 return true
}
async function audit(root,r){
 for(const [i,s] of OFFICIAL_SOURCES.entries()){
  const x=r.sources[i];if(x.state!=='RETRIEVED')continue;
  const p=file(join(root,FOLDER),s,x.sha256);
  const st=await lstat(p);if(st.isSymbolicLink()||!st.isFile())fail('EVIDENCE_FILE_SYMLINK_OR_NOT_FILE');
  const b=await readFile(p);
  if(b.length>s.limit_bytes||sha(b)!==x.sha256)fail('EVIDENCE_HASH_MISMATCH')
 }
}
async function bytesOf(response,max){
 if(!response||response.redirected||response.status!==200)fail('SOURCE_NOT_DIRECT_200');
 const len=Number(response.headers?.get?.('content-length')||0);
 if(Number.isFinite(len)&&len>max)fail('CONTENT_LENGTH_OVER_BUDGET');
 const reader=response.body?.getReader?.();if(!reader)fail('NO_RESPONSE_READER');
 const chunks=[];let n=0;
 try{
  while(true){const x=await reader.read();if(x.done)break;
   n+=x.value.length;if(n>max)fail('BODY_OVER_BUDGET');chunks.push(x.value)
  }
 }finally{reader.releaseLock()}
 if(n<50)fail('EMPTY_DOCUMENT');
 return Buffer.concat(chunks)
}
async function checked(s,fetcher){
 const url=new URL(s.url);
 if(url.protocol!=='https:'||url.host!==s.host||url.username||url.password||url.hash)
  fail('OFFICIAL_HOST_IDENTITY_CHANGED');
 const r=await fetcher(s.url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(9000),
  headers:{accept:s.kind==='pdf'?'application/pdf':'text/html',
   'user-agent':'FunIndustrial-CommercialFitSourceMonitor/1.0 (public issuer research)'}});
 const bytes=await bytesOf(r,s.limit_bytes);
 const type=String(r.headers?.get?.('content-type')||'').toLowerCase();
 if(s.kind==='pdf'&&(!type.includes('application/pdf')||bytes.toString('ascii',0,5)!=='%PDF-'))
  fail('PDF_CONTENT_TYPE_OR_MAGIC_INVALID');
 if(s.kind==='html'&&(!type.includes('text/html')||
    !/<(?:!doctype|html|head|body)\b/i.test(bytes.toString('utf8',0,2000))||
    !bytes.toString('utf8').toLowerCase().includes(s.anchor.toLowerCase())))
  fail('HTML_PUBLISHER_AND_PROGRAM_ANCHOR_NOT_PRESENT');
 return bytes
}
function withTimeliness(record,now){
 const asOf=new Date(record.as_of_utc),validAsOf=Number.isFinite(+asOf)&&+now>=+asOf;
 const sources=record.sources.map((x,i)=>{
  const s=OFFICIAL_SOURCES[i];
  const checkedMs=Date.parse(x.last_checked_utc||'');
  const expired=!Number.isFinite(checkedMs)||!validAsOf||+now<checkedMs||
   +now-checkedMs>s.ttl_hours*3600000;
  return {...x,live_state:expired?'CACHED_EVIDENCE_STALE':x.state,
   checked_within_ttl:!expired}
 });
 const opportunities=record.opportunities.map(o=>{
  const source=sources.find(x=>x.id===o.source_id);
  const good=source?.state==='RETRIEVED'&&source.checked_within_ttl;
  return {...o,official_source_now_accessible:!!good,
   portal_accepting_state_verified:false,
   current_published_document_state:good&&o.deadline_state==='PUBLISHED_DEADLINE_IN_FUTURE'?
    'OFFICIAL_DOCUMENT_RETRIEVED_DEADLINE_IN_FUTURE_NOT_A_READY_BID':
    o.deadline_state!=='PUBLISHED_DEADLINE_IN_FUTURE'?'PUBLISHED_DEADLINE_ELAPSED':
    'SOURCE_UNAVAILABLE_CHANGED_OR_STALE_REVIEW_REQUIRED'}
 });
 return {...record,sources,opportunities,
  counts:{...record.counts,source_docs_current:sources.filter(x=>x.state==='RETRIEVED'&&x.checked_within_ttl).length}}
}
export async function runFitCycle({root=ROOT(),now=new Date(),fetcher=fetch}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))fail('CLOCK_INVALID');
 const dir=await location(root),path=join(dir,FILENAME);
 const prior=await optional(path);
 if(prior){if(!verifyFitRecord(prior))fail('PREVIOUS_RECORD_UNVERIFIED');await audit(root,prior)}
 const old=new Map((prior?.sources||[]).map(x=>[x.id,x]));
 const sources=[];let checkedCount=0,changeCount=0;
 for(const s of OFFICIAL_SOURCES){
  const before=old.get(s.id);
  if(before?.state==='RETRIEVED'&&
    +now>=Date.parse(before.last_checked_utc)&&
    +now-Date.parse(before.last_checked_utc)<s.ttl_hours*3600000){
   sources.push({...before,checked_this_cycle:false});continue
  }
  checkedCount++;
  try{
   const bytes=await checked(s,fetcher),fingerprint=sha(bytes);
   const f=file(dir,s,fingerprint);
   try{await writeFile(f,bytes,{flag:'wx',mode:0o600})}
   catch(e){if(e.code!=='EEXIST')throw e;
    if(sha(await readFile(f))!==fingerprint)fail('IMMUTABLE_EVIDENCE_TAMPERED')
   }
   const changed=!!before?.sha256&&before.sha256!==fingerprint;
   if(changed)changeCount++;
   const review=changed||before?.state==='CHANGED_REQUIRES_REVIEW';
   sources.push({id:s.id,url:s.url,sha256:fingerprint,
    state:review?'CHANGED_REQUIRES_REVIEW':'RETRIEVED',
    checked_this_cycle:true,last_checked_utc:now.toISOString(),
    reason:review?'OFFICIAL_CONTENT_CHANGED_REQUIRES_REVIEW':null});
  }catch(e){
   sources.push({id:s.id,url:s.url,sha256:before?.sha256||null,
    state:before?.state==='CHANGED_REQUIRES_REVIEW'?'CHANGED_REQUIRES_REVIEW':'HOLD',
    checked_this_cycle:true,last_checked_utc:now.toISOString(),
    reason:String(e?.message||e).slice(0,190)});
  }
 }
 const opportunities=OPPORTUNITIES.map(o=>({...o,...rankCommercialFit(o,now)}));
 const record={version:VERSION,catalog_version:CATALOG,
  state:'COMMERCIAL_FIT_QUALIFICATION_RESEARCH_ONLY',
  as_of_utc:now.toISOString(),profile:PROFILE,sources,opportunities,
  counts:{offical_source_count:OFFICIAL_SOURCES.length,
   checked_this_cycle:checkedCount,source_docs_retrieved:sources.filter(x=>x.state==='RETRIEVED').length,
   official_source_holds:sources.filter(x=>x.state!=='RETRIEVED').length,
   changed_docs_pending_review:changeCount,
   named_programs:OPPORTUNITIES.length,directly_qualified_bids:0,
   eligible_funding_awards:0,contracts_awarded:0,actual_revenue_usd:0},
  boundaries:AUTHORITY,
  disclaimer:'Commercial and technical scope overlap is NOT supplier eligibility. Grants and incentive rebates are NOT purchase orders. Official documents do not confirm portal accept-bids state or ELEKTRON licensing.'};
 if(!verifyFitRecord(record))fail('FIT_RESULT_SCHEMA_INVALID');
 await atomic(path,record);
 return withTimeliness(record,now)
}
export async function readFitStatus({root=ROOT(),now=new Date()}={}){
 const record=await optional(join(root,FOLDER,FILENAME));
 if(!record)return {
  version:VERSION,catalog_version:CATALOG,state:'NOT_ACTIVATED',
  as_of_utc:null,profile:PROFILE,
  sources:[],opportunities:OPPORTUNITIES.map(o=>({...o,...rankCommercialFit(o,now),
   official_source_now_accessible:false,portal_accepting_state_verified:false,
   current_published_document_state:'LOCAL_SOURCE_CHECK_NOT_YET_PERFORMED'})),
  counts:{offical_source_count:OFFICIAL_SOURCES.length,checked_this_cycle:0,
   source_docs_retrieved:0,source_docs_current:0,official_source_holds:0,
   changed_docs_pending_review:0,named_programs:OPPORTUNITIES.length,
   directly_qualified_bids:0,eligible_funding_awards:0,contracts_awarded:0,actual_revenue_usd:0},
  boundaries:AUTHORITY
 };
 if(!verifyFitRecord(record))fail('SAVED_FIT_RECORD_AUTHORITY_OR_SOURCE_INVALID');
 await audit(root,record);
 // Time-dependent deadlines are recomputed, not recycled from saved static dates.
 const updated={...record,
  opportunities:record.opportunities.map((o,i)=>({...o,...rankCommercialFit(OPPORTUNITIES[i],now)}))};
 return withTimeliness(updated,now)
}
