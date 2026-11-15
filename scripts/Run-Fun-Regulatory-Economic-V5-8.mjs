// Single bounded FIAL5.8 incremental official intelligence cycle.
// Scheduled worker invokes --once. No separate process/server/model required.
import {runRegulatoryCycle,readRegulatoryStatus,VERSION} from '../src/regulatory/intelligence-engine-v5-8.mjs';
try{
 if(process.argv.length!==3||!['--once','--status','--diagnostic'].includes(process.argv[2]))
  throw Error('FIAL581_ALLOWED=--once|--status|--diagnostic');
 if(process.argv[2]==='--diagnostic'){
  const r=await readRegulatoryStatus();
  console.log('FIAL581_MONITOR_STATE='+r.state);
  console.log('FIAL581_CATALOG='+r.source_catalog_version);
  console.log('FIAL581_LAST_CYCLE='+String(r.as_of_utc||'none'));
  console.log('FIAL581_RECORDED_SOURCE_HOLDS='+String(r.counts?.source_holds??'unknown'));
  const held=(r.sources||[]).filter(x=>x.state==='SOURCE_UNAVAILABLE');
  for(const source of held)
   console.log('FIAL581_HELD_SOURCE='+source.id+' REASON='+String(source.reason||'UNKNOWN').replace(/[\r\n]/g,' ')+' URL='+source.source_url);
  if(held.length===0)console.log('FIAL581_HELD_SOURCE_DETAILS=NONE');
  for(const x of r.economic_series||[]){
   const value=Number(x.latest_value);
   console.log('FIAL581_ECONOMIC_SERIES='+x.id+' MONTH='+x.latest_month+
     ' VALUE='+String(x.latest_value)+' UNIT='+x.unit+
     ' SOURCE='+x.source+' VALID_NUMERIC='+Number.isFinite(value));
  }
  for(const warning of r.data_quality_warnings||[])
   console.log('FIAL581_DATA_QUALITY_HOLD='+String(warning).slice(0,150));
  const old=(r.rule_watch||[]).filter(x=>x.id==='acf-state-local-purchasing');
  for(const rule of old)console.log('FIAL581_CURRENT_ACF_PURCHASE_DATE='+rule.effective+
   ' AMENDMENT_APPROVED='+String(rule.amendment_approved||'unknown')+
   ' LEGACY_2027_SUPERSEDED='+String(rule.supersedes==='2027-01-01'));
  console.log('FIAL581_DIAGNOSTIC=COMPLETE_READ_ONLY');
 }else if(process.argv[2]==='--status'){
  const r=await readRegulatoryStatus();
  console.log(JSON.stringify({version:r.version,state:r.state,as_of_utc:r.as_of_utc||null,
   counts:r.counts,latest_economic:r.economic_series?.map(x=>({
    series:x.id,value:x.latest_value,month:x.latest_month}))||[],
   regulatory_watch:r.rule_watch?.slice(0,15).map(x=>({
    id:x.id,year:x.effective,urgency:x.urgency,
    certified_applicability:x.certified_applicability}))||[]},null,2));
 }else{
  const r=await runRegulatoryCycle();
  if(r.version!==VERSION||r.boundaries.emails_sent!==0||
   r.boundaries.automatic_filing!==0||r.boundaries.model_calls!==0||
   r.boundaries.verified_individual_due_dates!==0)
   throw Error('FIAL58_EXTERNAL_AUTHORITY_OR_SCHEMA_INVALID');
  console.log('FIAL58_INCREMENTAL_CYCLE=PASS');
  console.log('FIAL58_SOURCES_CONFIGURED='+r.counts.monitored);
  console.log('FIAL58_SOURCES_FETCHED='+r.counts.refreshed);
  console.log('FIAL58_PUBLISHED_SOURCE_CHANGES='+r.counts.source_changes);
  console.log('FIAL58_SOURCE_HOLDS='+r.counts.source_holds);
  console.log('FIAL58_BLS_ECONOMIC_SERIES='+r.economic_series.length);
  console.log('FIAL58_MILESTONES='+r.timeline.length);
  console.log('FIAL58_NEAR_TERM_MILESTONES='+r.analysis.upcoming_90_day_rule_milestones);
  console.log('FIAL58_VERIFIED_INDIVIDUAL_VEHICLE_DEADLINES=0');
  console.log('FIAL58_EXTERNAL_ACTIONS=ZERO');
 }
}catch(e){console.error('FIAL58_HOLD='+String(e.message||e).slice(0,210));process.exitCode=1}
