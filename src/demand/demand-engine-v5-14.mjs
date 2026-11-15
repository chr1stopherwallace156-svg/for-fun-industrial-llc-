// FIAL5.14 official public buyer demand vs state incentive monitoring.
// GET only: no contact, bids, accounts, forms, applications, money, REA or model calls.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,rename,unlink,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {VERSION as CATALOG,SOURCES,BUYER,PROGRAM,REQUIREMENTS,BOUNDARIES,
 reviewActiveBidTitles,demandDecision} from './demand-catalog-v5-14.mjs';
export const VERSION='fial5.14-real-purchase-demand-v1';
export const DIRECTORY='PurchaseDemandV514',FILENAME='last-demand-cycle-v1.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=reason=>{throw Error('FIAL514_'+reason)};
const evFile=(d,s,digest)=>join(d,s.id+'-'+digest.slice(0,24)+'.html');
function fresh(x,s,now){
 const t=Date.parse(x?.last_checked_utc||'');
 return x?.state==='RETRIEVED'&&Number.isFinite(t)&&+now>=t&&
  +now-t<s.ttl_hours*3600000;
}
async function safeDir(root){
 if(typeof root!=='string'||!isAbsolute(root))fail('ROOT_INVALID');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())fail('ROOT_SYMLINK');
 const d=join(root,DIRECTORY);await mkdir(d,{recursive:true});
 if((await lstat(d)).isSymbolicLink())fail('EVIDENCE_DIRECTORY_SYMLINK');
 return d
}
async function optional(file){
 try{return JSON.parse(await readFile(file,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function atomic(file,data){
 const t=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(t,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});await rename(t,file)}
 catch(e){try{await unlink(t)}catch{}throw e}
}
const validHash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function sourceValid(x,s){
 return x?.id===s.id&&x?.url===s.url&&
 ['RETRIEVED','HOLD','CHANGED_REQUIRES_REVIEW'].includes(x.state)&&
 (x.sha256===null||validHash(x.sha256))&&
 (x.state!=='RETRIEVED'||(validHash(x.sha256)&&!x.changed_requires_review))&&
 (x.state==='CHANGED_REQUIRES_REVIEW')===!!x.changed_requires_review
}
function activeInfoValid(a){
 return a&&a.buyer_service_bid_verified===0&&
 a.qualification_state==='OFFICIAL_INDEX_TITLE_ONLY_NOT_A_VERIFIED_OPEN_BUYER_SERVICE_RFP'&&
 a.active_bid_area_seen===true&&Number.isInteger(a.parsed_titles_count)&&
 a.parsed_titles_count>=0&&a.parsed_titles_count<=25&&
 Array.isArray(a.possible_relevant_titles)&&a.possible_relevant_titles.length<=25&&
 a.possible_relevant_titles.every(x=>typeof x.title==='string'&&x.title.length<=180&&
  /^\d{2}-\d{2}-\d{2}$/.test(x.bid_id)&&
  x.service_relevant_hint===true&&x.open_deadline_verified===false&&
  x.official_bid_package_verified===false&&x.vendor_fit_verified===false&&x.contact_authorized===false)
}
export function validateDemandReceipt(r){
 if(!r||r.version!==VERSION||r.catalog_version!==CATALOG||
  !Number.isFinite(Date.parse(r.as_of_utc||''))||
  JSON.stringify(r.buyer)!==JSON.stringify(BUYER)||
  JSON.stringify(r.program)!==JSON.stringify(PROGRAM)||
  JSON.stringify(r.requirements)!==JSON.stringify(REQUIREMENTS)||
  !Array.isArray(r.sources)||r.sources.length!==SOURCES.length||
  SOURCES.some((s,i)=>!sourceValid(r.sources[i],s))||
  !r.counts||r.counts.official_sources!==SOURCES.length||
  r.counts.documents_retrieved!==r.sources.filter(s=>s.state==='RETRIEVED').length||
  r.counts.source_holds!==r.sources.filter(s=>s.state!=='RETRIEVED').length||
  r.counts.verified_live_ev_repair_rfps!==0||r.counts.buyer_orders!==0||
  r.counts.actual_revenue_usd!==0||r.counts.verified_funded_district_awards!==0||
  !r.boundaries||Object.keys(BOUNDARIES).some(k=>r.boundaries[k]!==BOUNDARIES[k])||
  !r.active_bid_review||!activeInfoValid(r.active_bid_review)||!r.decision||
  r.decision.bids_ready!==0||r.decision.contact_authorized!==false||
  r.decision.purchase_orders_verified!==0||r.decision.revenue_usd!==0||
  r.decision.confirmed_current_ev_maintenance_buyers!==0)return false;
 const d=demandDecision({
  bids:r.sources[0].state==='RETRIEVED',
  cec:r.sources[1].state==='RETRIEVED',
  faq:r.sources[2].state==='RETRIEVED',
  possible:r.sources[0].state==='RETRIEVED'?r.active_bid_review.possible_relevant_titles.length:0
 });
 return JSON.stringify(d)===JSON.stringify(r.decision)
}
async function attestEvidence(root,r){
 for(let i=0;i<SOURCES.length;i++){
  const s=SOURCES[i],x=r.sources[i];
  if(!validHash(x.sha256))continue;
  const p=evFile(join(root,DIRECTORY),s,x.sha256),st=await lstat(p);
  if(!st.isFile()||st.isSymbolicLink())fail('EVIDENCE_FILE_NOT_REGULAR');
  const b=await readFile(p);
  if(b.length>s.max_bytes||sha(b)!==x.sha256)fail('EVIDENCE_SHA256_MISMATCH');
  const txt=b.toString('utf8').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
    .replace(/[ \t\r\n]+/g,' ').toLowerCase();
  if(!s.anchors.every(a=>txt.includes(a.toLowerCase())))fail('SAVED_ANCHORS_MISSING');
  if(i===0&&x.state==='RETRIEVED'){
   const actual=reviewActiveBidTitles(b.toString('utf8'));
   if(JSON.stringify(actual)!==JSON.stringify(r.active_bid_review))
     fail('ACTIVE_BID_TITLE_EVIDENCE_TAMPERED')
  }
 }
}
async function body(response,cap){
 if(response?.status!==200||response.redirected)fail('PUBLIC_HTML_NOT_DIRECT_200');
 const len=Number(response.headers?.get?.('content-length')||0);
 if(len>cap)fail('PUBLIC_BODY_OVERSIZED');
 const reader=response.body?.getReader?.();if(!reader)fail('PUBLIC_BODY_STREAM_MISSING');
 const parts=[];let size=0;
 try{while(true){const x=await reader.read();if(x.done)break;
  size+=x.value.length;if(size>cap)fail('PUBLIC_BODY_OVERSIZED');
  parts.push(x.value)
 }}finally{reader.releaseLock()}
 if(size<80)fail('PUBLIC_HTML_TOO_SMALL');
 return Buffer.concat(parts)
}
async function retrieve(source,fetcher){
 const u=new URL(source.url);
 if(u.protocol!=='https:'||u.hostname!==source.host||u.username||u.password||
  (u.port&&u.port!=='443')||u.hash)fail('PINNED_ORIGIN_INVALID');
 const res=await fetcher(source.url,{method:'GET',redirect:'manual',
  signal:AbortSignal.timeout(9000),
  headers:{accept:'text/html','user-agent':'FunIndustrial-PurchaseDemandResearch/1.0'}});
 const bytes=await body(res,source.max_bytes),t=String(res.headers?.get?.('content-type')||'');
 if(!t.toLowerCase().includes('text/html'))fail('PUBLIC_CONTENT_TYPE_INVALID');
 const html=bytes.toString('utf8');
 if(!/<(?:html|!doctype|head|body)\b/i.test(html.slice(0,1200)))fail('PUBLIC_NOT_HTML');
 const txt=html.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/[ \t\r\n]+/g,' ').toLowerCase();
 if(!source.anchors.every(a=>txt.includes(a.toLowerCase())))fail('PUBLIC_ANCHOR_UNVERIFIED');
 if(source.id==='bcsd-active-bids')reviewActiveBidTitles(html);
 return bytes
}
const noActive=()=>({active_bid_area_seen:true,parsed_titles_count:0,possible_relevant_titles:[],
 buyer_service_bid_verified:0,
 qualification_state:'OFFICIAL_INDEX_TITLE_ONLY_NOT_A_VERIFIED_OPEN_BUYER_SERVICE_RFP'});
function view(record,now){
 const src=record.sources.map((x,i)=>{
  const ok=fresh(x,SOURCES[i],now);
  return {...x,source_current:ok,
   display_state:ok?'PUBLISHED_SOURCE_INDEX_CURRENT':
    x.state==='CHANGED_REQUIRES_REVIEW'?'HOLD_SOURCE_CHANGED_REVIEW':
    'HOLD_UNAVAILABLE_OR_STALE'}
 });
 const event=Date.parse(PROGRAM.opening_local);
 const state=+now<event?'ANNOUNCED_UPCOMING_NOT_YET_OPEN':'DATE_REACHED_RECHECK_OFFICIAL_APPLICATION_PORTAL';
 const notice=record.active_bid_review;
 return {...record,sources:src,program_event_state:src[1].source_current&&src[2].source_current?
  state:'SOURCE_CONFIRMATION_REQUIRED',
  decision:demandDecision({bids:src[0].source_current,cec:src[1].source_current,
   faq:src[2].source_current,
   possible:src[0].source_current?notice.possible_relevant_titles.length:0}),
  counts:{...record.counts,current_sources:src.filter(x=>x.source_current).length,
   titles_for_manual_review:src[0].source_current?notice.possible_relevant_titles.length:0}
 }
}
export async function runDemandCycle({root=ROOT(),now=new Date(),fetcher=fetch}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))fail('CLOCK_INVALID');
 const dir=await safeDir(root),out=join(dir,FILENAME),old=await optional(out);
 if(old){if(!validateDemandReceipt(old))fail('OLD_RECORD_INVALID');await attestEvidence(root,old)}
 const prev=new Map((old?.sources||[]).map(x=>[x.id,x]));
 const sources=[];let checked=0,changes=0;
 let active=old?.active_bid_review||noActive();
 for(const s of SOURCES){
  const earlier=prev.get(s.id);
  if(fresh(earlier,s,now)){sources.push({...earlier,checked_this_cycle:false});continue}
  checked++;
  try{
   const bytes=await retrieve(s,fetcher),digest=sha(bytes);
   const file=evFile(dir,s,digest);
   try{await writeFile(file,bytes,{flag:'wx',mode:0o600})}
   catch(e){if(e.code!=='EEXIST')throw e;
    if(sha(await readFile(file))!==digest)fail('SOURCE_HASH_COLLISION')
   }
   const changed=!!earlier?.sha256&&earlier.sha256!==digest;
   if(changed)changes++;
   const hold=changed||earlier?.state==='CHANGED_REQUIRES_REVIEW';
   if(s.id==='bcsd-active-bids'&&!hold)active=reviewActiveBidTitles(bytes.toString('utf8'));
   sources.push({id:s.id,url:s.url,sha256:digest,
    state:hold?'CHANGED_REQUIRES_REVIEW':'RETRIEVED',
    changed_requires_review:!!hold,last_checked_utc:now.toISOString(),
    checked_this_cycle:true,reason:hold?'SOURCE_CHANGED_HUMAN_REVIEW_REQUIRED':null})
  }catch(e){
   const hold=earlier?.state==='CHANGED_REQUIRES_REVIEW';
   sources.push({id:s.id,url:s.url,sha256:earlier?.sha256||null,
    state:hold?'CHANGED_REQUIRES_REVIEW':'HOLD',
    changed_requires_review:!!hold,last_checked_utc:now.toISOString(),
    checked_this_cycle:true,reason:String(e.message||e).slice(0,170)})
  }
 }
 if(sources[0].state!=='RETRIEVED')active=noActive();
 const record={version:VERSION,catalog_version:CATALOG,
  state:'REAL_OFFICIAL_BUYER_INDEX_AND_LEA_INCENTIVE_RESEARCH_ONLY',
  as_of_utc:now.toISOString(),buyer:BUYER,program:PROGRAM,
  requirements:REQUIREMENTS,sources,active_bid_review:active,
  decision:demandDecision({bids:sources[0].state==='RETRIEVED',
   cec:sources[1].state==='RETRIEVED',faq:sources[2].state==='RETRIEVED',
   possible:active.possible_relevant_titles.length}),
  counts:{official_sources:SOURCES.length,checked_this_cycle:checked,
   source_changes_pending_review:changes,
   documents_retrieved:sources.filter(x=>x.state==='RETRIEVED').length,
   source_holds:sources.filter(x=>x.state!=='RETRIEVED').length,
   verified_live_ev_repair_rfps:0,buyer_orders:0,actual_revenue_usd:0,
   verified_funded_district_awards:0},
  boundaries:BOUNDARIES,
  disclaimer:'Published live bids index ≠ verified EV repair RFP. State LEA incentive ≠ ELEKTRON grant eligibility, buyer order or revenue.'
 };
 if(!validateDemandReceipt(record))fail('FINAL_RECEIPT_REJECTED');
 await atomic(out,record);return view(record,now)
}
export async function readDemandStatus({root=ROOT(),now=new Date()}={}){
 const r=await optional(join(root,DIRECTORY,FILENAME));
 if(!r)return {version:VERSION,catalog_version:CATALOG,state:'NOT_ACTIVATED',
  as_of_utc:null,buyer:BUYER,program:PROGRAM,requirements:REQUIREMENTS,
  sources:[],active_bid_review:noActive(),decision:demandDecision(),
  program_event_state:'NOT_VERIFIED',
  counts:{official_sources:SOURCES.length,checked_this_cycle:0,
   documents_retrieved:0,source_holds:0,source_changes_pending_review:0,
   current_sources:0,titles_for_manual_review:0,
   verified_live_ev_repair_rfps:0,buyer_orders:0,actual_revenue_usd:0,
   verified_funded_district_awards:0},boundaries:BOUNDARIES};
 if(!validateDemandReceipt(r))fail('SAVED_RECORD_AUTHORITY_OR_SCHEMA_INVALID');
 await attestEvidence(root,r);return view(r,now)
}
