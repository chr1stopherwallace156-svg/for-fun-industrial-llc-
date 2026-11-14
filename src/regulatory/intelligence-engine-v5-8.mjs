// FIAL5.8: official data monitor; no model, credential, or browser automation.
// Independent per-source bounded refresh, SHA-256 immutable evidence, changes,
// keyless U.S. BLS observations, and historical user-facing timeline data.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile,rename} from 'node:fs/promises';
import {join,isAbsolute,resolve} from 'node:path';
import {ROOT} from '../operator/executive-ops-v1.mjs';
import {SOURCES,BLS_SERIES,RULES,CATALOG_VERSION,dueWatch,graphMilestones} from './rule-catalog-v5-8.mjs';
export const VERSION='fial5.8-regulatory-economic-v1';
const FOLDER='RegulatoryEconomicV58',FILE='last-intelligence-v1.json';
const hash=x=>createHash('sha256').update(x).digest('hex');
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const MAX_HTML=240000,MAX_JSON=90000;
function hold(name){throw Error('FIAL58_'+name)}
function validOfficial(source){
 const u=new URL(source.url);
 if(u.protocol!=='https:'||u.username||u.password||u.port||
  u.hash||u.search||u.hostname!==source.host||
  !['ww2.arb.ca.gov','procurement.ucop.edu','www.calstate.edu','api.bls.gov','www.federalregister.gov'].includes(u.hostname))
  hold('UNAPPROVED_OFFICIAL_ENDPOINT');
 return source.url;
}
async function directory(root){
 if(typeof root!=='string'||!isAbsolute(root))hold('ROOT_NOT_ABSOLUTE');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())hold('ROOT_SYMLINK');
 const dest=join(root,FOLDER);await mkdir(dest,{recursive:true});
 if((await lstat(dest)).isSymbolicLink())hold('INTEL_DIR_SYMLINK');
 return resolve(dest)
}
async function optional(file){
 try{return JSON.parse(await readFile(file,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function atomic(file,value){
 const temp=file+'.'+randomUUID()+'.tmp';
 try{
  await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(temp,file)
 }catch(e){try{await (await import('node:fs/promises')).unlink(temp)}catch{}throw e}
}
async function immutable(file,buffer){
 try{await writeFile(file,buffer,{flag:'wx',mode:0o600})}
 catch(e){if(e.code!=='EEXIST')throw e}
}
async function getBytes(reply,max){
 if(!reply||reply.redirected||reply.status<200||reply.status>299)hold('HTTP_STATUS_OR_REDIRECT');
 const len=Number(reply.headers?.get?.('content-length')||0);
 if(Number.isFinite(len)&&len>max)hold('SOURCE_SIZE');
 const reader=reply.body?.getReader?.();
 if(!reader)hold('SOURCE_BODY_UNREADABLE');
 const chunks=[];let n=0;
 try{
  while(true){
   const part=await reader.read();
   if(part.done)break;
   n+=part.value.length;
   if(n>max)hold('SOURCE_SIZE');
   chunks.push(part.value);
  }
 }finally{reader.releaseLock()}
 return Buffer.concat(chunks)
}
async function fetchSource(s,{fetcher,now}){
 const url=validOfficial(s);
 const method=s.kind==='economic_api'?'POST':'GET';
 const request={method,redirect:'manual',signal:AbortSignal.timeout(8500),
  headers:{'accept':method==='POST'?'application/json':s.kind==='federal_api'?'application/json':'text/html',
   'user-agent':'FunIndustrial-SourceMonitor/1.0 (public agency evidence; no scraping login)'}};
 if(method==='POST'){
  request.headers['content-type']='application/json';
  request.body=JSON.stringify({seriesid:BLS_SERIES.map(x=>x.id),
   startyear:String(now.getUTCFullYear()-2),endyear:String(now.getUTCFullYear())})
 }
 const r=await fetcher(url,request),type=(r.headers?.get?.('content-type')||'').toLowerCase();
 if(!type.includes(method==='POST'||s.kind==='federal_api'?'application/json':'text/html'))
  hold('CONTENT_TYPE');
 const buffer=await getBytes(r,method==='POST'||s.kind==='federal_api'?MAX_JSON:MAX_HTML);
 if(!buffer.length)hold('EMPTY_SOURCE');
 return {bytes:buffer,sha256:hash(buffer),content_type:type};
}
export function parseEconomicResponse(raw,{asOf=new Date()}={}){
 if(!obj(raw)||raw.status!=='REQUEST_SUCCEEDED'||!Array.isArray(raw.Results?.series))
  hold('BLS_UNVERIFIED_RESPONSE');
 const rows=[];
 for(const spec of BLS_SERIES){
  const matching=raw.Results.series.filter(x=>x.seriesID===spec.id);
  if(matching.length!==1||!Array.isArray(matching[0].data))continue;
  const seen=new Set();
  const data=matching[0].data.filter(p=>{
   if(!/^\d{4}$/.test(p.year||'')||!/^M(0[1-9]|1[0-2])$/.test(p.period||'')||
    !/^-?\d+(?:\.\d+)?$/.test(p.value||''))return false;
   const ym=p.year+'-'+p.period.slice(1);
   if(seen.has(ym)||Date.parse(ym+'-01T00:00:00Z')>+asOf)return false;
   seen.add(ym);return true;
  }).map(p=>({month:p.year+'-'+p.period.slice(1),value:Number(p.value)}))
   .filter(p=>Number.isFinite(p.value)&&p.value>=0&&p.value<1e7)
   .sort((a,b)=>a.month.localeCompare(b.month)).slice(-26);
  if(data.length===0)continue;
  const latest=data.at(-1),prior=data.find(x=>x.month===
   String(Number(latest.month.slice(0,4))-1)+latest.month.slice(4));
  const yoy=prior&&prior.value!==0?
   Math.round((latest.value/prior.value-1)*10000)/100:null;
  const previous=data.length>1?data.at(-2):null;
  rows.push({id:spec.id,label:spec.label,unit:spec.unit,
   context:spec.claim,frequency:'monthly',
   latest_month:latest.month,latest_value:latest.value,
   previous_month:previous?.month||null,previous_value:previous?.value??null,
   year_over_year_change_pct:spec.unit==='index'?yoy:null,
   observations:data,verified_series_id:true,
   source:'https://api.bls.gov/publicAPI/v1/timeseries/data/',
   interpretive_status:'OFFICIAL_US_NATIONAL_DATA_NOT_ELEKTRON_COST_OR_CA_CONTRACT'});
 }
 if(!rows.length)hold('BLS_NO_USABLE_SERIES');
 return rows;
}
export function parseFederalRegister(raw){
 if(!obj(raw)||!Array.isArray(raw.results))hold('FEDERAL_REGISTER_SCHEMA');
 return raw.results.slice(0,8).filter(x=>x&&typeof x.title==='string'&&
  /^https:\/\/www\.federalregister\.gov\/documents\/\d{4}\//.test(x.html_url||''))
 .map(x=>({title:x.title.slice(0,180),url:x.html_url,
  publication_date:/^\d{4}-\d{2}-\d{2}$/.test(x.publication_date||'')?x.publication_date:null,
  status:'UNREVIEWED_FEDERAL_NOTICE_NOT_CA_COMPLIANCE_CLAIM'}));
}
function fetchTime(previous,source,now){
 const t=previous?.last_checked_utc;
 return !t||!Number.isFinite(Date.parse(t))||now.getTime()-Date.parse(t)>=source.refresh_hours*3600000;
}
export function scoreWatch(data,{now=new Date()}={}){
 const regulatory=dueWatch({now,limit:30});
 const changed=data.sources.filter(s=>s.change_state==='PUBLISHED_SOURCE_CHANGED').length;
 const unavailable=data.sources.filter(s=>s.state==='SOURCE_UNAVAILABLE').length;
 const upcoming=regulatory.filter(x=>x.urgency==='UPCOMING_MILESTONE_REVIEW').length;
 const opportunities=['schools','campus','public_fleets','trucking','off_road','airport_shuttle'].map(sector=>({
  sector,rule_count:RULES.filter(x=>x.sectors.includes(sector)&&x.legal_status!=='unverified_watch_only').length,
  changes_to_review:data.sources.filter(s=>s.change_state==='PUBLISHED_SOURCE_CHANGED'&&
   SOURCES.find(x=>x.id===s.id)?.sectors.includes(sector)).length,
  verified_contracts:0,verified_buyer_fleet_ownership:0,
  status:'RESEARCH_LEADS_NOT_CONFIRMED_CUSTOMERS'
 }));
 return {published_source_changes:changed,source_holds:unavailable,
  upcoming_90_day_rule_milestones:upcoming,
  verified_individual_vehicle_due_dates:0,
  confirmed_procurement_contracts:0,
  actual_revenue:0,sector_research:opportunities,
  limitation:'Page changes and public policy dates are not proof of vehicle applicability, a new law, awarded contracts or revenue.'};
}
export async function runRegulatoryCycle({root=ROOT(),now=new Date(),fetcher=fetch}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))hold('INVALID_TIME');
 const dir=await directory(root),prior=await optional(join(dir,FILE));
 if(prior&&prior.version!==VERSION)hold('PRIOR_LEDGER_VERSION');
 const previous=new Map((prior?.sources||[]).map(x=>[x.id,x]));
 const records=[],events=[];
 let economic=Array.isArray(prior?.economic_series)?prior.economic_series:[],
  federal=Array.isArray(prior?.federal_notices)?prior.federal_notices:[];
 let refreshed=0,changed=0,held=0;
 for(const s of SOURCES){
  const before=previous.get(s.id);
  if(before&&!fetchTime(before,s,now)){
   records.push({...before,checked_this_cycle:false,change_state:'NOT_CHECKED_TTL'});
   continue;
  }
  refreshed++;
  try{
   const r=await fetchSource(s,{fetcher,now});
   const evidence=join(dir,s.id+'-'+r.sha256.slice(0,18)+(s.kind==='regulatory_html'||s.kind==='procurement_portal_page'?'.html':'.json'));
   let derived;
   if(s.kind==='economic_api'){
    const parsed=JSON.parse(r.bytes.toString('utf8'));
    derived=parseEconomicResponse(parsed,{asOf:now});
   }else if(s.kind==='federal_api'){
    derived=parseFederalRegister(JSON.parse(r.bytes.toString('utf8')));
   }
   await immutable(evidence,r.bytes);
   if(s.kind==='economic_api')economic=derived;
   if(s.kind==='federal_api')federal=derived;
   const isChanged=!!before?.sha256&&before.sha256!==r.sha256;
   if(isChanged){changed++;events.push({id:s.id,type:'PUBLISHED_SOURCE_CHANGED',source_url:s.url,
    observed_at_utc:now.toISOString(),old_sha256:before.sha256,new_sha256:r.sha256,
    human_verification_required:true})}
   records.push({id:s.id,source_url:s.url,kind:s.kind,
    state:'SOURCE_RETRIEVED',change_state:!before?.sha256?'FIRST_BASELINE_NO_CHANGE_CLAIM':
      isChanged?'PUBLISHED_SOURCE_CHANGED':'PUBLISHED_SOURCE_UNCHANGED',
    sha256:r.sha256,raw_evidence_file:evidence,bytes:r.bytes.length,
    last_checked_utc:now.toISOString(),checked_this_cycle:true,
    legal_interpretation_updated:false});
  }catch(e){
   held++;
   records.push({id:s.id,source_url:s.url,kind:s.kind,
    state:'SOURCE_UNAVAILABLE',change_state:'SOURCE_UNAVAILABLE_NO_NEW_RULE_CLAIM',
    sha256:before?.sha256||null,raw_evidence_file:before?.raw_evidence_file||null,
    bytes:before?.bytes||null,last_checked_utc:now.toISOString(),
    checked_this_cycle:true,legal_interpretation_updated:false,
    reason:String(e.message||e).slice(0,160)});
  }
 }
 const history=Array.isArray(prior?.history)?prior.history.filter(x=>obj(x)).slice(-47):[];
 const counts={monitored:SOURCES.length,refreshed,source_changes:changed,source_holds:held,
  economic_series:economic.length,visible_milestones:graphMilestones().length};
 const newEntry={as_of_utc:now.toISOString(),changed,held,refreshed,economic_latest:
  economic.map(x=>({id:x.id,month:x.latest_month,value:x.latest_value}))};
 history.push(newEntry);
 const out={version:VERSION,source_catalog_version:CATALOG_VERSION,
  as_of_utc:now.toISOString(),state:'REAL_PUBLIC_DATA_CHECK_COMPLETED',
  monitoring_policy:'TTL_REFRESH_24_TO_48_HOURS_INCREMENTAL',
  counts,sources:records,economic_series:economic,
  federal_notices:federal,rule_watch:dueWatch({now,limit:30}),
  timeline:graphMilestones(),published_changes:events,history,
  boundaries:{actual_vehicle_inspections:0,automatic_filing:0,emails_sent:0,
   purchases:0,rea_calls:0,model_calls:0,verified_individual_due_dates:0,
   bid_submissions:0,license_eligibility_verified:false}};
 out.analysis=scoreWatch(out,{now});
 await atomic(join(dir,FILE),out);
 return out;
}
export async function readRegulatoryStatus({root=ROOT()}={}){
 const raw=await optional(join(root,FOLDER,FILE));
 if(!raw)return {version:VERSION,state:'NOT_ACTIVATED',counts:{monitored:SOURCES.length,
  refreshed:0,source_changes:0,source_holds:0,economic_series:0},
  rule_watch:dueWatch(),timeline:graphMilestones(),economic_series:[],sources:[],history:[],
  boundaries:{emails_sent:0,automatic_filing:0,model_calls:0}};
 if(raw.version!==VERSION||raw.boundaries?.emails_sent!==0||
  raw.boundaries?.automatic_filing!==0||raw.boundaries?.model_calls!==0||
  !Array.isArray(raw.sources)||raw.sources.length!==SOURCES.length)hold('STATUS_MALFORMED');
 // Private local raw evidence paths are omitted from the browser response.
 return {...raw,sources:raw.sources.map(({raw_evidence_file,...rest})=>rest)};
}
