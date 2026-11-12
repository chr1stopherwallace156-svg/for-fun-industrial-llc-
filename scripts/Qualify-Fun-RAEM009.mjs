// RAEM-009: explicit operator-approved *one-time* public-catalogue pilot.
// Default with no flags: dry-run only. Never a background scheduler.
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createInterface} from 'node:readline/promises';
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {CatalogueSnapshotStore,checkPublicCatalogue,CATALOGUE_URL,CATALOGUE_ATTRIBUTION} from '../src/resource-aware/hibp-catalogue.mjs';
import {parsePilotArgs,evaluateLivePilotReadiness,LIVE_CONFIRMATION,exactOperatorConfirmation} from '../src/resource-aware/catalogue-live-gate.mjs';
import {reviewPublicCatalogueResult} from '../src/resource-aware/catalogue-review.mjs';

function print(label,data){console.log(label+'='+JSON.stringify(data));}
const mode=parsePilotArgs(process.argv.slice(2));
const host=await sampleHost({sampleDelayMs:200});
const ready=evaluateLivePilotReadiness(host,process.memoryUsage().rss/(1024*1024));
print('RAEM_009_PREFLIGHT',{mode,host,ready,source:CATALOGUE_URL});
if(mode==='dry-run'){
 console.log('RAEM_009_RESULT=DRY_RUN_ONLY');
 console.log('RAEM_009_NO_LIVE_NETWORK=TRUE NO_WRITES=TRUE NO_PROCESS_CHANGES=TRUE');
}else if(ready.state!=='GRANT'){
 console.log('RAEM_009_RESULT=HOLD '+ready.reason);
 console.log('RAEM_009_NETWORK_REQUESTS=0');
}else if(!process.stdin.isTTY||!process.stdout.isTTY){
 console.log('RAEM_009_RESULT=HOLD INTERACTIVE_OPERATOR_REQUIRED');
 console.log('RAEM_009_NETWORK_REQUESTS=0');
}else{
 console.log('RAEM_009_LIVE_SCOPE=ONE_PUBLIC_METADATA_GET NO_ACCOUNT_EMAIL_PASSWORD_OR_STEALER_LOOKUP');
 console.log('RAEM_009_ATTRIBUTION='+CATALOGUE_ATTRIBUTION);
 let answer='';
 const rl=createInterface({input:process.stdin,output:process.stdout,terminal:true});
 try{answer=await rl.question('Type exactly "'+LIVE_CONFIRMATION+'" for ONE live public catalogue GET (anything else cancels): ');}
 finally{rl.close();}
 if(!exactOperatorConfirmation(answer)){
  console.log('RAEM_009_RESULT=HOLD OPERATOR_DID_NOT_CONFIRM');
  console.log('RAEM_009_NETWORK_REQUESTS=0');
 }else{
  // Re-sample because system memory/CPU may have changed while the human typed.
  const again=await sampleHost({sampleDelayMs:200});
  const admission=evaluateLivePilotReadiness(again,process.memoryUsage().rss/(1024*1024));
  print('RAEM_009_POST_CONFIRM_PREFLIGHT',{host:again,admission});
  if(admission.state!=='GRANT'){
   console.log('RAEM_009_RESULT=HOLD '+admission.reason);
   console.log('RAEM_009_NETWORK_REQUESTS=0');
  }else{
   // Only the confirmed live path can create persistent state and call HIBP.
   const base=process.env.LOCALAPPDATA||join(homedir(),'AppData','Local');
   const root=join(base,'FunIndustrial','RAEM009PublicCatalogue');
   const store=new CatalogueSnapshotStore({root,refreshHours:6,maxEntries:4096});
   const result=await checkPublicCatalogue({store,operatorApproved:true,nowMs:Date.now(),
    maxProcessRssMiB:admission.grantedMiB,minimumHostFreeMiB:admission.liveFloorMiB});
   print('RAEM_009_PUBLIC_RESULT',result);
   try{print('RAEM_011_REVIEW',reviewPublicCatalogueResult(result));}
   catch{print('RAEM_011_REVIEW',{state:'HOLD',reason:'REPORT_VALIDATION_FAILED',additionalRequestsAuthorized:false});}
   if(result.state==='PASS')console.log('RAEM_009_RESULT=PASS PUBLIC_METADATA_ONLY');
   else console.log('RAEM_009_RESULT=HOLD '+result.reason);
  }
 }
}
console.log('RAEM_009_END=NO_BACKGROUND_TIMER_NO_REA_NO_QWEN_NO_OLLAMA_NO_SERVICE_RESTART');
