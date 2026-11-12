// FUN_RAEM_004B: opt-in policy for *synthetic* benchmarks only.
// Does not modify RAEM's conservative default or authorize any external action.
import {evaluateAdmission} from './raem.mjs';
import {chooseAdaptiveIncidentBudget} from './adaptive-incident-budget.mjs';

export const SYNTHETIC_BALANCED_POLICY=Object.freeze({
  reserveMiB:2048,
  reserveFraction:0.125,
  cpuCeilingPct:70,
  maxConcurrent:1
});
export const SYNTHETIC_LIVE_MARGIN_MIB=256;
export const SYNTHETIC_PRECHECK_MARGIN_MIB=512;

export function evaluateSyntheticBalancedAdmission(snapshot,baselineProcessRssMiB){
  const upstream=evaluateAdmission(snapshot,{
    id:'raem_incident_synthetic',
    minimumMiB:64,
    targetMiB:128,
    maximumMiB:128,
    approvalRequired:true
  },SYNTHETIC_BALANCED_POLICY);
  // Leave at least another 512 MiB free beyond the protected reserve before
  // starting a benchmark; leave >=256 MiB beyond it during the run.
  if (snapshot.freeMiB < upstream.reserveMiB+SYNTHETIC_PRECHECK_MARGIN_MIB)
    return {...upstream,state:'HOLD',reason:'BENCHMARK_HEADROOM_GUARD',grantedMiB:0,
      runtimeFreeFloorMiB:upstream.reserveMiB+SYNTHETIC_LIVE_MARGIN_MIB,
      admissionProfile:'SYNTHETIC_BALANCED_ONLY'};
  const adapted=chooseAdaptiveIncidentBudget(upstream,baselineProcessRssMiB);
  return {...adapted,runtimeFreeFloorMiB:upstream.reserveMiB+SYNTHETIC_LIVE_MARGIN_MIB,
    admissionProfile:'SYNTHETIC_BALANCED_ONLY'};
}
