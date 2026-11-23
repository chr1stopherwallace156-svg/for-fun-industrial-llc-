// FUN_FISRE_EVIDENCE_BRIDGE_V3
// Data-only bridge from a V2 report into proposed (not supported) cognition.
// Does not independently verify a proof, execute scanned code, or grant authority.
import {createHash} from 'node:crypto';
import {CognitiveKernel} from './kernel.mjs';

export const VERSION='fi-fisre-evidence-bridge-v3';
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
const NUMBER=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?$|^[+-]?\d+\/\d+$/;
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hold=code=>{throw Error('FISRE_V3_HOLD_'+code)};
const str=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const safeNumber=v=>str(v,90)&&NUMBER.test(v);
const statuses=new Set(['PROVED','COUNTEREXAMPLE_FOUND','UNKNOWN']);
const checkStatuses=new Set(['PROVED_NONZERO','ZERO_WITNESS_FOUND','UNKNOWN_NONAFFINE']);

export function validateFisreReport(report){
 if(!obj(report))hold('REPORT_NOT_OBJECT');
 let bytes;
 try{bytes=Buffer.byteLength(JSON.stringify(report),'utf8')}
 catch{hold('REPORT_NOT_SERIALIZABLE')}
 if(bytes>65536)hold('REPORT_TOO_LARGE');
 if(report.version!=='fi-semantic-proof-v2'||!statuses.has(report.status)||
    !SHA.test(report.source_sha256??'')||!str(report.function,80)||
    !ID.test(report.function)||!str(report.reason,140)||
    report.proof_scope!=='restricted_exact_rational_arithmetic_not_Python_runtime_or_floating_point'||
    report.source_executed!==false||report.external_actions!==0||
    report.tool_authority_granted!==false)hold('REPORT_IDENTITY_OR_BOUNDARY_INVALID');
 if(!obj(report.domain)||!Array.isArray(report.division_checks)||report.division_checks.length>150)
  hold('REPORT_DOMAIN_OR_CHECKS_INVALID');
 const keys=Object.keys(report.domain);
 if(keys.length<1||keys.length>16)hold('REPORT_DOMAIN_INVALID');
 for(const key of keys){
  const bounds=report.domain[key];
  if(!ID.test(key)||!obj(bounds)||!safeNumber(bounds.min)||!safeNumber(bounds.max))
   hold('REPORT_DOMAIN_INVALID');
 }
 let zeroCount=0,unknownCount=0;
 for(const check of report.division_checks){
  if(!obj(check)||!Number.isSafeInteger(check.line)||check.line<1||!str(check.expression,240)||
     !checkStatuses.has(check.status))hold('REPORT_CHECK_INVALID');
  if(check.status==='ZERO_WITNESS_FOUND'){
   zeroCount++;
   if(!obj(check.witness)||Object.keys(check.witness).length!==keys.length||
      Object.keys(check.witness).some(k=>!own(report.domain,k)||!safeNumber(check.witness[k])))
      hold('REPORT_WITNESS_INVALID');
  }else if(own(check,'witness'))hold('REPORT_UNEXPECTED_WITNESS');
  if(check.status==='UNKNOWN_NONAFFINE')unknownCount++;
  if(check.status!=='UNKNOWN_NONAFFINE'&&(!safeNumber(check.minimum)||!safeNumber(check.maximum)))
   hold('REPORT_BOUNDS_INVALID');
 }
 if(report.status==='PROVED'&&(zeroCount||unknownCount))hold('INCONSISTENT_PROVED');
 if(report.status==='COUNTEREXAMPLE_FOUND'&&!zeroCount)hold('COUNTEREXAMPLE_MISSING');
 if(report.status==='UNKNOWN'&&zeroCount)hold('UNKNOWN_WITH_WITNESS');
 // Structural contract, NOT proof authentication. Forged reports can satisfy it.
 // No imported claim may become supported automatically.
 const canonical={
  version:report.version,status:report.status,reason:report.reason,
  source_sha256:report.source_sha256,function:report.function,
  proof_scope:report.proof_scope,domain:report.domain,division_checks:report.division_checks
 };
 const reportDigest=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
 return Object.freeze({status:report.status,reason:report.reason,
  function:report.function,sourceSha256:report.source_sha256,reportDigest,
  domainParameters:keys.length,divisionChecks:report.division_checks.length,
  witnesses:zeroCount,unknownChecks:unknownCount,
  reportVerified:false,independentProofVerified:false,
  trust:'untrusted_structurally_valid_analyzer_report'});
}

export function createFisreEvidencePacket(report,{kernel}={}){
 const evidence=validateFisreReport(report); // No mutations before validation.
 const brain=kernel??new CognitiveKernel();
 if(typeof brain.propose!=='function'||typeof brain.assess!=='function'||
    typeof brain.exportSnapshot!=='function')hold('KERNEL_INTERFACE_INVALID');
 const labels={
  PROVED:'report_claims_divisors_nonzero_within_restricted_rational_domain',
  COUNTEREXAMPLE_FOUND:'report_claims_zero_divisor_witness_within_restricted_rational_domain',
  UNKNOWN:'report_cannot_establish_divisor_safety'
 };
 const proposal=brain.propose({
  subject:'function:'+evidence.function,
  predicate:'reported_division_safety',
  object:labels[evidence.status],
  question:'how',
  source:'fisre-v2-report:'+evidence.reportDigest.slice(0,24)
 });
 if(proposal.status!=='proposed')hold('UNEXPECTED_PROMOTION');
 const assessment=brain.assess();
 if(assessment.authority!=='none'||assessment.externalActions!==0)
  hold('KERNEL_AUTHORITY_CHANGED');
 return Object.freeze({
  version:VERSION,state:'EVIDENCE_PROPOSED_NOT_VERIFIED',
  proposedClaim:{id:proposal.id,status:proposal.status,subject:proposal.subject,
   predicate:proposal.predicate,object:proposal.object,source:proposal.source},
  evidence,
  cognitiveSnapshot:brain.exportSnapshot(),
  observationAuthenticated:false,proofIndependentlyChecked:false,
  reportExecuted:false,actionsExecuted:0,authorityGranted:false,
  persistencePerformed:false,
  nextGate:'Independent source and mathematical verification required before supported claims'
 });
}
