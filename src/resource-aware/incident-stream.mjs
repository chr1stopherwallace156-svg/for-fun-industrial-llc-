// FUN_RAEM_004: read-only, bounded NDJSON incident-record analysis.
// No network, persistence, OS process control, or collection of leaked data.
import {createHash} from 'node:crypto';
import os from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';

const MiB = 1024 * 1024;
const categories = Object.freeze(['breach_report', 'ransomware_claim', 'exposure_notice', 'other']);
const integer = (x, a, b) => Number.isSafeInteger(x) && x >= a && x <= b;
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const legalDomain = s => typeof s === 'string' && s.length >= 4 && s.length <= 120 && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(s) && s.includes('.') && !s.includes('..');
const decoded = new TextDecoder('utf-8', {fatal:true});
const nowRss = () => Number((process.memoryUsage().rss / MiB).toFixed(2));
const freeMiB = () => Math.floor(os.freemem() / MiB);

export function validateIncidentPolicy(input={}) {
  if (!plain(input) || Object.keys(input).some(k => !['allowDomains','maxInputMiB','maxRecords','maxLineBytes','chunkKiB','maxProcessRssMiB','minimumHostFreeMiB','sampleEveryChunks','pauseMs'].includes(k))) throw Error('RAEM004_POLICY_INVALID');
  const p = {allowDomains:['alpha.example'],maxInputMiB:256,maxRecords:2000000,maxLineBytes:2048,chunkKiB:64,maxProcessRssMiB:128,minimumHostFreeMiB:0,sampleEveryChunks:32,pauseMs:1,...input};
  if (!Array.isArray(p.allowDomains) || !integer(p.allowDomains.length,1,32) || !p.allowDomains.every(legalDomain) || new Set(p.allowDomains).size !== p.allowDomains.length ||
      !integer(p.maxInputMiB,1,8192) || !integer(p.maxRecords,1,50000000) || !integer(p.maxLineBytes,64,8192) || !integer(p.chunkKiB,4,256) ||
      !integer(p.maxProcessRssMiB,16,8192) || !integer(p.minimumHostFreeMiB,0,1048576) || !integer(p.sampleEveryChunks,1,1024) || !integer(p.pauseMs,0,100)) throw Error('RAEM004_POLICY_INVALID');
  return Object.freeze({...p,allowDomains:Object.freeze([...p.allowDomains])});
}

export async function analyzeIncidentStream(chunks, input={}) {
  const p=validateIncidentPolicy(input);
  if (!chunks || typeof chunks[Symbol.asyncIterator] !== 'function') throw Error('RAEM004_STREAM_REQUIRED');
  const start=performance.now(), sha=createHash('sha256');
  let bytes=0,records=0,matched=0,chunkCount=0,carry=[],carryLength=0,peakRssMiB=nowRss();
  const counts=Object.fromEntries(p.allowDomains.map(d=>[d,0]));
  const types=Object.fromEntries(categories.map(c=>[c,0]));
  const output=(state,reason)=>({state,reason,processedBytes:bytes,records,matched,counts:{...counts},types:{...types},chunks:chunkCount,peakRssMiB,elapsedMs:Math.round(performance.now()-start),sha256:state==='PASS'?sha.digest('hex'):null});
  const pressure=()=>{
    const rss=nowRss();peakRssMiB=Math.max(rss,peakRssMiB);
    if (rss>p.maxProcessRssMiB) return 'PROCESS_RSS_LIMIT';
    if (freeMiB()<p.minimumHostFreeMiB) return 'HOST_MEMORY_RESERVE';
    return null;
  };
  const append=(part)=>{
    if(carryLength+part.length>p.maxLineBytes)return false;
    if(part.length){carry.push(part);carryLength+=part.length;}
    return true;
  };
  const processLine=()=>{
    const line=carry.length===1?carry[0]:Buffer.concat(carry,carryLength);
    carry=[];carryLength=0;
    if(line.length===0)return null;
    if(records>=p.maxRecords)return 'RECORD_BUDGET_EXCEEDED';
    let row;
    try{row=JSON.parse(decoded.decode(line));}catch{return 'INVALID_JSON_OR_UTF8';}
    if(!plain(row) || Object.keys(row).some(k=>!['domain','category','published','source','title'].includes(k)) ||
       !legalDomain(row.domain) || !categories.includes(row.category) ||
       typeof row.published!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.published) ||
       typeof row.source!=='string' || !['public-report','authorized-test'].includes(row.source) ||
       typeof row.title!=='string' || row.title.length>160) return 'RECORD_SCHEMA_INVALID';
    records++;
    if(Object.hasOwn(counts,row.domain)){matched++;counts[row.domain]++;types[row.category]++;}
    return null;
  };
  let fail=pressure();if(fail)return output('HOLD',fail);
  for await(const chunk of chunks){
    if(!Buffer.isBuffer(chunk) || chunk.length>p.chunkKiB*1024)throw Error('RAEM004_CHUNK_INVALID');
    if(bytes+chunk.length>p.maxInputMiB*MiB)return output('HOLD','INPUT_BUDGET_EXCEEDED');
    bytes+=chunk.length;sha.update(chunk);chunkCount++;
    let offset=0, pos;
    while((pos=chunk.indexOf(10,offset))!==-1){
      if(!append(chunk.subarray(offset,pos)))return output('HOLD','LINE_BUDGET_EXCEEDED');
      fail=processLine();if(fail)return output('HOLD',fail);
      offset=pos+1;
    }
    if(!append(chunk.subarray(offset)))return output('HOLD','LINE_BUDGET_EXCEEDED');
    if(chunkCount%p.sampleEveryChunks===0){
      fail=pressure();if(fail)return output('HOLD',fail);
      if(p.pauseMs)await sleep(p.pauseMs);
    }
  }
  if(carryLength){fail=processLine();if(fail)return output('HOLD',fail);}
  fail=pressure();if(fail)return output('HOLD',fail);
  return output('PASS','COMPLETE');
}

// Deterministic synthetic records only. No file downloads, no generated PII.
export async function analyzeSyntheticIncidents({totalMiB=16,...input}={}){
  if(!integer(totalMiB,1,8192))throw Error('RAEM004_SYNTHETIC_SIZE_INVALID');
  const p=validateIncidentPolicy({...input,maxInputMiB:input.maxInputMiB??totalMiB});
  if(totalMiB>p.maxInputMiB)throw Error('RAEM004_SYNTHETIC_INPUT_TOO_LARGE');
  const lines=[
    {domain:'alpha.example',category:'breach_report',published:'2026-10-01',source:'authorized-test',title:'Synthetic public incident notice'},
    {domain:'beta.example',category:'exposure_notice',published:'2026-10-02',source:'authorized-test',title:'Synthetic exposure summary'},
    {domain:'alpha.example',category:'ransomware_claim',published:'2026-10-03',source:'authorized-test',title:'Synthetic claim to verify'},
    {domain:'gamma.example',category:'other',published:'2026-10-04',source:'authorized-test',title:'Synthetic unrelated report'}
  ];
  const pattern=lines.map(x=>JSON.stringify(x)+'\n').join('');
  const repetitions=Math.floor(p.chunkKiB*1024/Buffer.byteLength(pattern));
  if(repetitions<1)throw Error('RAEM004_PATTERN_TOO_LARGE');
  const block=Buffer.from(pattern.repeat(repetitions));
  async function* make(){
    let remaining=totalMiB*MiB;
    while(remaining>=block.length){yield block;remaining-=block.length;}
    const fullReps=Math.floor(remaining/Buffer.byteLength(pattern));
    if(fullReps)yield Buffer.from(pattern.repeat(fullReps));
  }
  return analyzeIncidentStream(make(),p);
}
