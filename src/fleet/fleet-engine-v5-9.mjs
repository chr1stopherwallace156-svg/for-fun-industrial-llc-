// FIAL5.9 locally persisted, official-source-anchored fleet opportunity evidence.
// Sources are observed, not parsed into uncontrolled action instructions.
// Historical LEA reservations are human-transcribed from the program-manager PDF.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join,isAbsolute,resolve} from 'node:path';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {VERSION as CATALOG_VERSION,SOURCES,FUNDING_PDF,EXPECTED_PDF_DATE,
  ZESBI_PROGRAM,fleetQueue,PROCUREMENT_WATCH} from './fleet-sources-v5-9.mjs';
export const VERSION='fial5.9-fleet-opportunity-evidence-v1';
const FOLDER='FleetOpportunityV59',FILE='last-fleet-cycle-v1.json',HISTORY_MAX=64;
const sha=x=>createHash('sha256').update(x).digest('hex');
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
function hold(why){throw Error('FIAL59_'+why)}
function checkSource(s){
 const u=new URL(s.url);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||
  u.hostname!==s.host||!['www.energy.ca.gov','californiazesbi.org','www.cde.ca.gov',
    'procurement.ucop.edu','www.calstate.edu'].includes(u.hostname))hold('UNREVIEWED_SOURCE_URL');
 return s.url;
}
async function dir(root){
 if(typeof root!=='string'||!isAbsolute(root))hold('ROOT_NOT_ABSOLUTE');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())hold('ROOT_SYMLINK');
 const d=join(root,FOLDER);
 await mkdir(d,{recursive:true});if((await lstat(d)).isSymbolicLink())hold('DIR_SYMLINK');
 return resolve(d)
}
async function optional(path){
 try{return JSON.parse(await readFile(path,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function atomic(file,value){
 const temp=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,file)}
 catch(e){try{await unlink(temp)}catch{}throw e}
}
async function immutable(file,bytes){
 try{await writeFile(file,bytes,{flag:'wx',mode:0o600})}
 catch(e){if(e.code!=='EEXIST')throw e}
}
async function getBytes(response,max){
 if(!response||response.redirected||response.status<200||response.status>=300)
  hold('HTTP_NON_2XX_OR_REDIRECT');
 const h=Number(response.headers?.get?.('content-length')||0);
 if(Number.isFinite(h)&&h>max)hold('MAX_BYTES');
 const reader=response.body?.getReader?.();if(!reader)hold('BODY_UNREADABLE');
 const chunks=[];let n=0;
 try{while(true){
  const r=await reader.read();if(r.done)break;
  n+=r.value.length;if(n>max)hold('MAX_BYTES');chunks.push(r.value);
 }}finally{reader.releaseLock()}
 if(!n)hold('EMPTY_BODY');
 return Buffer.concat(chunks)
}
function validMedia(s,r,bytes){
 const ct=String(r.headers?.get?.('content-type')||'').toLowerCase();
 if(s.type==='pdf'){
  if(!ct.includes('application/pdf')||bytes.toString('ascii',0,5)!=='%PDF-')
   hold('PDF_MEDIA_OR_HEADER_INVALID');
 }else if(!ct.includes('text/html')||!/<(?:!doctype|html|head|body)\b/i.test(bytes.toString('utf8',0,2000))){
  hold('HTML_MEDIA_OR_HEADER_INVALID');
 }
 return ct
}
function isFresh(old,s,now){
 return old?.state==='SOURCE_RETRIEVED'&&old.source_url===s.url&&
  typeof old.sha256==='string'&&/^[a-f0-9]{64}$/.test(old.sha256)&&
  Number.isFinite(Date.parse(old.last_checked_utc))&&
  (now.getTime()-Date.parse(old.last_checked_utc))<s.refresh_hours*3600000;
}
export function verifyPublicFleetReport(r){
 if(!object(r)||r.version!==VERSION||r.boundaries?.emails_sent!==0||
  r.boundaries?.filed_forms!==0||r.boundaries?.orders_placed!==0||
  r.boundaries?.rea_calls!==0||r.boundaries?.model_calls!==0||
  r.boundaries?.actual_revenue_usd!==0||
  r.counts?.verified_open_rfps!==0||
  r.counts?.awarded_contracts!==0||
  r.counts?.actual_revenue_usd!==0||
  r.counts?.named_prospects!==r.prospects?.length||
  !Array.isArray(r.sources)||r.sources.length!==SOURCES.length||
  !Array.isArray(r.prospects)||r.prospects.length<1||r.prospects.length>150||
  !Array.isArray(r.procurement_watch)||r.procurement_watch.length!==3||
  r.source_catalog_version!==CATALOG_VERSION)return false;
 if(r.prospects.some(p=>p.confirmed_bid!==false||p.verified_contract_value_usd!==0||
  p.current_bid_deadline!==null||p.vendor_eligibility!=='NOT_VERIFIED'||
  p.source_pdf!==FUNDING_PDF||
  p.source_published_date!==EXPECTED_PDF_DATE||
  p.application_funding_status!=='RESERVED_NOT_AWARD_PROVEN'))return false;
 return true
}
export async function runFleetCycle({root=ROOT(),now=new Date(),fetcher=fetch}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))hold('CLOCK_INVALID');
 const d=await dir(root);
 const prior=await optional(join(d,FILE));
 if(prior&&!verifyPublicFleetReport(prior))hold('PREVIOUS_FLEET_REPORT_TAMPERED');
 const pmap=new Map((prior?.sources||[]).map(x=>[x.id,x]));
 const sources=[],changes=[];let checked=0,held=0,changeCount=0;
 for(const s of SOURCES){
  const before=pmap.get(s.id);
  if(before&&isFresh(before,s,now)){
   sources.push({...before,checked_this_cycle:false,change_state:'SKIPPED_RECENT_VALID_EVIDENCE'});continue
  }
  checked++;
  try{
   const url=checkSource(s);
   const response=await fetcher(url,{method:'GET',redirect:'manual',
    signal:AbortSignal.timeout(9000),
    headers:{accept:s.type==='pdf'?'application/pdf':'text/html',
     'user-agent':'FunIndustrial-FleetPublicEvidence/1.0 (public nonauthenticated source checker)'}});
   const bytes=await getBytes(response,s.max_bytes);
   validMedia(s,response,bytes);
   const fingerprint=sha(bytes);
   const ext=s.type==='pdf'?'.pdf':'.html';
   const file=join(d,s.id+'-'+fingerprint.slice(0,20)+ext);
   await immutable(file,bytes);
   const isDifferent=!!before?.sha256&&before.sha256!==fingerprint;
   if(isDifferent){
    changeCount++;
    changes.push({source_id:s.id,type:'PUBLISHED_BYTES_CHANGED_REQUIRES_HUMAN_REVIEW',
     old_sha256:before.sha256,new_sha256:fingerprint,
     source_url:url,observed_at_utc:now.toISOString(),legal_claims_auto_updated:false,
     bids_auto_created:0});
   }
   sources.push({id:s.id,state:'SOURCE_RETRIEVED',source_url:url,sha256:fingerprint,
    bytes:bytes.length,raw_evidence_file:file,last_checked_utc:now.toISOString(),
    checked_this_cycle:true,change_state:before?.sha256?
     isDifferent?'PUBLISHED_BYTES_CHANGED':'UNMODIFIED':'FIRST_BASELINE_NO_CHANGE',
    bids_extracted:0,awards_verified:0});
  }catch(e){
   held++;
   sources.push({id:s.id,state:'SOURCE_UNAVAILABLE',source_url:s.url,
    sha256:before?.sha256||null,raw_evidence_file:before?.raw_evidence_file||null,
    bytes:before?.bytes??null,last_checked_utc:now.toISOString(),checked_this_cycle:true,
    change_state:'HOLD_CANNOT_INFER_PROCUREMENT_ACTIVITY',
    reason:String(e.message||e).slice(0,180),bids_extracted:0,awards_verified:0});
  }
 }
 const prospects=fleetQueue({limit:100});
 const history=Array.isArray(prior?.history)?prior.history.slice(-(HISTORY_MAX-1)):[];
 history.push({utc:now.toISOString(),source_checks:checked,source_holds:held,
  page_changes:changeCount,seeded_research_prospects:prospects.length,
  verified_open_rfps:0,actual_revenue_usd:0});
 const record={version:VERSION,source_catalog_version:CATALOG_VERSION,
  state:'PUBLISHED_HISTORICAL_FLEET_PROSPECTS_AND_OFFICIAL_SOURCE_MONITOR',
  last_cycle_utc:now.toISOString(),monitoring_hours:'6-72 hours depending on source',
  program:ZESBI_PROGRAM,counts:{official_sources:SOURCES.length,checked,held,
   published_changes:changeCount,listed_application_rows:prospects.reduce((a,p)=>a+p.application_rows,0),
   named_prospects:prospects.length,verified_open_rfps:0,awarded_contracts:0,
   actual_revenue_usd:0},sources,published_changes:changes,
  prospects,procurement_watch:PROCUREMENT_WATCH,history,
  boundaries:{emails_sent:0,filed_forms:0,orders_placed:0,rea_calls:0,
   model_calls:0,actual_revenue_usd:0,auto_vendor_registration:0},
  caveat:'Historic ZESBI funding reservation applications are not awarded grants or open supplier bids. Second solicitation does NOT use tier priority.'};
 if(!verifyPublicFleetReport(record))hold('CYCLE_RECEIPT_CONTRACT_INVALID');
 await atomic(join(d,FILE),record);
 return record
}
export async function readFleetStatus({root=ROOT()}={}){
 const saved=await optional(join(root,FOLDER,FILE));
 if(!saved)return {version:VERSION,state:'NOT_ACTIVATED',source_catalog_version:CATALOG_VERSION,
  counts:{official_sources:SOURCES.length,checked:0,held:0,published_changes:0,
   named_prospects:fleetQueue({limit:100}).length,verified_open_rfps:0,awarded_contracts:0,actual_revenue_usd:0},
  sources:[],prospects:fleetQueue({limit:100}),program:ZESBI_PROGRAM,
  procurement_watch:PROCUREMENT_WATCH,history:[],boundaries:{
   emails_sent:0,filed_forms:0,orders_placed:0,rea_calls:0,model_calls:0,actual_revenue_usd:0}};
 if(!verifyPublicFleetReport(saved))hold('INVALID_FLEET_STATUS_REFUSE_DISPLAY');
 return {...saved,sources:saved.sources.map(({raw_evidence_file,...r})=>r),
  published_changes:saved.published_changes?.slice(-25)||[],
  history:saved.history?.slice(-30)||[]}
}
