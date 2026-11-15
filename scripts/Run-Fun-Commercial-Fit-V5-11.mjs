// FIAL5.11 CLI: bounded official source GETs only, no external actions.
import {runFitCycle,readFitStatus} from '../src/fit/commercial-fit-engine-v5-11.mjs';
try{
 if(process.argv.length!==3||!['--once','--status','--diagnostic'].includes(process.argv[2]))
  throw Error('FIAL511_ALLOWED=--once|--status|--diagnostic');
 const mode=process.argv[2];
 const r=mode==='--once'?await runFitCycle():await readFitStatus();
 if(mode==='--status')console.log(JSON.stringify({
  version:r.version,state:r.state,counts:r.counts,
  sources:r.sources.map(x=>({id:x.id,state:x.live_state||x.state,reason:x.reason||null}))
 },null,2));
 else{
  console.log('FIAL511_QUALIFICATION='+r.state);
  console.log('FIAL511_OFFICIAL_SOURCES='+r.counts.offical_source_count);
  console.log('FIAL511_SOURCES_CHECKED='+r.counts.checked_this_cycle+
   ' SOURCE_HOLDS='+r.counts.official_source_holds);
  console.log('FIAL511_NAMED_COMMERCIAL_ROUTES='+r.counts.named_programs);
  console.log('FIAL511_DIRECTLY_QUALIFIED_BIDS='+r.counts.directly_qualified_bids);
  console.log('FIAL511_CONFIRMED_REVENUE_USD='+r.counts.actual_revenue_usd);
  console.log('FIAL511_BIDS_APPLICATIONS_EMAIL_REA_MODEL=ZERO');
  for(const x of r.sources)if(x.state!=='RETRIEVED')
   console.log('FIAL511_SOURCE_HOLD='+x.id+' '+String(x.reason||'changed').replace(/[\\r\\n]+/g,' ').slice(0,150));
  if(mode==='--diagnostic')for(const x of r.opportunities)
   console.log('FIAL511_FIT='+JSON.stringify({id:x.id,issuer:x.issuer,program:x.program_id,
    kind:x.kind,due:x.deadline_local,readiness:x.readiness_state,
    official_source_state:x.current_published_document_state,
    direct_eligible:false,partner_role:x.fit,requirements:x.eligibility_gates}));
  console.log('FIAL511_READ_ONLY_COMMERICAL_FIT=PASS');
 }
}catch(e){console.error('FIAL511_HOLD='+String(e?.message||e).slice(0,220));process.exitCode=1}
