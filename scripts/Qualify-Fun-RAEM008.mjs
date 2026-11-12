// RAEM-008: one-shot offline HIBP-shaped catalogue reconciliation. NO live requests.
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {evaluateAdmission} from '../src/resource-aware/raem.mjs';
import {chooseAdaptiveIncidentBudget} from '../src/resource-aware/adaptive-incident-budget.mjs';
import {CatalogueSnapshotStore,checkPublicCatalogue,CATALOGUE_URL} from '../src/resource-aware/hibp-catalogue.mjs';

const host=await sampleHost({sampleDelayMs:150});
const upstream=evaluateAdmission(host,{id:'raem_catalogue_offline_demo',minimumMiB:64,targetMiB:128,maximumMiB:128});
const admission=chooseAdaptiveIncidentBudget(upstream,process.memoryUsage().rss/(1024*1024));
console.log('RAEM_008_PRECHECK='+JSON.stringify({host,admission}));
if(admission.state!=='GRANT'){
  console.log('RAEM_008_RESULT=HOLD '+admission.reason);
  console.log('RAEM_008_END=NO_LIVE_NETWORK_NO_BACKGROUND_WORK_NO_SERVICE_CHANGES');
}else{
 const root=await mkdtemp(join(tmpdir(),'raem008-offline-'));
 const opts={root,refreshHours:6};
 const record=(name,date='2026-11-10T00:00:00Z')=>({Name:name,Title:'Synthetic '+name,AddedDate:'2026-11-09T00:00:00Z',ModifiedDate:date,Domain:'example.com',PwnCount:1000});
 const baseline=[record('ExampleOne'),record('ExampleTwo'),record('ExampleThree')];
 const changed=[record('ExampleOne','2026-11-11T00:00:00Z'),record('ExampleTwo'),record('ExampleFour')];
 let active=baseline,mockedCalls=0;
 const fetchImpl=async url=>{
  if(url!==CATALOGUE_URL)throw Error('UNEXPECTED_PROVIDER_URL');
  mockedCalls++;
  return new Response(JSON.stringify(active),{status:200,headers:{'content-type':'application/json'}});
 };
 const makeOptions=store=>({store,fetchImpl,operatorApproved:true,
  maxProcessRssMiB:admission.grantedMiB,minimumHostFreeMiB:admission.reserveMiB+8});
 try{
  const first=new CatalogueSnapshotStore(opts);
  const one=await checkPublicCatalogue({...makeOptions(first),nowMs:1000});
  console.log('RAEM_008_BASELINE='+JSON.stringify(one));
  if(one.state!=='PASS'){
   console.log('RAEM_008_RESULT=HOLD '+one.reason);
  }else{
   active=changed;
   const early=await checkPublicCatalogue({...makeOptions(first),nowMs:2000});
   const reopened=new CatalogueSnapshotStore(opts);
   const two=await checkPublicCatalogue({...makeOptions(reopened),nowMs:21601000});
   console.log('RAEM_008_EARLY='+JSON.stringify(early));
   console.log('RAEM_008_RECONCILED='+JSON.stringify(two));
   if(two.state==='PASS'){
    const stored=await reopened.read();
    const disk=await readFile(join(root,'hibp_catalogue_snapshot.json'),'utf8');
    const pass=one.baseline===true&&one.records===3&&early.reason==='REFRESH_NOT_DUE'&&early.networkRequests===0&&
     two.baseline===false&&two.records===3&&two.newSincePriorBaseline===1&&two.modifiedSincePriorBaseline===1&&
     two.unchanged===1&&two.absentFromLatestSnapshot===1&&mockedCalls===2&&stored.records.length===3&&
     !disk.includes('ExampleOne')&&!disk.includes('Synthetic ExampleTwo');
    console.log('RAEM_008_CHECKPOINT='+JSON.stringify({checkedAtMs:stored.checkedAtMs,nextDueMs:stored.nextDueMs,hashedEntries:stored.records.length,
     rawNamesStored:disk.includes('ExampleOne')}));
    console.log('RAEM_008_RESULT='+(pass?'PASS':'FAIL'));
    if(!pass)process.exitCode=1;
   }else{
    console.log('RAEM_008_RESULT=HOLD '+two.reason);
   }
  }
 }finally{
  await rm(root,{recursive:true,force:true});
  console.log('RAEM_008_END=TEMP_FILES_CLEANED_MOCK_RESPONSE_ONLY_NO_LIVE_NETWORK_NO_SERVICE_CHANGES');
 }
}
