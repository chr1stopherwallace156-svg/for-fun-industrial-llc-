// RAEM-007: single-request, manual HIBP public breach-metadata check.
// No account/email/domain lookups, leaked personal data, API keys, background timers,
// REA execution, model lifecycle control, or arbitrary URL inputs.
import {createHash} from 'node:crypto';
import os from 'node:os';
import {IncrementalCheckpointStore} from './incremental-checkpoint.mjs';

export const PUBLIC_FEED_URL='https://haveibeenpwned.com/api/v3/latestBreach';
export const SOURCE_ATTRIBUTION='Have I Been Pwned — https://haveibeenpwned.com/';
const MAX_RESPONSE_BYTES=65536,MiB=1024*1024;
const saneDate=s=>typeof s==='string'&&s.length<=40&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,7})?)?(?:Z|\+00:00)$/.test(s)&&Number.isFinite(Date.parse(s));
const cleanDomain=s=>typeof s==='string'&&s.length>3&&s.length<=200&&/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(s)&&s.includes('.')&&!s.includes('..');
const safeName=s=>typeof s==='string'&&s.length>=1&&s.length<=128&&/^[\w .-]+$/.test(s);
const safeTitle=s=>typeof s==='string'&&s.length>=1&&s.length<=200&&/^[^\x00-\x1f<>]+$/.test(s);
const validTime=n=>Number.isSafeInteger(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
export function normalizePublicBreach(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
  !safeName(payload.Name)||!safeTitle(payload.Title)||!cleanDomain(payload.Domain)||
  !saneDate(payload.AddedDate)||!saneDate(payload.ModifiedDate)||
  typeof payload.BreachDate!=='string'||!/^\d{4}-\d\d-\d\d$/.test(payload.BreachDate)||
  !Number.isSafeInteger(payload.PwnCount)||payload.PwnCount<0||
  typeof payload.IsVerified!=='boolean'||typeof payload.IsFabricated!=='boolean')throw Error('RAEM007_FEED_SCHEMA_INVALID');
 const eventHash=createHash('sha256').update(payload.Name+'\0'+payload.ModifiedDate,'utf8').digest('hex');
 return Object.freeze({
  eventId:'hibp_'+eventHash,
  category:'breach_report',
  name:payload.Name,title:payload.Title,domain:payload.Domain,
  breachDate:payload.BreachDate,addedDate:payload.AddedDate,modifiedDate:payload.ModifiedDate,
  reportedAffectedAccounts:payload.PwnCount,
  isVerified:payload.IsVerified,isFabricated:payload.IsFabricated,
  attribution:SOURCE_ATTRIBUTION
 });
}
export async function readLimitedPublicResponse(response,{maxProcessRssMiB=128,minimumHostFreeMiB=0}={}){
 if(!response||typeof response.status!=='number')throw Error('RAEM007_RESPONSE_INVALID');
 if(response.status!==200)return {state:'HOLD',reason:response.status===429?'PROVIDER_RATE_LIMITED':'PROVIDER_HTTP_'+response.status};
 const type=response.headers?.get?.('content-type')??'';
 if(!/^application\/json(?:\s*;|$)/i.test(type))return {state:'HOLD',reason:'PROVIDER_CONTENT_TYPE_INVALID'};
 const length=response.headers?.get?.('content-length');
 if(length!==null && ( !/^\d+$/.test(length)||Number(length)>MAX_RESPONSE_BYTES))return {state:'HOLD',reason:'PROVIDER_RESPONSE_TOO_LARGE'};
 if(!response.body||typeof response.body.getReader!=='function')return {state:'HOLD',reason:'PROVIDER_EMPTY_BODY'};
 const reader=response.body.getReader();
 let total=0;const chunks=[];
 try{
  while(true){
   if(process.memoryUsage().rss>maxProcessRssMiB*MiB||os.freemem()<minimumHostFreeMiB*MiB)
    return {state:'HOLD',reason:'RESOURCE_PRESSURE'};
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))return {state:'HOLD',reason:'PROVIDER_INVALID_CHUNK'};
   total+=value.byteLength;
   if(total>MAX_RESPONSE_BYTES)return {state:'HOLD',reason:'PROVIDER_RESPONSE_TOO_LARGE'};
   chunks.push(Buffer.from(value));
  }
 }finally{await reader.cancel().catch(()=>{});}
 let parsed;
 try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,total)));}
 catch{return {state:'HOLD',reason:'PROVIDER_JSON_INVALID'};}
 try{return {state:'PASS',breach:normalizePublicBreach(parsed),receivedBytes:total};}
 catch{return {state:'HOLD',reason:'PROVIDER_SCHEMA_INVALID'};}
}
export async function checkLatestPublicBreach({
 store,nowMs=Date.now(),operatorApproved=false,fetchImpl=fetch,
 maxProcessRssMiB=128,minimumHostFreeMiB=0
}={}){
 if(!(store instanceof IncrementalCheckpointStore)||!validTime(nowMs)||typeof fetchImpl!=='function'||
 !Number.isInteger(maxProcessRssMiB)||maxProcessRssMiB<16||maxProcessRssMiB>8192||
 !Number.isInteger(minimumHostFreeMiB)||minimumHostFreeMiB<0||minimumHostFreeMiB>1048576)throw Error('RAEM007_INPUT_INVALID');
 if(operatorApproved!==true)return {state:'HOLD',reason:'OPERATOR_APPROVAL_REQUIRED',networkRequests:0};
 const before=await store.read();
 if(nowMs<before.nextDueMs)return {state:'HOLD',reason:'REFRESH_NOT_DUE',nextDueMs:before.nextDueMs,networkRequests:0};
 if(process.memoryUsage().rss>maxProcessRssMiB*MiB||os.freemem()<minimumHostFreeMiB*MiB)
  return {state:'HOLD',reason:'RESOURCE_PRESSURE',networkRequests:0};
 let response;
 try{
  response=await fetchImpl(PUBLIC_FEED_URL,{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{'accept':'application/json','user-agent':'FunIndustrial-RAEM007/0.1 (public breach metadata monitor; github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-)'}
  });
 }catch{return {state:'HOLD',reason:'PROVIDER_REQUEST_FAILED',networkRequests:1};}
 const result=await readLimitedPublicResponse(response,{maxProcessRssMiB,minimumHostFreeMiB});
 if(result.state!=='PASS')return {...result,networkRequests:1};
 if(!validTime(before.cursor+1))return {state:'HOLD',reason:'CURSOR_LIMIT',networkRequests:1};
 const commit=await store.processBatch({cursor:before.cursor+1,events:[{eventId:result.breach.eventId,category:result.breach.category}],nowMs,operatorApproved:true});
 if(commit.state!=='PASS')return {state:'HOLD',reason:commit.reason,networkRequests:1,checkpointCommitted:false};
 const {eventId,category,...publicMetadata}=result.breach;
 return {state:'PASS',reason:'PUBLIC_METADATA_CHECKED',networkRequests:1,checkpointCommitted:true,
  newItems:commit.accepted,duplicates:commit.duplicates,nextDueMs:commit.nextDueMs,
  receivedBytes:result.receivedBytes,source:SOURCE_ATTRIBUTION,latest:publicMetadata};
}
