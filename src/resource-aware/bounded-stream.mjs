// FUN_RAEM_002: bounded read-only stream inspection. No services, network or filesystem writes.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import os from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const MiB = 1024 * 1024;
const int = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
function options(input = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw Error('RAEM_STREAM_OPTIONS_INVALID');
  const keys = ['chunkKiB', 'maxProcessRssMiB', 'minimumHostFreeMiB', 'sampleEveryChunks', 'pauseMs', 'maxInputMiB'];
  if (Object.keys(input).some(k => !keys.includes(k))) throw Error('RAEM_STREAM_OPTIONS_INVALID');
  const p = { chunkKiB: 64, maxProcessRssMiB: 128, minimumHostFreeMiB: 0, sampleEveryChunks: 16, pauseMs: 1, maxInputMiB: 2048, ...input };
  if (!int(p.chunkKiB, 4, 256) || !int(p.maxProcessRssMiB, 16, 8192) || !int(p.minimumHostFreeMiB, 0, 1048576) || !int(p.sampleEveryChunks, 1, 1024) || !int(p.pauseMs, 0, 100) || !int(p.maxInputMiB, 1, 8192)) throw Error('RAEM_STREAM_OPTIONS_INVALID');
  return Object.freeze(p);
}
const rssMiB = () => Number((process.memoryUsage().rss / MiB).toFixed(2));
const freeMiB = () => Math.floor(os.freemem() / MiB);

async function consume(source, p, {signal} = {}) {
  const start = performance.now();
  const sha = createHash('sha256');
  let bytes = 0, chunks = 0, peakRssMiB = rssMiB();
  // This is an observational guard, NOT a hard OS-level memory limit.
  const check = () => {
    const rss = rssMiB();
    peakRssMiB = Math.max(peakRssMiB, rss);
    if (rss > p.maxProcessRssMiB) return 'PROCESS_RSS_LIMIT';
    if (freeMiB() < p.minimumHostFreeMiB) return 'HOST_MEMORY_RESERVE';
    return null;
  };
  const held = (reason) => ({state:'HOLD',reason,processedBytes:bytes,chunks,peakRssMiB,elapsedMs:Math.round(performance.now()-start),sha256:null});
  let reason = check();
  if (reason) return held(reason);
  for await (const chunk of source) {
    if (signal?.aborted) return held('ABORTED');
    if (!Buffer.isBuffer(chunk)) throw Error('RAEM_STREAM_INVALID_CHUNK');
    if (bytes + chunk.length > p.maxInputMiB*MiB) return held('INPUT_BUDGET_EXCEEDED');
    sha.update(chunk);bytes += chunk.length;chunks++;
    if (chunks % p.sampleEveryChunks === 0) {
      reason = check();
      if (reason) return held(reason);
      if (p.pauseMs) await sleep(p.pauseMs);
    }
  }
  reason = check();
  if (reason) return held(reason);
  return {state:'PASS',reason:'COMPLETE',processedBytes:bytes,chunks,peakRssMiB,elapsedMs:Math.round(performance.now()-start),sha256:sha.digest('hex')};
}

export async function analyzeSynthetic({totalMiB=64, ...rest}={}) {
  if (!int(totalMiB,1,8192)) throw Error('RAEM_SYNTHETIC_SIZE_INVALID');
  const p = options(rest);
  if (totalMiB > p.maxInputMiB) throw Error('RAEM_SYNTHETIC_INPUT_TOO_LARGE');
  const block = Buffer.alloc(p.chunkKiB*1024, 0xa5);
  async function* generate() {
    let remaining=totalMiB*MiB;
    while(remaining>0){const n=Math.min(remaining,block.length);yield block.subarray(0,n);remaining-=n;}
  }
  return consume(generate(),p);
}

export async function analyzeLocalFile(filePath, input={}) {
  if (typeof filePath!=='string'||!isAbsolute(filePath)) throw Error('RAEM_FILE_ABSOLUTE_PATH_REQUIRED');
  const p=options(input);
  const info=await lstat(filePath);
  if(!info.isFile()||info.isSymbolicLink()) throw Error('RAEM_FILE_TYPE_DENIED');
  if(info.size>p.maxInputMiB*MiB) throw Error('RAEM_FILE_TOO_LARGE');
  const stream=createReadStream(filePath,{highWaterMark:p.chunkKiB*1024,autoClose:true});
  try {return await consume(stream,p);} finally {stream.destroy();}
}
