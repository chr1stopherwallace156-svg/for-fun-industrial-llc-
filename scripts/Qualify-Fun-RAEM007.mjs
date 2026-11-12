// RAEM-007: offline HIBP-shaped public metadata qualification.
// All provider responses are mocked. NO live network request is made.
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {evaluateAdmission} from '../src/resource-aware/raem.mjs';
import {chooseAdaptiveIncidentBudget} from '../src/resource-aware/adaptive-incident-budget.mjs';
import {IncrementalCheckpointStore} from '../src/resource-aware/incremental-checkpoint.mjs';
import {checkLatestPublicBreach,PUBLIC_FEED_URL} from '../src/resource-aware/hibp-public-feed.mjs';

const host=await sampleHost({sampleDelayMs:150});
const upstream=evaluateAdmission(host,{id:'raem_hibp_public_demo',minimumMiB:64,targetMiB:128,maximumMiB:128,refreshHours:6});
const admission=chooseAdaptiveIncidentBudget(upstream,process.memoryUsage().rss/(1024*1024));
console.log('RAEM_007_PRECHECK='+JSON.stringify({host,admission}));
if(admission.state!=='GRANT'){
 console.log('RAEM_007_RESULT=HOLD '+admission.reason);
 console.log('RAEM_007_END=NO_LIVE_NETWORK_NO_BACKGROUND_JOBS_NO_SERVICE_CHANGES');
}else{
 const root=await mkdtemp(join(tmpdir(),'raem007-offline-'));
 const store=new IncrementalCheckpointStore({root,source:'hibp_public_latest',refreshHours:6,maxRecent:256});
 let mockedCalls=0;
 const example={
  Name:'ExampleBreach2026',Title:'Example Security Notice',Domain:'example.com',
  BreachDate:'2026-10-01',AddedDate:'2026-11-11T12:10:00Z',
  ModifiedDate:'2026-11-11T12:10:00Z',PwnCount:1200,
  IsVerified:true,IsFabricated:false
 };
 const fetchImpl=async url=>{
  if(url!==PUBLIC_FEED_URL)throw Error('UNKNOWN_SOURCE_DENIED');
  mockedCalls++;
  return new Response(JSON.stringify(example),{status:200,headers:{'content-type':'application/json'}});
 };
 const config={store,operatorApproved:true,fetchImpl,
  maxProcessRssMiB:admission.grantedMiB,minimumHostFreeMiB:admission.reserveMiB+8};
 try{
  const first=await checkLatestPublicBreach({...config,nowMs:1000});
  console.log('RAEM_007_FIRST='+JSON.stringify(first));
  if(first.state==='HOLD'){
   console.log('RAEM_007_RESULT=HOLD '+first.reason);
  }else{
   const early=await checkLatestPublicBreach({...config,nowMs:2000});
   const reopened=new IncrementalCheckpointStore({root,source:'hibp_public_latest',refreshHours:6,maxRecent:256});
   const next=await checkLatestPublicBreach({...config,store:reopened,nowMs:21601000});
   const checkpoint=await reopened.read();
   const onDisk=await readFile(join(root,'hibp_public_latest.json'),'utf8');
   const pass=first.state==='PASS'&&first.newItems===1&&early.reason==='REFRESH_NOT_DUE'&&early.networkRequests===0&&
    next.state==='PASS'&&next.newItems===0&&next.duplicates===1&&mockedCalls===2&&
    checkpoint.cursor===2&&checkpoint.processedTotal===1&&!onDisk.includes('ExampleBreach2026');
   console.log('RAEM_007_EARLY='+JSON.stringify(early));
   console.log('RAEM_007_AFTER_REOPEN='+JSON.stringify(next));
   console.log('RAEM_007_CHECKPOINT='+JSON.stringify({cursor:checkpoint.cursor,
    processedTotal:checkpoint.processedTotal,duplicateTotal:checkpoint.duplicateTotal,
    storedRecentHashes:checkpoint.seen.length,rawProviderNameStored:onDisk.includes('ExampleBreach2026')}));
   console.log('RAEM_007_RESULT='+(pass?'PASS':next.state==='HOLD'?'HOLD '+next.reason:'FAIL'));
   if(!pass && next.state!=='HOLD')process.exitCode=1;
  }
 }finally{
  await rm(root,{recursive:true,force:true});
  console.log('RAEM_007_END=TEMP_FILES_CLEANED_MOCK_RESPONSE_ONLY_NO_LIVE_NETWORK_NO_SERVICE_CHANGES');
 }
}
