// RAEM-006: foreground, synthetic-only pipeline qualification.
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {evaluateSyntheticBalancedAdmission} from '../src/resource-aware/synthetic-admission-profile.mjs';
import {IncrementalCheckpointStore} from '../src/resource-aware/incremental-checkpoint.mjs';
import {processSyntheticIncrementalBatch} from '../src/resource-aware/incremental-pipeline.mjs';
const sample=(id,domain='alpha.example')=>({eventId:'synthetic_'+id,domain,category:'breach_report',published:'2026-11-12',source:'authorized-test',title:'Synthetic disclosure notice'});
const host=await sampleHost({sampleDelayMs:150});
const admission=evaluateSyntheticBalancedAdmission(host,process.memoryUsage().rss/(1024*1024));
console.log('RAEM_006_PRECHECK='+JSON.stringify({host,admission}));
if(admission.state!=='GRANT'){
 console.log('RAEM_006_RESULT=HOLD '+admission.reason);
 console.log('RAEM_006_END=NO_BACKGROUND_WORK_NO_AIL_NO_NETWORK_NO_SERVICE_CHANGES');
}else{
 const root=await mkdtemp(join(tmpdir(),'raem006-'));
 const cfg={root,source:'synthetic_pipeline',refreshHours:6};
 const options={maxProcessRssMiB:admission.grantedMiB,minimumHostFreeMiB:admission.runtimeFreeFloorMiB};
 try{
  const first=new IncrementalCheckpointStore(cfg);
  const one=await processSyntheticIncrementalBatch({store:first,cursor:1,events:[sample('a'),sample('b','beta.example'),sample('a')],nowMs:1000,operatorApproved:true,parserOptions:options});
  const early=await processSyntheticIncrementalBatch({store:first,cursor:2,events:[sample('c')],nowMs:2000,operatorApproved:true,parserOptions:options});
  const resumed=new IncrementalCheckpointStore(cfg);
  const two=await processSyntheticIncrementalBatch({store:resumed,cursor:2,events:[sample('b','beta.example'),sample('c')],nowMs:21601000,operatorApproved:true,parserOptions:options});
  const saved=await resumed.read();
  const raw=await readFile(join(root,'synthetic_pipeline.json'),'utf8');
  const passed=one.state==='PASS'&&one.accepted===2&&one.duplicates===1&&early.reason==='REFRESH_NOT_DUE'&&early.parsedRecords===0&&two.state==='PASS'&&two.accepted===1&&two.duplicates===1&&saved.cursor===2&&saved.processedTotal===3&&saved.duplicateTotal===2&&!raw.includes('synthetic_a')&&!raw.includes('Synthetic disclosure notice');
  console.log('RAEM_006_FIRST='+JSON.stringify(one));
  console.log('RAEM_006_EARLY='+JSON.stringify(early));
  console.log('RAEM_006_AFTER_REOPEN='+JSON.stringify(two));
  console.log('RAEM_006_CHECKPOINT='+JSON.stringify({cursor:saved.cursor,processedTotal:saved.processedTotal,duplicateTotal:saved.duplicateTotal,storedRecentHashes:saved.seen.length,rawIdentifiersStored:raw.includes('synthetic_a')}));
  console.log('RAEM_006_RESULT='+(passed?'PASS':one.state==='HOLD'||two.state==='HOLD'?'HOLD':'FAIL'));
  if(!passed&&one.state!=='HOLD'&&two.state!=='HOLD')process.exitCode=1;
 }finally{
  await rm(root,{recursive:true,force:true});
  console.log('RAEM_006_END=TEMP_CLEANUP_NO_AIL_NO_NETWORK_NO_BACKGROUND_WORK_NO_SERVICE_CHANGES');
 }
}
