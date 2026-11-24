// FUN_ROOFING_BULK_V2 bridge. SQLite reports and operator-approved full data sync only.
// No keys in frontend, no REA, marketing actions, mailbox, Elektron access, polling or proxy fetch.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync,openSync,closeSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile);
const SCRIPT=fileURLToPath(new URL('./roofing_bulk_v2.py',import.meta.url));
const SELECTIVE_SCRIPT=fileURLToPath(new URL('./selective_extract_v3.py',import.meta.url));
const DUAL_SCRIPT=fileURLToPath(new URL('./roofing_dual_formulas_v4.py',import.meta.url));
const OPPORTUNITIES_SCRIPT=fileURLToPath(new URL('./roofing_opportunities_v10.py',import.meta.url));
const LOCATION_EXPORT_SCRIPT=fileURLToPath(new URL('./export_roofing_location_research_v9.py',import.meta.url));
export const ROOFING_OPPORTUNITIES_VERSION='fun-roofing-opportunity-offers-v10';
export const DUAL_FORMULA_VERSION='fun-roofing-parallel-formulas-v4';
export const SELECTIVE_VERSION='fun-roofing-selective-v3';
const ROOT=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'FunIndustrial','RoofingBulkV2'):null;
const DB=ROOT?join(ROOT,'roofing.sqlite3'):null;
export const BULK_VERSION='fun-roofing-bulk-v2';
const ALLOWED_SOURCES=Object.freeze([
  {id:'la_assessor_2021_2025',title:'Los Angeles County assessor parcel roll 2021–2025',
    type:'property_inventory',coverage:'All county parcels in downloaded years (not all individual houses)',
    source:'https://www.arcgis.com/home/item.html?id=70d93266f45a4080a97b285a471493cd',
    mode:'FULL_EXPORT_SYNC',requiresKey:false},
  {id:'la_permits_pre2010',title:'LA City issued building permits before 2010',
    type:'roofing_permit_source',coverage:'LA City only, not countywide',
    source:'https://data.lacity.org/d/e67z-kt2n',mode:'FULL_EXPORT_SYNC',requiresKey:false},
  {id:'la_permits_2010_2019',title:'LA City issued building permits 2010–2019',
    type:'roofing_permit_source',coverage:'LA City only, not countywide',
    source:'https://data.lacity.org/d/dyxf-7hc4',mode:'FULL_EXPORT_SYNC',requiresKey:false},
  {id:'la_permits_2020_present',title:'LA City issued building permits 2020–present',
    type:'roofing_permit_source',coverage:'LA City only, not countywide',
    source:'https://data.lacity.org/d/pi9x-tg5x',mode:'FULL_EXPORT_SYNC',requiresKey:false},
  {id:'sb_arcgis_parcels',title:'San Bernardino countywide assessor parcel layer — ArcGIS',
    type:'property_inventory',coverage:'Official county parcel IDs and jurisdiction, with no street addresses or year built',
    source:'https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Parcels_for_San_Bernardino_County/FeatureServer/0',
    mode:'FULL_EXPORT_SYNC',requiresKey:false},
  {id:'sb_assessor_characteristics',title:'San Bernardino assessor property characteristics / govPIMS',
    type:'property_inventory',coverage:'Countywide file available; source format requires NP450 layout adapter or approved govPIMS CSV',
    source:'https://arc.sbcounty.gov/property-information/',mode:'MANUAL_CSV_OR_FIXED_WIDTH_HOLD',requiresKey:false},
  {id:'sb_and_la_municipal_permits',title:'Other cities / unincorporated county permits',
    type:'roofing_permit_source',coverage:'Requires separate jurisdiction-specific feeds and documented coverage',
    source:null,mode:'MUNICIPAL_ACCESS_REQUIRED',requiresKey:'varies'}
]);
let active=null;
let latest=null;
let locationRecalculationActive=false;
const python=()=>process.env.FUN_ROOFING_PYTHON||'python.exe';
function holds(){return {modelExecutions:0,reaExecutions:0,automatedOutreach:0,externalPayments:0,elektronTouched:false}}
export function bulkCatalog(){return {version:BULK_VERSION,sources:ALLOWED_SOURCES,
  keyStatus:'NO_API_KEY_NEEDED_FOR_PUBLIC_LA_FULL_EXPORTS',
  configuredSocrataToken:Boolean(process.env.SOCRATA_APP_TOKEN),
  tokenValueNeverReturned:true,...holds()}}
export async function bulkPython(cmd,args=[],{timeout=20000}={}){
 if(!ROOT||!DB)throw Error('FUN_BULK_LOCALAPPDATA_NOT_CONFIGURED');
 if(!existsSync(DB)&&cmd!=='sync')return {version:BULK_VERSION,state:'NO_DATABASE_YET',
    counts:{properties:0,permits:0,candidates:0},rows:[],source_runs:[]};
 const argv=[SCRIPT,'--db',DB,cmd,...args];
 const {stdout,stderr}=await exec(python(),argv,{windowsHide:true,timeout,maxBuffer:512*1024,
   env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 const lines=stdout.trim().split(/\r?\n/).filter(Boolean);
 const last=lines.at(-1);
 if(!last||last.length>512*1024)throw Error('FUN_BULK_WORKER_JSON_INVALID');
 const data=JSON.parse(last);
 if(data.version!=='fun-roofing-bulk-v2')throw Error('FUN_BULK_WORKER_VERSION_MISMATCH');
 return {...data,stderr:stderr?.slice(0,180)||undefined};
}
export async function selectivePython(cmd,args=[],{timeout=30000}={}){
 if(!ROOT||!DB)throw Error('FUN_SELECTION_LOCALAPPDATA_NOT_CONFIGURED');
 if(!existsSync(DB))return {version:SELECTIVE_VERSION,state:'NO_DATABASE',
    selected:0,held:0,excluded:0,rows:[]};
 const {stdout}=await exec(python(),[SELECTIVE_SCRIPT,'--db',DB,cmd,...args],
  {windowsHide:true,timeout,maxBuffer:512*1024,
   env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 const value=stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
 if(!value||value.length>512*1024)throw Error('FUN_SELECTION_WORKER_INVALID');
 const result=JSON.parse(value);
 if(result.version!==SELECTIVE_VERSION)throw Error('FUN_SELECTION_WORKER_VERSION_MISMATCH');
 return result;
}
export async function bulkDualFormulas({zips='90011,90049,90731,90037',
  years=20,recentYears=5,minBuildingAge=25,permitKind='roof_related',
  peerYears=5,minPeers=5}={}){
 if(!ROOT||!DB||!existsSync(DB))
   throw Error('ROOF_BULK_DUAL_FORMULA_LOCAL_DATABASE_REQUIRED');
 if(typeof zips!=='string'||zips.length>60||!
    /^\d{5}(,\d{5}){0,9}$/.test(zips)||
    new Set(zips.split(',')).size!==zips.split(',').length||
    !Number.isSafeInteger(years)||years<10||years>50||
    !Number.isSafeInteger(recentYears)||recentYears<1||recentYears>10||
    recentYears>=years||
    !Number.isSafeInteger(minBuildingAge)||minBuildingAge<20||minBuildingAge>100||
    !Number.isSafeInteger(peerYears)||peerYears<0||peerYears>15||
    !Number.isSafeInteger(minPeers)||minPeers<3||minPeers>30||
    !['roof_related','replacement_like'].includes(permitKind))
   throw Error('ROOF_BULK_DUAL_FORMULA_FILTER_HOLD');
 const args=[DUAL_SCRIPT,'--db',DB,'--zips',zips,'--years',String(years),
   '--recent-years',String(recentYears),'--min-building-age',String(minBuildingAge),
   '--permit-kind',permitKind,'--peer-years',String(peerYears),
   '--min-peers',String(minPeers)];
 const {stdout}=await exec(python(),args,{windowsHide:true,timeout:90000,
   maxBuffer:512*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 const parsed=JSON.parse(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
 if(parsed.version!==DUAL_FORMULA_VERSION||parsed.state!=='PARALLEL_INDEPENDENT_FORMULAS_READY')
   throw Error('ROOF_BULK_DUAL_FORMULA_RESULT_UNVERIFIED');
 return {...parsed,...holds()};
}
export async function roofingOpportunities({pathway=null}={}){
 if(!ROOT||!DB)throw Error('ROOF_OPPORTUNITIES_LOCALAPPDATA_NOT_CONFIGURED');
 if(pathway!==null&&!['HISTORICAL','NO_MATCH','OTHER'].includes(pathway))
   throw Error('ROOF_OPPORTUNITIES_PATHWAY_INVALID');
 if(!existsSync(OPPORTUNITIES_SCRIPT))throw Error('ROOF_OPPORTUNITIES_SCRIPT_NOT_INSTALLED');
 const args=[OPPORTUNITIES_SCRIPT,'--root',ROOT];
 if(pathway!==null)args.push('--pathway',pathway);
 const {stdout}=await exec(python(),args,{
    windowsHide:true,timeout:25000,maxBuffer:256*1024,
    env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 const text=stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
 if(!text||text.length>256*1024)throw Error('ROOF_OPPORTUNITIES_RESULT_INVALID');
 const result=JSON.parse(text);
 if(result.version!==ROOFING_OPPORTUNITIES_VERSION||
    !['READY_FROM_RECONCILED_LOCAL_V9_REPORTS','AWAITING_LOCAL_V9_REPORTS',
      'LOCAL_V9_REPORT_INCOMPLETE_HOLD'].includes(result.state))
   throw Error('ROOF_OPPORTUNITIES_RESULT_NOT_VERIFIED');
 return {...result,...holds()};
}
export function validateRoofingRecalculation(filters){
 if(!filters||typeof filters!=='object'||Array.isArray(filters)||
    Object.keys(filters).length!==7||
    Object.keys(filters).some(k=>!['zips','years','recentYears','minBuildingAge',
      'permitKind','peerYears','minPeers'].includes(k)))
   throw Error('ROOF_LOCATION_REFRESH_FILTER_SCHEMA');
 const {zips,years,recentYears,minBuildingAge,permitKind,peerYears,minPeers}=filters;
 if(typeof zips!=='string'||zips.length>60||
    !/^\d{5}(,\d{5}){0,9}$/.test(zips)||
    new Set(zips.split(',')).size!==zips.split(',').length||
    !Number.isSafeInteger(years)||years<10||years>50||
    !Number.isSafeInteger(recentYears)||recentYears<1||recentYears>10||
    recentYears>=years||
    !Number.isSafeInteger(minBuildingAge)||minBuildingAge<20||minBuildingAge>100||
    !Number.isSafeInteger(peerYears)||peerYears<0||peerYears>15||
    !Number.isSafeInteger(minPeers)||minPeers<3||minPeers>30||
    !['roof_related','replacement_like'].includes(permitKind))
   throw Error('ROOF_LOCATION_REFRESH_FILTER_VALIDATION_HOLD');
 return {zips,years,recentYears,minBuildingAge,permitKind,peerYears,minPeers};
}
export async function recalculateRoofingLocations(filters){
 const f=validateRoofingRecalculation(filters);
 if(locationRecalculationActive)throw Error('ROOF_LOCATION_REFRESH_ALREADY_RUNNING');
 if(active)throw Error('ROOF_LOCATION_REFRESH_BLOCKED_DURING_SOURCE_IMPORT');
 if(!ROOT||!DB||!existsSync(DB))throw Error('ROOF_LOCATION_REFRESH_LOCAL_DATABASE_REQUIRED');
 locationRecalculationActive=true;
 try{
  const args=[LOCATION_EXPORT_SCRIPT,'--db',DB,
   '--zips',f.zips,'--years',String(f.years),'--recent-years',String(f.recentYears),
   '--min-building-age',String(f.minBuildingAge),'--permit-kind',f.permitKind,
   '--peer-years',String(f.peerYears),'--min-peers',String(f.minPeers)];
  const {stdout}=await exec(python(),args,{
   windowsHide:true,timeout:120000,maxBuffer:8192,
   env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  if(!stdout.includes('ROOFING_LOCATION_REPORT=ROOFING_LOCATION_RESEARCH_READY')||
     !stdout.includes('REPORT_RECENT_PERMIT_LOCATIONS='))
   throw Error('ROOF_LOCATION_REFRESH_REPORT_NOT_COMPLETED');
  const result=await roofingOpportunities();
  if(result.state!=='READY_FROM_RECONCILED_LOCAL_V9_REPORTS'||
    result.filters.historical_x_years!==f.years||
    result.filters.recent_years!==f.recentYears||
    result.filters.min_building_age!==f.minBuildingAge||
    result.filters.permit_kind!==f.permitKind||
    result.filters.age_cohort_tolerance!==f.peerYears||
    result.filters.min_similar_age_neighbors!==f.minPeers||
    result.zips.length!==f.zips.split(',').length||
    !f.zips.split(',').every(z=>result.zips.some(x=>x.zip===z)))
    throw Error('ROOF_LOCATION_REFRESH_RECONCILIATION_HOLD');
  return {version:'fun-roofing-local-refresh-v11',
    state:'OPERATOR_CLICK_LOCAL_V9_REPORT_REFRESHED',
    report_snapshot:result.report_snapshot,totals:result.totals,
    noAutomaticImportOrOutreach:true,...holds()};
 }finally{locationRecalculationActive=false}
}
export async function bulkOverview(){
 let db;
 try{db=await bulkPython('status')}catch(e){db={version:BULK_VERSION,
   state:'WORKER_UNAVAILABLE',error:String(e.message||e).slice(0,200),
   counts:{properties:0,permits:0,candidates:0},source_runs:[]}}
 let selection;
 try{selection=await selectivePython('status')}catch(e){
  selection={version:SELECTIVE_VERSION,state:'WORKER_UNAVAILABLE',
    error:String(e.message||e).slice(0,180),selected:0,held:0,excluded:0};
 }
 return {...db,version:BULK_VERSION,sourceDirectory:ALLOWED_SOURCES,selection,
   counts:{...db.counts,candidates:(selection.selected||0)+(selection.held||0)},
   job:active?{source:active.source,pid:active.pid,state:'RUNNING',started:active.started}:latest,
   ...holds(),claimsAboutAllHomes:false,permitHistoryCoverageVerified:false};
}
const countyAllowed=new Set(['all','Los Angeles','San Bernardino']);
export async function bulkMarkets({county='all',city='',minAge=20,onlyNoPermit=false,includeUnclassified=true,detail=false}={}){
 if(!countyAllowed.has(county)||!Number.isInteger(minAge)||minAge<0||minAge>120||
    typeof city!=='string'||city.length>70||!/^[a-zA-Z0-9 \-']*$/.test(city)||
    typeof onlyNoPermit!=='boolean'||typeof includeUnclassified!=='boolean')
   throw Error('ROOF_BULK_FILTER_SCHEMA');
 const args=['--county',county,'--min-age',String(minAge)];
 if(city)args.push('--city',city);
 if(onlyNoPermit)args.push('--only-no-permit');
 if(includeUnclassified)args.push('--include-holds');
 const result=await selectivePython(detail?'candidates':'markets',args);
 return {...result,...holds()};
}
export function startBulkSync(sourceId){
 const source=ALLOWED_SOURCES.find(s=>s.id===sourceId);
 if(!source||source.mode!=='FULL_EXPORT_SYNC')throw Error('ROOF_BULK_SOURCE_NOT_AUTOMATABLE');
 if(active)throw Error('ROOF_BULK_ONE_SYNC_AT_A_TIME');
 if(locationRecalculationActive)throw Error('ROOF_BULK_SOURCE_SYNC_BLOCKED_DURING_LOCATION_REFRESH');
 if(!ROOT)throw Error('FUN_BULK_LOCALAPPDATA_NOT_CONFIGURED');
 mkdirSync(ROOT,{recursive:true});
 const logs=join(ROOT,'logs');mkdirSync(logs,{recursive:true});
 const now=new Date().toISOString().replace(/[:.]/g,'-');
 const output=join(logs,sourceId+'-'+now+'.stdout.log');
 const error=join(logs,sourceId+'-'+now+'.stderr.log');
 const out=openSync(output,'wx',0o600),err=openSync(error,'wx',0o600);
 let child;
 try{
  child=spawn(python(),['-u',SCRIPT,'--db',DB,'sync',sourceId,'--root',ROOT],
    {cwd:ROOT,stdio:['ignore',out,err],windowsHide:true,
     env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 }finally{closeSync(out);closeSync(err)}
 const started=new Date().toISOString();
 active={source:sourceId,pid:child.pid||null,started};
 latest={source:sourceId,pid:child.pid||null,state:'LAUNCHING',started,
   logs:{stdout:output,stderr:error}};
 child.on('error',e=>{
   latest={...latest,state:'FAILED_TO_LAUNCH',error:String(e.message).slice(0,170),
     ended:new Date().toISOString()};
   active=null;
 });
 child.on('exit',(code,signal)=>{
   latest={...latest,state:code===0?'COMPLETED_CHECK_SOURCE_STATUS':'FAILED_CHECK_LOGS',
     exitCode:code,signal,ended:new Date().toISOString()};
   active=null;
 });
 return {version:BULK_VERSION,state:'OPERATOR_SYNC_REQUESTED',source:sourceId,
   workerPid:child.pid||null,reportedComplete:false,sourceDataNotYetVerified:true,
   ...holds()};
}
