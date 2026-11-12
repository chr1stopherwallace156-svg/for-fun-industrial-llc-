import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {analyzeSynthetic,analyzeLocalFile} from '../src/resource-aware/bounded-stream.mjs';
const p={pauseMs:0,maxProcessRssMiB:1024,sampleEveryChunks:16,maxInputMiB:32};
test('32 MiB synthetic bytes digest matches a reference implementation', async()=>{
  const result=await analyzeSynthetic({totalMiB:32,...p});
  const chunk=Buffer.alloc(64*1024,0xa5);
  const sha=createHash('sha256');for(let i=0;i<32*16;i++)sha.update(chunk);
  assert.equal(result.state,'PASS');assert.equal(result.processedBytes,32*1024*1024);
  assert.equal(result.sha256,sha.digest('hex'));assert.ok(result.peakRssMiB<1024);
});
test('supports short final chunk, fixed-size streaming and exact digest',async()=>{
  const r=await analyzeSynthetic({totalMiB:3,chunkKiB:128,...p});
  assert.equal(r.state,'PASS');assert.equal(r.chunks,24);
});
test('observed RSS guard stops stream before accepting input when undersized',async()=>{
  const r=await analyzeSynthetic({totalMiB:8,...p,maxProcessRssMiB:16});
  assert.equal(r.state,'HOLD');assert.equal(r.reason,'PROCESS_RSS_LIMIT');assert.equal(r.processedBytes,0);
});
test('host reserve guard blocks work without allocating an input dataset',async()=>{
  const r=await analyzeSynthetic({totalMiB:8,...p,minimumHostFreeMiB:1048576});
  assert.equal(r.state,'HOLD');assert.equal(r.reason,'HOST_MEMORY_RESERVE');assert.equal(r.processedBytes,0);
});
test('rejects malformed settings and unbounded requested inputs',async()=>{
  await assert.rejects(analyzeSynthetic({totalMiB:12,maxInputMiB:4}),/INPUT_TOO_LARGE/);
  await assert.rejects(analyzeSynthetic({totalMiB:12,chunkKiB:500}),/OPTIONS_INVALID/);
  await assert.rejects(analyzeSynthetic({totalMiB:0}),/SIZE_INVALID/);
  await assert.rejects(analyzeSynthetic({totalMiB:2,operatorApproved:true}),/OPTIONS_INVALID/);
});
test('local file is read-only and hashed using limited buffer',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'raem-002-'));
  try{const path=join(dir,'data.bin');const data=Buffer.from('Authorized synthetic evidence.');await writeFile(path,data);
    const r=await analyzeLocalFile(path,p);assert.equal(r.state,'PASS');assert.equal(r.processedBytes,data.length);assert.equal(r.sha256,createHash('sha256').update(data).digest('hex'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('refuses relative paths and oversized files',async()=>{
  await assert.rejects(analyzeLocalFile('./relative.txt',p),/ABSOLUTE/);
  const dir=await mkdtemp(join(tmpdir(),'raem-002-'));try{const path=join(dir,'over.bin');await writeFile(path,Buffer.alloc(2*1024*1024));
    await assert.rejects(analyzeLocalFile(path,{...p,maxInputMiB:1,chunkKiB:64}),/RAEM_FILE_TOO_LARGE/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects symbolic link targets where supported',async(t)=>{
  const dir=await mkdtemp(join(tmpdir(),'raem-002-'));try{const original=join(dir,'original.bin'),link=join(dir,'link.bin');await writeFile(original,Buffer.from('safe'));
    try{await symlink(original,link);}catch{t.skip('Symlink creation unavailable');return;}
    await assert.rejects(analyzeLocalFile(link,p),/FILE_TYPE_DENIED/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
