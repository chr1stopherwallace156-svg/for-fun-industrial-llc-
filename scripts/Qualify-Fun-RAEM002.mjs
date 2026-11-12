// Operator-initiated, read-only bounded synthetic stream qualification.
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {ResourceAwareManager} from '../src/resource-aware/raem.mjs';
import {analyzeSynthetic} from '../src/resource-aware/bounded-stream.mjs';
const snapshot=await sampleHost({sampleDelayMs:150});
const manager=new ResourceAwareManager();
manager.register({id:'raem_synthetic_stream',minimumMiB:128,targetMiB:128,maximumMiB:256});
const admission=manager.claim('raem_synthetic_stream',snapshot,{operatorApproved:true,nowMs:Date.now()});
console.log('RAEM_002_HOST='+JSON.stringify(snapshot));
console.log('RAEM_002_ADMISSION='+JSON.stringify(admission));
if(admission.state!=='GRANT'){
  console.log('RAEM_002_RESULT=HOLD NO_SYNTHETIC_JOB_RAN EXISTING_SERVICES_UNCHANGED=TRUE');
}else{
  const result=await analyzeSynthetic({totalMiB:128,maxInputMiB:128,maxProcessRssMiB:admission.grantedMiB,minimumHostFreeMiB:admission.reserveMiB,chunkKiB:64,sampleEveryChunks:32,pauseMs:1});
  manager.complete('raem_synthetic_stream',{success:result.state==='PASS',nowMs:Date.now()});
  console.log('RAEM_002_RESULT='+JSON.stringify(result));
  console.log('RAEM_002_STATE='+JSON.stringify(manager.status()));
  console.log('RAEM_002_NOTE=SOFT_GUARD_ONLY_NO_AIL_NO_NETWORK_NO_PROCESS_CONTROL_NO_FILE_WRITES');
}
