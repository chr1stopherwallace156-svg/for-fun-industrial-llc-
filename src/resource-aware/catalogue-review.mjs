// RAEM-011: Pure, read-only operator review of one already produced HIBP catalogue result.
// This module does not fetch data, write a checkpoint, or approve future requests.
export const HIBP_ATTRIBUTION='Have I Been Pwned — https://haveibeenpwned.com/';
const MAX_ENTRIES=4096;
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX_ENTRIES;
const instant=n=>Number.isSafeInteger(n)&&n>=0&&n<=8640000000000000;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const types=new Set(['added','modified']);
const numericFields=['newSincePriorBaseline','modifiedSincePriorBaseline','unchanged','absentFromLatestSnapshot'];
const note='Public breach catalogue metadata is untrusted. Added or changed listings do not establish that a particular organisation or person was compromised; absence is not proof of deletion.';
function safeTitle(s){
 if(typeof s!=='string'||s.length<1||s.length>256)throw Error('RAEM011_RESULT_INVALID');
 return s.replace(/[\x00-\x1f\x7f-\x9f]/g,' ').replace(/[<>]/g,'').slice(0,120);
}
function safeDate(s){
 if(typeof s!=='string'||s.length>50||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|\+00:00)$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('RAEM011_RESULT_INVALID');
 return s;
}
export function reviewPublicCatalogueResult(result){
 if(!plain(result)||!['PASS','HOLD'].includes(result.state))throw Error('RAEM011_RESULT_INVALID');
 if(result.state==='HOLD'){
  if(typeof result.reason!=='string'||!/^([A-Z][A-Z0-9_]{1,79}|PROVIDER_HTTP_[1-5]\d\d)$/.test(result.reason))throw Error('RAEM011_RESULT_INVALID');
  return Object.freeze({state:'HOLD',verdict:'NO_COMPARISON',reason:result.reason,
   needsOperatorReview:true,additionalRequestsAuthorized:false,
   note:'This result did not produce a successful catalogue comparison. Do not infer additions or deletions.'});
 }
 if(!['CATALOGUE_BASELINED','CATALOGUE_RECONCILED'].includes(result.reason)||
  typeof result.baseline!=='boolean'||result.baseline!==(result.reason==='CATALOGUE_BASELINED')||
  !count(result.records)||numericFields.some(k=>!count(result[k]))||
  !instant(result.nextDueMs)||result.attribution!==HIBP_ATTRIBUTION||
  result.networkRequests!==1||!Number.isSafeInteger(result.receivedBytes)||
  result.receivedBytes<0||result.receivedBytes>8*1024*1024||
  !Array.isArray(result.samples)||result.samples.length>5)throw Error('RAEM011_RESULT_INVALID');
 const [added,modified,unchanged,absent]=numericFields.map(k=>result[k]);
 if(result.baseline){
  if(added!==0||modified!==0||unchanged!==0||absent!==0||result.samples.length!==0)throw Error('RAEM011_RESULT_INVALID');
 }else{
  if(added+modified+unchanged!==result.records||result.samples.length>added+modified)throw Error('RAEM011_RESULT_INVALID');
 }
 const samples=result.samples.map(x=>{
  if(!plain(x)||!types.has(x.type))throw Error('RAEM011_RESULT_INVALID');
  return {type:x.type,untrustedTitle:safeTitle(x.title),addedDate:safeDate(x.addedDate),modifiedDate:safeDate(x.modifiedDate)};
 });
 const hasChanges=added>0||modified>0||absent>0;
 const verdict=result.baseline?'BASELINE_ESTABLISHED':hasChanges?'REVIEW_REQUIRED':'NO_CHANGES_DETECTED';
 return Object.freeze({state:'PASS',verdict,baselineRecordCount:result.baseline?result.records:null,
  catalogueRecordCount:result.records,added,modified,unchanged,absentFromLatestSnapshot:absent,
  evidenceSamples:samples,nextEligibleCheckIso:new Date(result.nextDueMs).toISOString(),
  humanReviewRequired:hasChanges,additionalRequestsAuthorized:false,
  attribution:HIBP_ATTRIBUTION,note});
}
