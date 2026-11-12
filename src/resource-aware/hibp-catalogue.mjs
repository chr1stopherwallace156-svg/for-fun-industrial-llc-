// FUN_RAEM_008: bounded catalogue reconciliation, manual invocation only.
// No personal breach accounts, data dumps, network scheduler, or service control.
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,lstat,readFile,open,rename,unlink} from 'node:fs/promises';
import {dirname,join,isAbsolute,resolve} from 'node:path';
import os from 'node:os';

export const CATALOGUE_URL='https://haveibeenpwned.com/api/v3/breaches';
export const CATALOGUE_ATTRIBUTION='Have I Been Pwned — https://haveibeenpwned.com/';
const SCHEMA='fun.raem.hibp.catalogue.v1';
const MAX_BODY_BYTES=8*1024*1024;
const MAX_STATE_BYTES=1024*1024;
const MiB=1024*1024;
const HASH=/^[0-9a-f]{64}$/;
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
function validText(s,max){return typeof s==='string'&&s.length>0&&s.length<=max&&!/[\x00-\x1f\x7f]/.test(s);}
function validDate(s){
 return typeof s==='string'&&s.length<=50&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|\+00:00)$/.test(s)&&Number.isFinite(Date.parse(s));
}
function normalize(row){
 if(!plain(row)||!validText(row.Name,128)||!validText(row.Title,256)||
 !validDate(row.AddedDate)||!validDate(row.ModifiedDate)||
 Date.parse(row.ModifiedDate)<Date.parse(row.AddedDate))throw Error('RAEM008_BREACH_SCHEMA_INVALID');
 return {
  nameHash:hash('name\0'+row.Name),
  versionHash:hash('version\0'+row.Name+'\0'+row.ModifiedDate),
  displayTitle:row.Title,
  modifiedDate:row.ModifiedDate,
  addedDate:row.AddedDate
 };
}
export function reconcileCatalogue(currentRecords,oldPairs,{maxEntries=4096}={}){
 if(!int(maxEntries,1,4096)||!Array.isArray(currentRecords)||currentRecords.length>maxEntries||
 !Array.isArray(oldPairs)||oldPairs.length>maxEntries)throw Error('RAEM008_CATALOGUE_COUNT_INVALID');
 const previous=new Map();
 for(const item of oldPairs){
  if(!Array.isArray(item)||item.length!==2||!HASH.test(item[0])||!HASH.test(item[1])||previous.has(item[0]))
   throw Error('RAEM008_OLD_STATE_INVALID');
  previous.set(item[0],item[1]);
 }
 const current=new Map(),samples=[];
 let added=0,modified=0,unchanged=0;
 for(const row of currentRecords){
  const r=normalize(row);
  if(current.has(r.nameHash))throw Error('RAEM008_DUPLICATE_PROVIDER_NAME');
  current.set(r.nameHash,r.versionHash);
  if(!previous.has(r.nameHash)){
   added++;if(samples.length<5)samples.push({type:'added',title:r.displayTitle,addedDate:r.addedDate,modifiedDate:r.modifiedDate});
  }else if(previous.get(r.nameHash)!==r.versionHash){
   modified++;if(samples.length<5)samples.push({type:'modified',title:r.displayTitle,addedDate:r.addedDate,modifiedDate:r.modifiedDate});
  }else unchanged++;
 }
 let absent=0;for(const nameHash of previous.keys())if(!current.has(nameHash))absent++;
 return {pairs:[...current].sort((a,b)=>a[0].localeCompare(b[0])),count:current.size,
  added,modified,unchanged,absentFromLatestSnapshot:absent,samples};
}
function blank(){return {schema:SCHEMA,checkedAtMs:null,nextDueMs:0,records:[]};}
function validateState(x,maxEntries){
 if(!plain(x)||Object.keys(x).sort().join(',')!=='checkedAtMs,nextDueMs,records,schema'||
 x.schema!==SCHEMA||!(x.checkedAtMs===null||int(x.checkedAtMs,0,Number.MAX_SAFE_INTEGER))||
 !int(x.nextDueMs,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(x.records)||x.records.length>maxEntries)
  throw Error('RAEM008_CHECKPOINT_INVALID');
 const names=new Set();
 for(const pair of x.records){
  if(!Array.isArray(pair)||pair.length!==2||!HASH.test(pair[0])||!HASH.test(pair[1])||names.has(pair[0]))
   throw Error('RAEM008_CHECKPOINT_INVALID');
  names.add(pair[0]);
 }
 if(x.checkedAtMs===null && (x.records.length||x.nextDueMs!==0))
  throw Error('RAEM008_CHECKPOINT_INVALID');
 return x;
}
async function safeFile(path){
 try{const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink()||st.size>MAX_STATE_BYTES)throw Error('RAEM008_FILE_UNSAFE');return true;}
 catch(e){if(e?.code==='ENOENT')return false;throw e;}
}
export class CatalogueSnapshotStore{
 #root;#path;#lock;#refreshHours;#maxEntries;
 constructor({root,refreshHours=6,maxEntries=4096}={}){
  if(typeof root!=='string'||!isAbsolute(root)||resolve(root)!==root||
  !int(refreshHours,1,168)||!int(maxEntries,1,4096))throw Error('RAEM008_CONFIG_INVALID');
  this.#root=root;this.#path=join(root,'hibp_catalogue_snapshot.json');this.#lock=join(root,'hibp_catalogue_snapshot.lock');
  this.#refreshHours=refreshHours;this.#maxEntries=maxEntries;
 }
 async #ensureRoot(){
  const parent=dirname(this.#root);
  const p=await lstat(parent);
  if(!p.isDirectory()||p.isSymbolicLink())throw Error('RAEM008_PARENT_UNSAFE');
  try{const d=await lstat(this.#root);if(!d.isDirectory()||d.isSymbolicLink())throw Error('RAEM008_ROOT_UNSAFE');}
  catch(e){if(e?.code!=='ENOENT')throw e;await mkdir(this.#root,{recursive:false,mode:0o700});}
 }
 async read(){
  await this.#ensureRoot();
  if(!await safeFile(this.#path))return blank();
  let raw;try{raw=JSON.parse(await readFile(this.#path,'utf8'));}catch{throw Error('RAEM008_CHECKPOINT_INVALID');}
  return validateState(raw,this.#maxEntries);
 }
 async commitCatalogue(rows,{nowMs,operatorApproved=false}={}){
  if(operatorApproved!==true)return {state:'HOLD',reason:'OPERATOR_APPROVAL_REQUIRED'};
  if(!int(nowMs,0,Number.MAX_SAFE_INTEGER))throw Error('RAEM008_TIME_INVALID');
  await this.#ensureRoot();
  let lock;try{lock=await open(this.#lock,'wx',0o600);}
  catch(e){if(e?.code==='EEXIST')return {state:'HOLD',reason:'OPERATION_LOCKED'};throw e;}
  let tmp=null;
  try{
   const prior=await this.read();
   if(nowMs<prior.nextDueMs)return {state:'HOLD',reason:'REFRESH_NOT_DUE',nextDueMs:prior.nextDueMs};
   const diff=reconcileCatalogue(rows,prior.records,{maxEntries:this.#maxEntries});
   const nextDueMs=nowMs+this.#refreshHours*3600000;
   if(!int(nextDueMs,0,Number.MAX_SAFE_INTEGER))throw Error('RAEM008_TIME_INVALID');
   const next={schema:SCHEMA,checkedAtMs:nowMs,nextDueMs,records:diff.pairs};
   const encoded=JSON.stringify(next)+'\n';
   if(Buffer.byteLength(encoded)>MAX_STATE_BYTES)throw Error('RAEM008_STATE_TOO_LARGE');
   await safeFile(this.#path);
   tmp=this.#path+'.'+randomBytes(8).toString('hex')+'.tmp';
   const h=await open(tmp,'wx',0o600);
   try{await h.writeFile(encoded,'utf8');await h.sync();}finally{await h.close();}
   await rename(tmp,this.#path);tmp=null;
   return {state:'PASS',reason:prior.checkedAtMs===null?'CATALOGUE_BASELINED':'CATALOGUE_RECONCILED',
    baseline:prior.checkedAtMs===null,records:diff.count,
    newSincePriorBaseline:prior.checkedAtMs===null?0:diff.added,
    modifiedSincePriorBaseline:prior.checkedAtMs===null?0:diff.modified,
    unchanged:prior.checkedAtMs===null?0:diff.unchanged,
    absentFromLatestSnapshot:prior.checkedAtMs===null?0:diff.absentFromLatestSnapshot,
    samples:prior.checkedAtMs===null?[]:diff.samples,
    nextDueMs,attribution:CATALOGUE_ATTRIBUTION};
  }finally{
   if(tmp)await unlink(tmp).catch(()=>{});
   await lock.close();await unlink(this.#lock).catch(()=>{});
  }
 }
}
export async function readBoundedCatalogueResponse(response,{maxProcessRssMiB=128,minimumHostFreeMiB=0,maxEntries=4096}={}){
 if(!int(maxProcessRssMiB,16,8192)||!int(minimumHostFreeMiB,0,1048576)||!int(maxEntries,1,4096))throw Error('RAEM008_LIMIT_INVALID');
 if(!response||!int(response.status,100,599))throw Error('RAEM008_RESPONSE_INVALID');
 if(response.status!==200)return {state:'HOLD',reason:response.status===429?'PROVIDER_RATE_LIMITED':'PROVIDER_HTTP_'+response.status};
 if(response.redirected===true)return {state:'HOLD',reason:'PROVIDER_REDIRECT_DENIED'};
 const type=response.headers?.get?.('content-type')??'';
 if(!/^application\/json(?:\s*;|$)/i.test(type))return {state:'HOLD',reason:'PROVIDER_CONTENT_TYPE_INVALID'};
 const len=response.headers?.get?.('content-length');
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>MAX_BODY_BYTES))return {state:'HOLD',reason:'PROVIDER_RESPONSE_TOO_LARGE'};
 if(!response.body||typeof response.body.getReader!=='function')return {state:'HOLD',reason:'PROVIDER_EMPTY_BODY'};
 const reader=response.body.getReader(),parts=[];let total=0;
 try{
  while(true){
   if(process.memoryUsage().rss>maxProcessRssMiB*MiB||os.freemem()<minimumHostFreeMiB*MiB)
    return {state:'HOLD',reason:'RESOURCE_PRESSURE'};
   const {done,value}=await reader.read();if(done)break;
   if(!(value instanceof Uint8Array))return {state:'HOLD',reason:'PROVIDER_INVALID_CHUNK'};
   total+=value.byteLength;
   if(total>MAX_BODY_BYTES)return {state:'HOLD',reason:'PROVIDER_RESPONSE_TOO_LARGE'};
   parts.push(Buffer.from(value));
  }
 }catch{return {state:'HOLD',reason:'PROVIDER_STREAM_FAILED'};}
 finally{await reader.cancel().catch(()=>{});}
 let rows;
 try{rows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts,total)));}
 catch{return {state:'HOLD',reason:'PROVIDER_JSON_INVALID'};}
 if(!Array.isArray(rows)||rows.length>maxEntries)return {state:'HOLD',reason:'PROVIDER_CATALOGUE_COUNT_INVALID'};
 try{reconcileCatalogue(rows,[],{maxEntries});}
 catch{return {state:'HOLD',reason:'PROVIDER_SCHEMA_INVALID'};}
 return {state:'PASS',rows,receivedBytes:total};
}
export async function checkPublicCatalogue({
 store,nowMs=Date.now(),operatorApproved=false,fetchImpl=fetch,
 maxProcessRssMiB=128,minimumHostFreeMiB=0
}={}){
 if(!(store instanceof CatalogueSnapshotStore)||!int(nowMs,0,Number.MAX_SAFE_INTEGER)||
 typeof fetchImpl!=='function'||!int(maxProcessRssMiB,16,8192)||
 !int(minimumHostFreeMiB,0,1048576))throw Error('RAEM008_INPUT_INVALID');
 if(operatorApproved!==true)return {state:'HOLD',reason:'OPERATOR_APPROVAL_REQUIRED',networkRequests:0};
 const prior=await store.read();
 if(nowMs<prior.nextDueMs)return {state:'HOLD',reason:'REFRESH_NOT_DUE',nextDueMs:prior.nextDueMs,networkRequests:0};
 if(process.memoryUsage().rss>maxProcessRssMiB*MiB||os.freemem()<minimumHostFreeMiB*MiB)
  return {state:'HOLD',reason:'RESOURCE_PRESSURE',networkRequests:0};
 let response;
 try{response=await fetchImpl(CATALOGUE_URL,{method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{accept:'application/json','user-agent':'FunIndustrial-RAEM008/0.1 (public breach catalogue reconciliation)'}});}
 catch{return {state:'HOLD',reason:'PROVIDER_REQUEST_FAILED',networkRequests:1};}
 const checked=await readBoundedCatalogueResponse(response,{maxProcessRssMiB,minimumHostFreeMiB});
 if(checked.state!=='PASS')return {...checked,networkRequests:1};
 const saved=await store.commitCatalogue(checked.rows,{nowMs,operatorApproved:true});
 return {...saved,networkRequests:1,receivedBytes:checked.receivedBytes};
}
