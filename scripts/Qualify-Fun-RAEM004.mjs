// One-time read-only RAEM-004 qualification; no AIL, network or background jobs.
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {evaluateSyntheticBalancedAdmission} from '../src/resource-aware/synthetic-admission-profile.mjs';
import {analyzeSyntheticIncidents} from '../src/resource-aware/incident-stream.mjs';
const results=[];
for (const totalMiB of [8,32,128]) {
  const snapshot=await sampleHost({sampleDelayMs:150});
  const admission=evaluateSyntheticBalancedAdmission(snapshot,process.memoryUsage().rss/(1024*1024));
  console.log('RAEM_004_PRECHECK='+JSON.stringify({totalMiB,snapshot,admission}));
  if(admission.state!=='GRANT'){
    console.log('RAEM_004_HOLD='+JSON.stringify({totalMiB,reason:admission.reason}));
    break;
  }
  const output=await analyzeSyntheticIncidents({totalMiB,maxInputMiB:totalMiB,maxProcessRssMiB:admission.grantedMiB,minimumHostFreeMiB:admission.runtimeFreeFloorMiB,allowDomains:['alpha.example'],sampleEveryChunks:32,pauseMs:1});
  const result={totalMiB,...output};results.push(result);
  console.log('RAEM_004_RESULT='+JSON.stringify(result));
  if(output.state!=='PASS')break;
}
if(results.length>1){
  const complete=results.filter(x=>x.state==='PASS');
  const first=complete[0],last=complete.at(-1);
  console.log('RAEM_004_SCALING='+JSON.stringify({completed:complete.length,total:results.length,inputScale:complete.length>1?last.totalMiB/first.totalMiB:null,firstPeakRssMiB:first?.peakRssMiB??null,lastPeakRssMiB:last?.peakRssMiB??null,peakRssGrowthMiB:complete.length>1?Number((last.peakRssMiB-first.peakRssMiB).toFixed(2)):null}));
}
console.log('RAEM_004_END=NO_AIL_NO_NETWORK_NO_BACKGROUND_JOBS_NO_SERVICE_CHANGES');
