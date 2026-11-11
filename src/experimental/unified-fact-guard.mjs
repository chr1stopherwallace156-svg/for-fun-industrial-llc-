// FI_UNIFIED_FACT_GUARD_V1
// Deterministically repair arithmetic mistakes in model-reported time units.
// Never asserts tool success, grants permissions or changes underlying evidence.
export function correctMillisecondSeconds(text){
 const input=String(text??'');
 const fixes=[];
 const corrected=input.replace(/\b([\d,]+(?:\.\d+)?)\s*(milliseconds?|ms)\s*\(\s*([\d,]+(?:\.\d+)?)\s*(seconds?|secs?|s)\s*\)/gi,
  (whole,milliseconds,unit,seconds)=>{
   const ms=Number(milliseconds.replaceAll(',',''));
   const observed=Number(seconds.replaceAll(',',''));
   if(!Number.isFinite(ms)||!Number.isFinite(observed)||ms<0||ms>Number.MAX_SAFE_INTEGER)return whole;
   const expected=ms/1000;
   if(Math.abs(expected-observed)<=Math.max(0.0000001,Math.abs(expected)*0.000000001))return whole;
   fixes.push(Object.freeze({milliseconds:ms,modelSeconds:observed,correctSeconds:expected}));
   return milliseconds+' '+unit+' ('+String(expected)+' seconds)';
  });
 return Object.freeze({text:corrected,correctionCount:fixes.length,fixes});
}
