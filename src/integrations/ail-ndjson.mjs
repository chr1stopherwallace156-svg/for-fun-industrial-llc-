// RAEM-012: bounded read-only local AIL item-metadata JSONL aggregation.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import os from 'node:os';
import {normalizeAilMetadata} from './ail-metadata.mjs';
const MiB=1024*1024;
const MAX_BYTES=4*MiB,MAX_LINE_BYTES=8192,MAX_RECORDS=512;
const int=(x,low,high)=>Number.isSafeInteger(x)&&x>=low&&x<=high;
const memory=()=>Number((process.memoryUsage().rss/MiB).toFixed(2));
const homeFree=()=>Math.floor(os.freemem()/MiB);

export async function analyzeAilMetadataFile(file,{maxProcessRssMiB=128,minimumHostFreeMiB=0}={}){
 if(typeof file!=='string'||!isAbsolute(file)||resolve(file)!==file||file.startsWith('\\\\')||
  !int(maxProcessRssMiB,16,8192)||!int(minimumHostFreeMiB,0,1048576))throw Error('RAEM012_INPUT_INVALID');
 const st=await lstat(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size===0||st.size>MAX_BYTES)throw Error('RAEM012_FILE_UNSAFE');
 const sha=createHash('sha256'),seen=new Set(),namespaces=Object.create(null),months=Object.create(null);
 let records=0,unique=0,duplicates=0,bytes=0,peakRssMiB=memory(),carry=Buffer.alloc(0),chunks=0;
 const check=()=>{const rss=memory();peakRssMiB=Math.max(peakRssMiB,rss);if(rss>maxProcessRssMiB)return 'PROCESS_RSS_LIMIT';if(homeFree()<minimumHostFreeMiB)return 'HOST_MEMORY_RESERVE';return null;};
 const outcome=(state,reason)=>({state,reason,records,unique,duplicates,processedBytes:bytes,peakRssMiB,
  tagNamespaceCounts:{...namespaces},monthCounts:{...months},sha256:state==='PASS'?sha.digest('hex'):null});
 const handleLine=(line)=>{
  if(line.length===0)return null;
  if(++records>MAX_RECORDS)return 'RECORD_BUDGET_EXCEEDED';
  let row;
  try{row=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(line));}catch{return 'INVALID_JSON_OR_UTF8';}
  let normalized;
  try{normalized=normalizeAilMetadata(row);}catch{return 'METADATA_SCHEMA_INVALID';}
  if(seen.has(normalized.fingerprint)){duplicates++;return null;}
  seen.add(normalized.fingerprint);unique++;
  for(const [key,value] of Object.entries(normalized.tagNamespaces))namespaces[key]=(namespaces[key]||0)+value;
  months[normalized.month]=(months[normalized.month]||0)+1;
  return null;
 };
 let hold=check();if(hold)return outcome('HOLD',hold);
 const stream=createReadStream(file,{highWaterMark:16*1024,autoClose:true});
 try{
  for await(const chunk of stream){
   if(!Buffer.isBuffer(chunk))throw Error('RAEM012_INVALID_CHUNK');
   if(bytes+chunk.length>MAX_BYTES)return outcome('HOLD','INPUT_BUDGET_EXCEEDED');
   bytes+=chunk.length;sha.update(chunk);chunks++;
   let index=0,breakAt;
   while((breakAt=chunk.indexOf(10,index))!==-1){
    const fragment=chunk.subarray(index,breakAt);
    if(carry.length+fragment.length>MAX_LINE_BYTES)return outcome('HOLD','LINE_BUDGET_EXCEEDED');
    const line=carry.length?Buffer.concat([carry,fragment]):fragment;
    carry=Buffer.alloc(0);
    hold=handleLine(line);if(hold)return outcome('HOLD',hold);
    index=breakAt+1;
   }
   const tail=chunk.subarray(index);
   if(carry.length+tail.length>MAX_LINE_BYTES)return outcome('HOLD','LINE_BUDGET_EXCEEDED');
   if(tail.length)carry=carry.length?Buffer.concat([carry,tail]):Buffer.from(tail);
   if(chunks%4===0){hold=check();if(hold)return outcome('HOLD',hold);}
  }
  if(carry.length){hold=handleLine(carry);if(hold)return outcome('HOLD',hold);}
  hold=check();if(hold)return outcome('HOLD',hold);
  return outcome('PASS','COMPLETE');
 }finally{stream.destroy();}
}
