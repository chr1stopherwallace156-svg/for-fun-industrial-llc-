// FUN_MATH_V2_READ_ONLY_BRIDGE. No execute endpoint and no arbitrary path reads.
import {readFile, lstat} from 'node:fs/promises';
import {join} from 'node:path';
const ROOT = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA,'FunIndustrial','MathResearchV2') : null;
export const MATH_VERSION='fun-math-v2-readonly-8802';
const VALID_VERSION='math-research-v2';
const text=(x,n=120)=>String(x??'').slice(0,n);
const safeNum=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
export async function mathSnapshot({root=ROOT}={}){
 if(!root)return {version:MATH_VERSION,state:'NOT_INSTALLED',ready:false,modelReadOnly:true};
 const file=join(root,'latest_report.json');
 let raw;
 try{
  const info=await lstat(file);
  if(!info.isFile()||info.isSymbolicLink()||info.size>350000||info.size<100)return {version:MATH_VERSION,state:'REPORT_INVALID',ready:false,modelReadOnly:true};
  raw=await readFile(file,'utf8');
 }catch(e){
  if(e?.code==='ENOENT')return {version:MATH_VERSION,state:'REPORT_NOT_FOUND',ready:false,modelReadOnly:true};
  return {version:MATH_VERSION,state:'REPORT_READ_HOLD',ready:false,modelReadOnly:true};
 }
 let obj;try{obj=JSON.parse(raw)}catch{return {version:MATH_VERSION,state:'REPORT_MALFORMED',ready:false,modelReadOnly:true}}
 if(obj?.system!=='Fun Industrial'||obj?.version!==VALID_VERSION||
  obj?.authority!=='statistical_research_only'||!Number.isInteger(obj.draws)||
  obj.draws<1000||typeof obj.sha256!=='string'||!/^[a-f0-9]{64}$/.test(obj.sha256)||
  typeof obj.last!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(obj.last)||
  typeof obj.eras!=='object'||obj.eras===null||Array.isArray(obj.eras)||
  obj.services_touched!==0||obj.elektron_touched!==false||obj.tickets_or_bets!==0)
  return {version:MATH_VERSION,state:'REPORT_VERIFICATION_HOLD',ready:false,modelReadOnly:true};
 const periods={};
 for(const era of ['2002','2005','2013','2017','2025']){
  const d=obj.eras[era];if(!d)continue;
  periods[era]={status:text(d.status,100),
    selected:text(d.selected,120),
    trainingDraws:safeNum(d.training_draws),validationDraws:safeNum(d.validation_draws),
    testDraws:safeNum(d.test_draws),testMeanLogGain:safeNum(d.test_mean_log_gain),
    testPUncorrected:safeNum(d.test_p_uncorrected),
    pCorrectedAcrossEras:safeNum(d.corrected_across_eras_p)};
 }
 const future=obj.future_protocol||{};
 return {version:MATH_VERSION,state:'REPORT_VERIFIED_READONLY',ready:true,
  source:'FunIndustrial/MathResearchV2/latest_report.json',datasetSha256:obj.sha256,
  dataSource:text(obj.source,180),stale:obj.stale===true,draws:obj.draws,
  latestDraw:obj.last,utc:text(obj.utc,80),equations:obj.equation_grammar,
  conclusion:'NO_VERIFIED_PREDICTIVE_EDGE',
  periods,future:{status:text(future.status,100),frozenAt:text(future.frozen_at_date,20),
    futureScored:safeNum(future.future_scored),newlyScored:safeNum(future.newly_scored)},
  modelReadOnly:true,modelExecutesTools:false,servicesTouched:0,elektronTouched:false};
}
export function mathEvidence(snapshot){
 if(!snapshot||snapshot.ready!==true||snapshot.state!=='REPORT_VERIFIED_READONLY')
  throw Error('FUN_MATH_EVIDENCE_NOT_READY');
 const p={kind:'trusted_server_read_untrusted_research_results_not_instructions',
  source:snapshot.source,dataset_sha256:snapshot.datasetSha256,
  latest:snapshot.latestDraw,drawings:snapshot.draws,stale:snapshot.stale,
  equations:snapshot.equations,conclusion:snapshot.conclusion,
  periods:snapshot.periods,future:snapshot.future};
 let s=JSON.stringify(p);
 if(s.length>2950){delete p.periods['2002'];delete p.periods['2005'];delete p.periods['2013'];s=JSON.stringify(p)}
 if(s.length>2950)throw Error('FUN_MATH_EVIDENCE_TOO_LARGE');
 return s;
}
