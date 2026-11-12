// RAEM-003: opt-in, single-session synthetic scaling benchmark. Read-only, no external actions.
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {evaluateAdmission} from '../src/resource-aware/raem.mjs';
import {analyzeSynthetic} from '../src/resource-aware/bounded-stream.mjs';
import {summarizeScaling} from '../src/resource-aware/scaling-profile.mjs';
const samples=[];
for(const size of [128,512,1024]){
  const snapshot=await sampleHost({sampleDelayMs:150});
  const job={id:'raem_scaling_synthetic',minimumMiB:128,targetMiB:128,maximumMiB:128};
  const admission=evaluateAdmission(snapshot,job);
  console.log('RAEM_003_STEP_PRECHECK='+JSON.stringify({inputMiB:size,snapshot,admission}));
  if(admission.state!=='GRANT'){
    console.log('RAEM_003_HOLD='+JSON.stringify({inputMiB:size,reason:admission.reason}));
    break;
  }
  const result=await analyzeSynthetic({totalMiB:size,chunkKiB:64,maxInputMiB:size,maxProcessRssMiB:admission.grantedMiB,minimumHostFreeMiB:admission.reserveMiB,sampleEveryChunks:32,pauseMs:1});
  const sample={inputMiB:size,state:result.state,processedBytes:result.processedBytes,peakRssMiB:result.peakRssMiB,elapsedMs:result.elapsedMs};
  samples.push(sample);
  console.log('RAEM_003_STEP_RESULT='+JSON.stringify({...sample,reason:result.reason,sha256:result.sha256}));
  if(result.state!=='PASS')break;
}
if(samples.length>=2)console.log('RAEM_003_SCALING_ASSESSMENT='+JSON.stringify(summarizeScaling(samples)));
else console.log('RAEM_003_SCALING_ASSESSMENT='+JSON.stringify({assessment:'INSUFFICIENT_COMPLETED_SAMPLES',samples}));
console.log('RAEM_003_END=NO_AIL_NO_NETWORK_NO_BACKGROUND_JOBS_NO_SERVICE_CHANGES');
