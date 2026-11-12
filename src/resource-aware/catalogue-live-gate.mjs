// FUN_RAEM_009: conservative, operator-only live pilot preparation.
// Never changes the synthetic balanced benchmark profile or RAEM defaults.
import {evaluateAdmission} from './raem.mjs';
import {chooseAdaptiveIncidentBudget} from './adaptive-incident-budget.mjs';

export const LIVE_CONFIRMATION='AUTHORIZE ONE PUBLIC CATALOGUE GET';
export const LIVE_PREFLIGHT_EXTRA_MIB=128;
export const LIVE_RUNTIME_EXTRA_MIB=64;

export function parsePilotArgs(args){
 if(!Array.isArray(args)||args.some(v=>typeof v!=='string'))throw Error('RAEM009_ARGS_INVALID');
 if(args.length===0||args.length===1&&args[0]==='--dry-run')return 'dry-run';
 if(args.length===1&&args[0]==='--live')return 'live';
 throw Error('RAEM009_ARGS_INVALID');
}
export function evaluateLivePilotReadiness(snapshot,processRssMiB){
 const admitted=evaluateAdmission(snapshot,{
  id:'raem_public_catalogue_once',
  minimumMiB:64,targetMiB:128,maximumMiB:128,approvalRequired:true
 });
 const result=chooseAdaptiveIncidentBudget(admitted,processRssMiB);
 const liveFloorMiB=admitted.reserveMiB+LIVE_RUNTIME_EXTRA_MIB;
 if(snapshot.freeMiB<admitted.reserveMiB+LIVE_PREFLIGHT_EXTRA_MIB)
  return {...result,state:'HOLD',reason:'LIVE_PILOT_PREFLIGHT_MARGIN',grantedMiB:0,
   liveFloorMiB,profile:'CONSERVATIVE_MANUAL_LIVE_ONLY'};
 return {...result,liveFloorMiB,profile:'CONSERVATIVE_MANUAL_LIVE_ONLY'};
}
export function exactOperatorConfirmation(answer){
 return typeof answer==='string'&&answer===LIVE_CONFIRMATION;
}
