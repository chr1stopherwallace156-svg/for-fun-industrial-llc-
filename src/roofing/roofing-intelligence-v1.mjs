// FUN_ROOFING_OPPORTUNITY_V1 — bounded, locally stored public-record research.
// No homeowner names/phones, scraping, automated outreach, bids, payments, or REA grants.
// All remote calls require an explicit operator button through the same-origin dashboard.
import {readFile,writeFile,rename,mkdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';

export const ROOF_VERSION='fun-roofing-opportunity-v1';
const ROOT=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'FunIndustrial','RoofingOpportunityV1'):null;
const SIZE_LIMIT=8*1024*1024, MAX_PROPERTIES=25000,MAX_PERMITS=30000,MAX_IMPORT=1000;
const COUNTIES=new Set(['Los Angeles','San Bernardino']);
const LA_SOURCES=[
 {id:'la_city_2010_2019',city:'Los Angeles',county:'Los Angeles',url:'https://data.lacity.org/resource/dyxf-7hc4.json',coverage:'2010–2019'},
 {id:'la_city_2020_present',city:'Los Angeles',county:'Los Angeles',url:'https://data.lacity.org/resource/pi9x-tg5x.json',coverage:'2020–present'}
];
export const SOURCE_DIRECTORY=[
 {name:'Los Angeles City — Building permits 2010–2019',id:'la_city_2010_2019',status:'LIVE_API_OPERATOR_REFRESH',coverage:'2010–2019',url:'https://data.lacity.org/d/dyxf-7hc4'},
 {name:'Los Angeles City — Building permits 2020–present',id:'la_city_2020_present',status:'LIVE_API_OPERATOR_REFRESH',coverage:'2020–present',url:'https://data.lacity.org/d/pi9x-tg5x'},
 {name:'Los Angeles County — unincorporated',id:'la_county_epicla',status:'PORTAL_NOT_CONNECTED',coverage:'Unknown',url:'https://epicla.lacounty.gov/'},
 {name:'San Bernardino County — unincorporated',id:'sb_county_ezpermits',status:'PORTAL_NOT_CONNECTED',coverage:'Unknown',url:'https://ezpermits.sbcounty.gov/SBC/Default.aspx'},
 {name:'Victorville — monthly issued CSV',id:'victorville_monthly',status:'CSV_IMPORT_SUPPORTED',coverage:'Depends on files supplied',url:'https://www.victorvilleca.gov/Government/City-Departments/Building/Building-Monthly-Issued-Permit-Reports'},
 {name:'Other incorporated cities',id:'other_city_permits',status:'MUNICIPAL_FEED_REQUIRED',coverage:'Unknown',url:null}
];
const NWS_PLACES=[
 {name:'Los Angeles',county:'Los Angeles',lat:34.0522,lon:-118.2437},
 {name:'Palmdale',county:'Los Angeles',lat:34.5794,lon:-118.1165},
 {name:'San Bernardino',county:'San Bernardino',lat:34.1083,lon:-117.2898},
 {name:'Victorville',county:'San Bernardino',lat:34.5361,lon:-117.2912},
 {name:'Ontario',county:'San Bernardino',lat:34.0633,lon:-117.6509}
];
const limitText=(v,n=160)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
const hex=(v)=>createHash('sha256').update(v).digest('hex');
function county(v){
 const s=limitText(v,100).toLowerCase().replace(/ county$/,'');
 if(s==='los angeles'||s==='la')return 'Los Angeles';
 if(s==='san bernardino'||s==='sb')return 'San Bernardino';
 return null;
}
function keyOf(v){
 const normalized=s=>limitText(s,220).toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 return [county(v.county),normalized(v.city),normalized(v.address)].join('|');
}
function date(v){
 const s=limitText(v,40);
 return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):null;
}
const roofWords=/\b(?:RE[\s-]?ROOF(?:ING)?|ROOF(?:ING)?|SHINGLES?|ROOF\s*TILES?)\b/i;
const cleanProperty=r=>{
 const c=county(r.county),city=limitText(r.city,85),address=limitText(r.address,180);
 const year=Number(r.year_built);
 if(!c||city.length<2||address.length<5||!Number.isInteger(year)||year<1800||year>2035)return null;
 if(/^(PO BOX|P\.?O\.? BOX)/i.test(address))return null;
 return {county:c,city,address,zip:/^\d{5}$/.test(String(r.zip??''))?String(r.zip):'',
  year_built:year,property_type:limitText(r.property_type,35)||'UNKNOWN',evidence:'OPERATOR_IMPORTED_PROPERTY_INVENTORY'};
};
const cleanPermit=(r,sourceId,assumeRoof=false)=>{
 const c=county(r.county),city=limitText(r.city,85),address=limitText(r.address,180);
 const desc=limitText(r.work_description??r.description,340);
 const issued=date(r.issue_date);
 if(!c||city.length<2||address.length<5||!issued)return null;
 if(!assumeRoof&&!roofWords.test(desc))return null;
 return {county:c,city,address,issued,description:desc,source_id:sourceId,
   permit_id:limitText(r.permit_id,90),imported_assumed_roof:assumeRoof&&!roofWords.test(desc)};
};
function empty(){
 return {version:ROOF_VERSION,updated:null,properties:[],permits:[],weather:[],
  sourceRuns:{},sourceNotes:[],outreachActions:0,toolExecutions:0,elektronTouched:false};
}
async function load(root=ROOT){
 if(!root)return empty();
 const file=join(root,'state.json');
 try{
  const st=await lstat(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size>SIZE_LIMIT)throw Error('ROOF_STATE_UNBOUNDED_OR_LINK');
  const d=JSON.parse(await readFile(file,'utf8'));
  if(d.version!==ROOF_VERSION||!Array.isArray(d.properties)||!Array.isArray(d.permits)||
     d.properties.length>MAX_PROPERTIES||d.permits.length>MAX_PERMITS||
     d.outreachActions!==0||d.toolExecutions!==0||d.elektronTouched!==false)
    throw Error('ROOF_STATE_SCHEMA_OR_AUTHORITY_HOLD');
  return d;
 }catch(e){if(e.code==='ENOENT')return empty();throw e}
}
async function save(root,state){
 if(!root)throw Error('LOCALAPPDATA_REQUIRED');
 const copy={...state,updated:new Date().toISOString()};
 if(copy.properties.length>MAX_PROPERTIES||copy.permits.length>MAX_PERMITS)throw Error('ROOF_CAPACITY_LIMIT');
 const data=JSON.stringify(copy);
 if(Buffer.byteLength(data)>SIZE_LIMIT)throw Error('ROOF_STATE_SIZE_LIMIT');
 await mkdir(root,{recursive:true});
 const temp=join(root,'state-'+randomUUID()+'.tmp');
 await writeFile(temp,data,{encoding:'utf8',flag:'wx',mode:0o600});
 await rename(temp,join(root,'state.json'));
 return copy;
}
let queue=Promise.resolve();
function transact(fn,root=ROOT){
 const next=queue.catch(()=>{}).then(async()=>fn(await load(root),root));
 queue=next.catch(()=>{});return next;
}
export function deriveCandidates(state,{countyFilter='all',minAge=20,category='all',cityFilter=''}={}){
 const nowYear=new Date().getUTCFullYear();
 const matched=new Map();
 for(const permit of state.permits){
  const k=keyOf(permit),previous=matched.get(k);
  if(!previous||permit.issued>previous.issued)matched.set(k,permit);
 }
 const output=[];
 for(const prop of state.properties){
  if(countyFilter!=='all'&&prop.county!==countyFilter)continue;
  if(cityFilter&&prop.city.toLowerCase().indexOf(cityFilter.toLowerCase())<0)continue;
  const age=nowYear-prop.year_built;
  if(age<minAge)continue;
  const permit=matched.get(keyOf(prop));
  const years=permit?nowYear-Number(permit.issued.slice(0,4)):null;
  const status=!permit?'NO_PERMIT_FOUND_IN_INGESTED_RECORDS':years>=20?
    'LAST_RECORDED_ROOF_PERMIT_20_PLUS':'RECENT_ROOF_PERMIT_FOUND';
  if(category!=='all'&&category!==status)continue;
  const score=Math.max(0,Math.min(100,(status==='RECENT_ROOF_PERMIT_FOUND'?12:44)+
    (age>=30?17:age>=20?9:0)+(years!==null&&years>=20?16:0)));
  output.push({county:prop.county,city:prop.city,address:prop.address,zip:prop.zip,
    yearBuilt:prop.year_built,buildingAge:age,lastRecordedPermit:permit?.issued??null,
    lastPermitSource:permit?.source_id??null,category:status,reviewPriority:score,
    roofAgeKnown:false,roofConditionKnown:false,
    evidenceStatus:!permit?'ABSENCE_IN_PARTIAL_INGESTED_RECORDS_NOT_PROOF':'MATCHED_BY_ADDRESS_REQUIRES_VERIFICATION',
    nextAction:'Verify jurisdiction record coverage and offer a lawful inspection'});
 }
 output.sort((a,b)=>b.reviewPriority-a.reviewPriority||a.city.localeCompare(b.city));
 return {total:output.length,rows:output.slice(0,300),limited:output.length>300};
}
export async function roofingSnapshot({root=ROOT,filters={}}={}){
 const d=await load(root);
 const found=deriveCandidates(d,filters);
 const byCounty={'Los Angeles':0,'San Bernardino':0};
 for(const p of d.properties)byCounty[p.county]=(byCounty[p.county]||0)+1;
 return {version:ROOF_VERSION,ready:true,readOnlyInspection:true,outreachAuthorized:false,
  toolExecutions:0,elektronTouched:false,updated:d.updated,
  propertyCount:d.properties.length,roofPermitRecords:d.permits.length,
  byCounty,sourceDirectory:SOURCE_DIRECTORY.map(s=>({...s,run:d.sourceRuns[s.id]||null})),
  forecastAreas:d.weather,leadSummary:{candidateCount:found.total,
   noPermitFound:found.rows.filter(r=>r.category==='NO_PERMIT_FOUND_IN_INGESTED_RECORDS').length,
   shown:found.rows.length,limited:found.limited},
  interpretation:'Partial observed records are not proof of roof age, roof condition, or absence of permitted work'};
}
export async function roofingLeads({root=ROOT,filters={}}={}){
 const d=await load(root);
 return {version:ROOF_VERSION,ready:true,proofOfNoPermit:false,
  ...deriveCandidates(d,filters)};
}
export async function importRoofData(body,{root=ROOT}={}){
 if(!body||typeof body!=='object'||Array.isArray(body)||
    !['properties','roof_permits'].includes(body.kind)||!Array.isArray(body.rows)||
    body.rows.length<1||body.rows.length>MAX_IMPORT)
   throw Error('ROOF_IMPORT_SCHEMA_OR_BATCH_LIMIT');
 const sourceId=limitText(body.sourceId||'operator_csv',60);
 if(!/^[a-z0-9_-]{3,60}$/.test(sourceId))throw Error('ROOF_SOURCE_ID_INVALID');
 const parsed=body.rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length>14)
   throw Error('ROOF_ROW_UNEXPECTED_FIELDS');
  return body.kind==='properties'?cleanProperty(row):cleanPermit(row,sourceId,body.explicitlyRoofPermits===true);
 });
 if(parsed.some(x=>!x))throw Error('ROOF_IMPORT_HAS_INVALID_ROWS');
 return transact(async(state,dir)=>{
  const field=body.kind==='properties'?'properties':'permits';
  const records=new Map(state[field].map(p=>[field==='properties'?keyOf(p):keyOf(p)+'|'+p.issued+'|'+p.permit_id,p]));
  for(const p of parsed){
   const key=field==='properties'?keyOf(p):keyOf(p)+'|'+p.issued+'|'+p.permit_id;
   records.set(key,p);
  }
  state[field]=[...records.values()];
  state.sourceRuns[sourceId]={kind:body.kind,source:'OPERATOR_SELECTED_CSV',last:new Date().toISOString(),
    recordsImported:parsed.length,completeness:'NOT_VERIFIED'};
  await save(dir,state);
  return {version:ROOF_VERSION,accepted:parsed.length,totalStored:state[field].length,
    source:sourceId,coverage:'NOT_VERIFIED',noOutreach:true};
 },root);
}
async function boundedFetch(url,{fetchImpl=fetch,limit=5*1024*1024,timeout=13000,headers={}}={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const res=await fetchImpl(url,{method:'GET',redirect:'error',signal:ctrl.signal,
    headers:{accept:'application/json','user-agent':'FunIndustrialRoofingOpportunity/1.0 (operator-initiated public-data research)',...headers}});
  if(!res.ok)throw Error('UPSTREAM_HTTP_'+res.status);
  const text=await res.text();
  if(Buffer.byteLength(text)>limit)throw Error('UPSTREAM_OVERSIZE');
  return JSON.parse(text);
 }finally{clearTimeout(timer)}
}
export async function refreshLaCity({root=ROOT,fetchImpl=fetch}={}){
 // Only a capped, recent sample of LA City reroof-permit rows; not a countywide census.
 const sources=[];
 for(const source of LA_SOURCES){
  const url=new URL(source.url);
  url.searchParams.set('$where',"upper(work_desc) like '%ROOF%'");
  url.searchParams.set('$order','issue_date DESC');
  url.searchParams.set('$limit','1000');
  const data=await boundedFetch(url.href,{fetchImpl});
  if(!Array.isArray(data)||data.length>1000)throw Error('LA_API_SCHEMA_HOLD_'+source.id);
  const entries=data.map(r=>cleanPermit({
   county:'Los Angeles',city:'Los Angeles',
   address:r.primary_address??r.address??'',
   issue_date:r.issue_date??r.issue_dt,
   work_description:r.work_desc??r.work_description,
   permit_id:r.permit_nbr??r.permit_number??r.permit_no
  },source.id)).filter(Boolean);
  sources.push({source,raw:data.length,entries});
 }
 return transact(async(state,dir)=>{
  const base=state.permits.filter(p=>!LA_SOURCES.some(s=>s.id===p.source_id));
  const adds=sources.flatMap(s=>s.entries);
  const dedupe=new Map();
  for(const p of [...base,...adds])dedupe.set(keyOf(p)+'|'+p.issued+'|'+p.permit_id,p);
  state.permits=[...dedupe.values()];
  for(const {source,raw,entries} of sources){
   state.sourceRuns[source.id]={kind:'roof_permits',source:'OFFICIAL_LA_CITY_SOCRATA',
    last:new Date().toISOString(),recordsImported:entries.length,rowsReturned:raw,
    completeness:'PARTIAL_1000_RECENT_ROOF_MATCHES_NOT_EXHAUSTIVE',
    sourceUrl:source.url};
  }
  await save(dir,state);
  return {version:ROOF_VERSION,source:'City of Los Angeles official Socrata',
   samples:sources.map(s=>({id:s.source.id,raw:s.raw,roofPermitsAccepted:s.entries.length})),
   completeCountyCoverage:false,stored:state.permits.length,noOutreach:true};
 },root);
}
export async function refreshNws({root=ROOT,fetchImpl=fetch}={}){
 const forecast=[];
 for(const place of NWS_PLACES){
  const point=await boundedFetch('https://api.weather.gov/points/'+place.lat+','+place.lon,
    {fetchImpl,limit:75000,timeout:8000,headers:{accept:'application/geo+json'}});
  const next=point?.properties?.forecast;
  const u=typeof next==='string'?new URL(next):null;
  if(!u||u.protocol!=='https:'||u.hostname!=='api.weather.gov'||
    !u.pathname.startsWith('/gridpoints/'))throw Error('NWS_POINT_FORECAST_URL_NOT_ALLOWED');
  const w=await boundedFetch(u.href,{fetchImpl,limit:300000,timeout:8000,
    headers:{accept:'application/geo+json'}});
  const periods=w?.properties?.periods;
  if(!Array.isArray(periods)||periods.length<1)throw Error('NWS_FORECAST_INVALID');
  forecast.push({place:place.name,county:place.county,issued:limitText(w.properties?.updateTime,80),
    source:'https://api.weather.gov/',periods:periods.slice(0,14).map(p=>({
      name:limitText(p.name,60),start:limitText(p.startTime,40),
      precipitationProbability:Number.isFinite(p.probabilityOfPrecipitation?.value)?
        p.probabilityOfPrecipitation.value:null,
      summary:limitText(p.shortForecast,95)
    }))});
 }
 return transact(async(state,dir)=>{
  state.weather=forecast;
  state.sourceRuns.nws={source:'US_NATIONAL_WEATHER_SERVICE',last:new Date().toISOString(),
    completeness:'FIVE_POINT_FORECASTS_NOT_PROPERTY_LEVEL_DAMAGE_ASSESSMENT'};
  await save(dir,state);
  return {version:ROOF_VERSION,forecastAreas:forecast.length,
    issued:forecast.map(x=>({place:x.place,issued:x.issued})),
    notRoofDamageEvidence:true};
 },root);
}
