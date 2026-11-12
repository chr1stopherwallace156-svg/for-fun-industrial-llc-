// RAEM-004a: Convert an advisory admission into a smaller, observed-RSS-aware budget.
// Does not change the host reserve or authorize job execution.
export function chooseAdaptiveIncidentBudget(admission,processRssMiB,{
  minWorkerMiB=64,maxWorkerMiB=128,
  processMarginMiB=8,hostMarginMiB=8
}={}){
  const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
  if(!admission||typeof admission!=='object'||!['GRANT','HOLD'].includes(admission.state)||
      !int(admission.reserveMiB,0,1048576)||!int(admission.headroomMiB,0,1048576)||!int(admission.grantedMiB,0,1048576)||
      !Number.isFinite(processRssMiB)||processRssMiB<0||
      !int(minWorkerMiB,16,8192)||!int(maxWorkerMiB,minWorkerMiB,8192)||
      !int(processMarginMiB,0,512)||!int(hostMarginMiB,0,512)){
    throw Error('RAEM_ADAPTIVE_BUDGET_INVALID');
  }
  const baselineRssMiB=Number(processRssMiB.toFixed(2));
  if(admission.state==='HOLD')
    return {...admission,baselineRssMiB,adapted:false};
  const minNeededMiB=Math.max(minWorkerMiB,Math.ceil(processRssMiB+processMarginMiB));
  const possibleMiB=Math.min(maxWorkerMiB,admission.grantedMiB,Math.max(0,admission.headroomMiB-hostMarginMiB));
  if(possibleMiB<minNeededMiB)
    return {...admission,state:'HOLD',reason:'INSUFFICIENT_ADAPTIVE_MARGIN',grantedMiB:0,requestedMiB:maxWorkerMiB,baselineRssMiB,minNeededMiB,adapted:false};
  return {...admission,state:'GRANT',reason:possibleMiB<maxWorkerMiB?'ADAPTIVE_REDUCED_BUDGET':'TARGET_MET',grantedMiB:possibleMiB,requestedMiB:maxWorkerMiB,baselineRssMiB,minNeededMiB,adapted:true};
}
