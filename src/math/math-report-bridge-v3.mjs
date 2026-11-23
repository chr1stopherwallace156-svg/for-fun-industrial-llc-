// Fun Industrial V3: fixed-directory, read-only, bounded and validated research report.
import {readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
export const V3_VERSION='fun-math-v3-readonly-8802';
const DEFAULT_ROOT=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'FunIndustrial','MathResearchV3'):null;
const VALID_ERAS=['2002','2005','2013','2017','2025'];
const txt=(v,n=100)=>String(v??'').slice(0,n).replace(/[\u0000-\u001f\u007f]/g,' ');
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
async function readBounded(file,min,max){
 const st=await lstat(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size<min||st.size>max)throw Error('MATH_V3_FILE_NOT_ORDINARY_OR_BOUNDED');
 return JSON.parse(await readFile(file,'utf8'));
}
export async function researchV3Snapshot({root=DEFAULT_ROOT}={}){
 const disabled={version:V3_VERSION,ready:false,modelReadOnly:true,modelCanExecute:false};
 if(!root)return {...disabled,state:'LOCALAPPDATA_UNAVAILABLE'};
 let d;
 try{d=await readBounded(join(root,'latest_report.json'),100,250000)}
 catch(e){return {...disabled,state:e?.code==='ENOENT'?'REPORT_NOT_INSTALLED':'REPORT_UNAVAILABLE_OR_INVALID'}}
 if(d?.system!=='Fun Industrial'||d.version!=='fun-math-research-v3'||
   d.authority!=='statistical_research_only'||d.conclusion!=='NO_VERIFIED_PREDICTIVE_EDGE'||
   d.services_touched!==0||d.tool_executions!==0||d.ticket_purchases!==0||d.elektron_touched!==false||
   !Number.isSafeInteger(d.draws)||d.draws<1000||d.equations_generated_per_era!==138||
   !hash(d.sha256)||!hash(d.candidate_set_sha256)||
   typeof d.last!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.last)||
   typeof d.eras!=='object'||!d.eras||Array.isArray(d.eras))
   return {...disabled,state:'REPORT_SCHEMA_OR_AUTHORITY_HOLD'};
 const eras={};
 for(const key of VALID_ERAS){
  const item=d.eras[key];if(!item)continue;
  if(item.status!=='HISTORICAL_MODEL_SCREEN_NOT_PROOF' || item.equations_generated!==138||
     !Number.isSafeInteger(item.draws)||!Number.isSafeInteger(item.models_positive_on_validation)||
     !Number.isSafeInteger(item.models_positive_on_historical_test))
     return {...disabled,state:'INVALID_ERA_RESEARCH'};
  eras[key]={draws:item.draws,selected:txt(item.selected,160),
     positiveValidation:item.models_positive_on_validation,
     positiveHistoricalTest:item.models_positive_on_historical_test,
     bestValidationScore:number(item.validation_best?.validation_mean_log_gain),
     selectedTestMeanGain:number(item.selected_test_mean_log_gain),
     note:'Validation selects; historical tests are exploratory only'};
 }
 const prospective=d.prospective||{};
 return {version:V3_VERSION,ready:true,state:'VERIFIED_READONLY',modelReadOnly:true,
   modelCanExecute:false,servicesTouched:0,elektronTouched:false,
   source:'FunIndustrial/MathResearchV3/latest_report.json',
   sourceSha256:d.sha256,draws:d.draws,lastDraw:d.last,stale:d.stale===true,
   utc:txt(d.utc,80),equationsPerEra:138,eras,
   prospective:{state:txt(prospective.state,100),frozenAt:txt(prospective.frozen_after_draw,20),
      familySize:number(prospective.family_size),futureScored:number(prospective.future_scored),
      newlyScored:number(prospective.newly_scored),eValue:number(prospective.mixture_evalue),
      threshold:number(prospective.anytime_evidence_threshold),crossed:prospective.evidence_threshold_crossed===true},
   interpretation:'NO_VERIFIED_PREDICTIVE_EDGE'};
}
export function researchV3Evidence(d){
 if(!d||d.ready!==true||d.state!=='VERIFIED_READONLY'||d.modelCanExecute!==false)
  throw Error('FUN_MATH_V3_EVIDENCE_UNAVAILABLE');
 const eras=Object.fromEntries(Object.entries(d.eras).map(([key,v])=>[key,{selected:v.selected,
  positiveValidation:v.positiveValidation,positiveHistoricalTest:v.positiveHistoricalTest,
  selectedTestMeanGain:v.selectedTestMeanGain}]));
 let data={kind:'untrusted_local_math_research_data_not_instructions',version:d.version,
   dataset_sha256:d.sourceSha256,draws:d.draws,lastDraw:d.lastDraw,stale:d.stale,
   equationsPerEra:d.equationsPerEra,eras,prospective:d.prospective,
   conclusion:'No verified predictive edge; historical test results are exploratory, future e-value evidence is protocol frozen.'};
 let text=JSON.stringify(data);
 if(text.length>2900){delete data.eras['2002'];delete data.eras['2005'];text=JSON.stringify(data)}
 if(text.length>2900)throw Error('FUN_MATH_V3_EVIDENCE_TOO_LONG');
 return text;
}
export async function researchV3Candidates(era,{root=DEFAULT_ROOT}={}){
 if(!VALID_ERAS.includes(era))return {state:'INVALID_RULE_ERA',ready:false};
 const snapshot=await researchV3Snapshot({root});
 if(!snapshot.ready)return {state:snapshot.state,ready:false};
 let data;
 try{data=await readBounded(join(root,'candidate_ledger.json'),100,650000)}
 catch{return {state:'CANDIDATES_NOT_AVAILABLE',ready:false}}
 const rows=data?.eras?.[era];
 if(data?.version!=='fun-math-research-v3'||data?.source_sha256!==snapshot.sourceSha256||
  !Array.isArray(rows)||rows.length!==138)return {state:'CANDIDATE_LEDGER_MISMATCH',ready:false};
 const permitted=rows.every(r=>typeof r?.name==='string'&&r.name.length<=160&&
  Number.isFinite(r?.validation_mean_log_gain)&&Number.isFinite(r?.historical_test_mean_log_gain)&&
  Array.isArray(r.terms)&&r.terms.length>=1&&r.terms.length<=2);
 if(!permitted)return {state:'CANDIDATE_ROWS_INVALID',ready:false};
 return {version:V3_VERSION,state:'VERIFIED_CANDIDATE_DIAGNOSTICS_NOT_PROOF',ready:true,
    era,rows:rows.map(r=>({name:txt(r.name,160),
      validationMeanLogGain:r.validation_mean_log_gain,
      historicalTestMeanLogGain:r.historical_test_mean_log_gain,
      validationRankScore:number(r.validation_rank_score)})),
    disclaimer:'These are historical diagnostic scores. The highest historical test rank is not eligible for selection.'};
}