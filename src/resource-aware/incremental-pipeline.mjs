// FUN_RAEM_006: bounded synthetic-only integration of RAEM-004 and RAEM-005.
// No live feeds, model calls, autonomous execution, or source-data retention.
import {IncrementalCheckpointStore} from './incremental-checkpoint.mjs';
import {analyzeIncidentStream} from './incident-stream.mjs';

const int=(x,low,high)=>Number.isSafeInteger(x)&&x>=low&&x<=high;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const syntheticId=/^synthetic_[a-zA-Z0-9_.:-]{1,80}$/;
const domain=/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.example$/;
const fields=['eventId','domain','category','published','source','title'];
const categories=new Set(['breach_report','ransomware_claim','exposure_notice','other']);

function validEvent(x){
 return plain(x)&&Object.keys(x).length===fields.length&&Object.keys(x).every(k=>fields.includes(k))&&
  typeof x.eventId==='string'&&syntheticId.test(x.eventId)&&
  typeof x.domain==='string'&&x.domain.length<=120&&domain.test(x.domain)&&!x.domain.includes('..')&&
  categories.has(x.category)&&typeof x.published==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.published)&&
  x.source==='authorized-test'&&typeof x.title==='string'&&x.title.length<=160;
}
export async function processSyntheticIncrementalBatch({store,cursor,events,nowMs,operatorApproved=false,parserOptions={}}={}){
 if(!(store instanceof IncrementalCheckpointStore)||!int(cursor,1,Number.MAX_SAFE_INTEGER)||
    !int(nowMs,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(events)||!int(events.length,1,64)||
    !events.every(validEvent)||!plain(parserOptions)||
    Object.keys(parserOptions).some(k=>!['maxProcessRssMiB','minimumHostFreeMiB','pauseMs','sampleEveryChunks'].includes(k)))
     throw Error('RAEM006_BATCH_INVALID');
 if(operatorApproved!==true)return {state:'HOLD',reason:'OPERATOR_APPROVAL_REQUIRED',parsedRecords:0,checkpointCommitted:false};
 // Check checkpoint before parsing to avoid needless work before next refresh.
 const current=await store.read();
 if(cursor<=current.cursor)return {state:'HOLD',reason:'CURSOR_REPLAY_OR_REGRESSION',parsedRecords:0,checkpointCommitted:false};
 if(nowMs<current.nextDueMs)return {state:'HOLD',reason:'REFRESH_NOT_DUE',parsedRecords:0,nextDueMs:current.nextDueMs,checkpointCommitted:false};
 // Batch is bounded to 64 synthetic records; stream individual serialized lines.
 async function* serializedRows(){
  for(const {domain,category,published,source,title} of events){
   yield Buffer.from(JSON.stringify({domain,category,published,source,title})+'\n','utf8');
  }
 }
 const report=await analyzeIncidentStream(serializedRows(),{
  allowDomains:['alpha.example','beta.example','gamma.example'],maxRecords:64,maxInputMiB:1,
  maxLineBytes:2048,chunkKiB:64,maxProcessRssMiB:128,minimumHostFreeMiB:0,
  sampleEveryChunks:1,pauseMs:0,...parserOptions
 });
 if(report.state!=='PASS')return {state:'HOLD',reason:report.reason,parsedRecords:report.records,checkpointCommitted:false};
 if(report.records!==events.length)return {state:'HOLD',reason:'RECORD_COUNT_MISMATCH',parsedRecords:report.records,checkpointCommitted:false};
 // Commit after validation; existing store rechecks due/cursor inside its exclusive lock.
 const checkpoint=await store.processBatch({cursor,events:events.map(({eventId,category})=>({eventId,category})),nowMs,operatorApproved:true});
 if(checkpoint.state!=='PASS')return {state:'HOLD',reason:checkpoint.reason,parsedRecords:report.records,checkpointCommitted:false};
 return {state:'PASS',reason:'VALIDATED_AND_CHECKPOINTED',parsedRecords:report.records,
  matchedRecords:report.matched,counts:report.counts,types:report.types,accepted:checkpoint.accepted,
  duplicates:checkpoint.duplicates,cursor:checkpoint.cursor,nextDueMs:checkpoint.nextDueMs,
  processedBytes:report.processedBytes,peakRssMiB:report.peakRssMiB,checkpointCommitted:true};
}
