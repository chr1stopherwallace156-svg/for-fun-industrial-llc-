// Single bounded FIAL5.8 incremental official intelligence cycle.
// Scheduled worker invokes --once. No separate process/server/model required.
import {runRegulatoryCycle,readRegulatoryStatus,VERSION} from '../src/regulatory/intelligence-engine-v5-8.mjs';
try{
 if(process.argv.length!==3||!['--once','--status'].includes(process.argv[2]))
  throw Error('FIAL58_ALLOWED=--once|--status');
 if(process.argv[2]==='--status'){
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
