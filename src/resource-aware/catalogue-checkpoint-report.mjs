// RAEM-010: read-only structural checkpoint report; never creates directories or contacts a provider.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';

const SCHEMA='fun.raem.hibp.catalogue.v1';
const CHECKPOINT_FILE='hibp_catalogue_snapshot.json';
const MAX_BYTES=1024*1024;
const MAX_ENTRIES=4096;
const REFRESH_MS=6*60*60*1000;
const HEX=/^[a-f0-9]{64}$/;
const validTime=n=>Number.isSafeInteger(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const exactKeys=(o,keys)=>Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));

export function validateCatalogueCheckpoint(input){
 if(!plain(input)||!exactKeys(input,['schema','checkedAtMs','nextDueMs','records'])||
    input.schema!==SCHEMA||!validTime(input.checkedAtMs)||!validTime(input.nextDueMs)||
    input.nextDueMs-input.checkedAtMs!==REFRESH_MS||
    !Array.isArray(input.records)||input.records.length>MAX_ENTRIES)
  throw Error('RAEM010_CHECKPOINT_INVALID');
 const names=new Set();
 for(const entry of input.records){
  if(!Array.isArray(entry)||entry.length!==2||!HEX.test(entry[0])||!HEX.test(entry[1])||names.has(entry[0]))
   throw Error('RAEM010_CHECKPOINT_INVALID');
  names.add(entry[0]);
 }
 return Object.freeze({checkedAtMs:input.checkedAtMs,nextDueMs:input.nextDueMs,recordCount:input.records.length});
}

export function describeCatalogueCheckpoint(state,nowMs){
 if(!plain(state)||!validTime(state.checkedAtMs)||!validTime(state.nextDueMs)||
    !Number.isSafeInteger(state.recordCount)||state.recordCount<0||!validTime(nowMs))
  throw Error('RAEM010_REPORT_INVALID');
 const remainingMs=Math.max(0,state.nextDueMs-nowMs);
 return Object.freeze({
  state:'PRESENT',integrity:'STRUCTURALLY_VALID',baselineRecordCount:state.recordCount,
  lastSuccessfulCheckIso:new Date(state.checkedAtMs).toISOString(),
  nextEligibleCheckIso:new Date(state.nextDueMs).toISOString(),
  eligibleNow:remainingMs===0,remainingMs,
  note:'Structural validation and a digest do not authenticate the original provider or rule out tampering.'
 });
}

async function safeDirectory(dir){
 try{const s=await lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())return false;return true;}
 catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export async function inspectCatalogueCheckpoint(root,{nowMs=Date.now()}={}){
 if(typeof root!=='string'||!isAbsolute(root)||resolve(root)!==root||!validTime(nowMs))
  throw Error('RAEM010_INPUT_INVALID');
 // A path inspection is read-only: no mkdir, open for write, network access, or state mutation.
 const parent=await safeDirectory(dirname(root));
 if(parent!==true)return {state:'HOLD',reason:parent===null?'CHECKPOINT_PARENT_MISSING':'CHECKPOINT_PARENT_UNSAFE'};
 const dir=await safeDirectory(root);
 if(dir!==true)return {state:dir===null?'MISSING':'HOLD',reason:dir===null?'CHECKPOINT_NOT_FOUND':'CHECKPOINT_DIRECTORY_UNSAFE'};
 const file=join(root,CHECKPOINT_FILE);
 let st;
 try{st=await lstat(file);}
 catch(e){if(e.code==='ENOENT')return {state:'MISSING',reason:'CHECKPOINT_NOT_FOUND'};throw e;}
 if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>MAX_BYTES)
  return {state:'HOLD',reason:'CHECKPOINT_FILE_UNSAFE'};
 let handle;
 try{
  handle=await open(file,constants.O_RDONLY | (constants.O_NOFOLLOW||0));
  const info=await handle.stat();
  if(!info.isFile()||info.size<=0||info.size>MAX_BYTES)
   return {state:'HOLD',reason:'CHECKPOINT_FILE_UNSAFE'};
  const raw=await handle.readFile();
  if(raw.byteLength!==info.size)return {state:'HOLD',reason:'CHECKPOINT_CHANGED_DURING_READ'};
  const sha256=createHash('sha256').update(raw).digest('hex');
  let content,validated;
  try{content=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));validated=validateCatalogueCheckpoint(content);}
  catch{return {state:'HOLD',reason:'CHECKPOINT_INVALID'};}
  return {...describeCatalogueCheckpoint(validated,nowMs),checkpointSha256:sha256,sourceFile:CHECKPOINT_FILE};
 }catch(e){if(e.code==='ELOOP')return {state:'HOLD',reason:'CHECKPOINT_FILE_UNSAFE'};throw e;}
 finally{if(handle)await handle.close();}
}
