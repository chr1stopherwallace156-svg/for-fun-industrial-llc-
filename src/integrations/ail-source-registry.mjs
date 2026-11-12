// RAEM-013: immutable in-process allowlist for approved LOCAL AIL-shaped metadata exports.
// Never accepts a remote URL or writes a source registry to disk.
import {isAbsolute,resolve,extname} from 'node:path';
import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeAilMetadataFile} from './ail-ndjson.mjs';

const HASH=/^[a-f0-9]{64}$/;
const SOURCE_ID=/^[a-z][a-z0-9_-]{2,47}$/;
const MAX_BYTES=4*1024*1024;
const validPath=p=>typeof p==='string'&&isAbsolute(p)&&resolve(p)===p&&!p.startsWith('\\\\')&&extname(p).toLowerCase()==='.jsonl';
export function validateAilSource(source){
 if(!source||typeof source!=='object'||Array.isArray(source)||
  Object.keys(source).sort().join(',')!=='expectedSha256,id,path'||
  !SOURCE_ID.test(source.id)||!validPath(source.path)||!HASH.test(source.expectedSha256))
  throw Error('RAEM013_SOURCE_INVALID');
 return Object.freeze({id:source.id,path:source.path,expectedSha256:source.expectedSha256});
}
export class LocalAilSourceRegistry{
 #sources=new Map();
 register(source){
  const entry=validateAilSource(source);
  if(this.#sources.has(entry.id)||[...this.#sources.values()].some(s=>s.path===entry.path))throw Error('RAEM013_SOURCE_DUPLICATE');
  this.#sources.set(entry.id,entry);
  return entry.id;
 }
 list(){return [...this.#sources.keys()].sort();}
 async inspect(id,{operatorApproved=false,maxProcessRssMiB=128,minimumHostFreeMiB=0}={}){
  const entry=this.#sources.get(id);
  if(!entry)return {state:'HOLD',reason:'SOURCE_NOT_REGISTERED'};
  if(operatorApproved!==true)return {state:'HOLD',reason:'OPERATOR_APPROVAL_REQUIRED'};
  let st;
  try{st=await lstat(entry.path);}catch{return {state:'HOLD',reason:'SOURCE_UNAVAILABLE'};}
  if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>MAX_BYTES)return {state:'HOLD',reason:'SOURCE_UNSAFE'};
  let handle;
  try{
   handle=await open(entry.path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
   const info=await handle.stat();
   if(!info.isFile()||info.size!==st.size)return {state:'HOLD',reason:'SOURCE_CHANGED'};
   const digest=createHash('sha256');const buf=Buffer.allocUnsafe(16*1024);let position=0;
   while(position<info.size){
    const {bytesRead}=await handle.read(buf,0,Math.min(buf.length,info.size-position),position);
    if(!bytesRead)return {state:'HOLD',reason:'SOURCE_CHANGED'};
    digest.update(buf.subarray(0,bytesRead));position+=bytesRead;
   }
   if(digest.digest('hex')!==entry.expectedSha256)return {state:'HOLD',reason:'SOURCE_HASH_MISMATCH'};
  }catch{return {state:'HOLD',reason:'SOURCE_UNAVAILABLE'};}
  finally{if(handle)await handle.close();}
  // The RAEM-012 parser independently reopens the file. Trusted, non-shared files only;
  // this hash pin does not eliminate a concurrent file-replacement race.
  const result=await analyzeAilMetadataFile(entry.path,{maxProcessRssMiB,minimumHostFreeMiB});
  if(result.state!=='PASS')return {state:'HOLD',reason:result.reason};
  if(result.sha256!==entry.expectedSha256)return {state:'HOLD',reason:'SOURCE_CHANGED_DURING_PARSE'};
  return {state:'PASS',sourceId:entry.id,records:result.records,unique:result.unique,
   duplicates:result.duplicates,processedBytes:result.processedBytes,
   peakRssMiB:result.peakRssMiB,tagNamespaceCounts:result.tagNamespaceCounts,
   monthCounts:result.monthCounts,sha256:result.sha256,source:'LOCAL_AIL_METADATA_EXPORT'};
 }
}
