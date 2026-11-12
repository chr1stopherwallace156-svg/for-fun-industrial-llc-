// RAEM-003: Summarize observational scaling results. Does not claim AIL compatibility.
const mib=1024*1024;
export function summarizeScaling(samples){
  if(!Array.isArray(samples)||samples.length<2||samples.length>8)throw Error('RAEM_SCALING_INPUT_INVALID');
  let previous=0;
  const normalized=samples.map(s=>{
    if(!s||typeof s!=='object'||!Number.isSafeInteger(s.inputMiB)||s.inputMiB<=previous||s.inputMiB>8192||!['PASS','HOLD'].includes(s.state)||!Number.isFinite(s.peakRssMiB)||s.peakRssMiB<=0||!Number.isFinite(s.elapsedMs)||s.elapsedMs<0||!Number.isSafeInteger(s.processedBytes)||s.processedBytes<0||s.processedBytes>s.inputMiB*mib)throw Error('RAEM_SCALING_SAMPLE_INVALID');
    previous=s.inputMiB;
    if(s.state==='PASS'&&s.processedBytes!==s.inputMiB*mib)throw Error('RAEM_SCALING_PASS_INCOMPLETE');
    return {inputMiB:s.inputMiB,state:s.state,peakRssMiB:s.peakRssMiB,elapsedMs:s.elapsedMs,processedMiB:Number((s.processedBytes/mib).toFixed(2)),throughputMiBps:s.elapsedMs?Number((s.processedBytes/mib/(s.elapsedMs/1000)).toFixed(2)):null};
  });
  const complete=normalized.filter(x=>x.state==='PASS');
  if(complete.length<2)return {assessment:'INSUFFICIENT_COMPLETED_SAMPLES',completed:complete.length,total:normalized.length,measurements:normalized};
  const first=complete[0],last=complete.at(-1);
  const observedPeakRssMiB=Math.max(...complete.map(x=>x.peakRssMiB));
  const peakRssGrowthMiB=Number((last.peakRssMiB-first.peakRssMiB).toFixed(2));
  const inputScale=Number((last.inputMiB/first.inputMiB).toFixed(2));
  // Threshold is explicitly a screening criterion, not a proof of a hard cap.
  const boundedCandidate=complete.length===samples.length&&inputScale>=4&&peakRssGrowthMiB<=Math.max(32,first.peakRssMiB*0.25);
  return {assessment:boundedCandidate?'BOUNDED_SCALING_CANDIDATE':'NEEDS_FURTHER_QUALIFICATION',completed:complete.length,total:normalized.length,inputScale,firstPeakRssMiB:first.peakRssMiB,lastPeakRssMiB:last.peakRssMiB,peakRssGrowthMiB,observedPeakRssMiB,measurements:normalized};
}
