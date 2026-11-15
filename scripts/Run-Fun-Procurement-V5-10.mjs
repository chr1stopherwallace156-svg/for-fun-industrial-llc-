// FIAL5.10: one official issuer + PDF evidence check, local bounded cache.
import {runProcurementCycle,readProcurementStatus} from '../src/procurement/procurement-engine-v5-10.mjs';
try{
 if(process.argv.length!==3||!['--once','--status','--diagnostic'].includes(process.argv[2]))
  throw Error('FIAL510_CLI_ALLOWED=--once|--status|--diagnostic');
 const mode=process.argv[2];
 const r=mode==='--once'?await runProcurementCycle():await readProcurementStatus();
 if(mode==='--status')console.log(JSON.stringify({version:r.version,state:r.state,counts:r.counts,
  notice:r.notice,source_states:r.sources.map(x=>({id:x.id,state:x.state,reason:x.reason||null}))},null,2));
 else{
  console.log('FIAL510_STATE='+r.state);
  console.log('FIAL510_SOLICITATION_ID='+r.notice.solicitation_id);
  console.log('FIAL510_DUE_LOCAL='+r.notice.due_local);
  console.log('FIAL510_OFFICIAL_SOURCE_CHECKS='+r.counts.official_source_checks+
   ' HOLDS='+r.counts.official_source_holds+
   ' CHANGED_NEEDS_REVIEW='+r.counts.changed_sources_requiring_review);
  console.log('FIAL510_PUBLISHED_FUTURE_DEADLINE_NOTICES='+r.counts.verified_current_published_notices);
  console.log('FIAL510_VENDOR_FIT_VERIFIED='+r.counts.verified_fit_for_elektron);
  console.log('FIAL510_RFPS_SUBMITTED='+r.boundaries.actual_rfps_submitted+
   ' REA='+r.boundaries.rea_calls+' MODEL='+r.boundaries.model_calls+
   ' SALES_REVENUE='+r.boundaries.revenue_usd);
  for(const x of r.sources)if(x.state!=='FETCHED')
   console.log('FIAL510_SOURCE_HOLD='+x.id+' REASON='+String(x.reason||'source pending review').replace(/[\r\n]/g,' ').slice(0,170));
  if(mode==='--diagnostic'){
   console.log('FIAL510_PUBLISHED_NOTICE='+JSON.stringify(r.notice));
   console.log('FIAL510_OPEN_VIA_BUYER_PORTAL=UNVERIFIED_REVIEW_REQUIRED');
   console.log('FIAL510_ELEKTRON_ROLE=NOT_DIRECT_TRANSPORT_PROVIDER_VERIFIED');
  }
  console.log('FIAL510_READ_ONLY_PROCUREMENT=PASS');
 }
}catch(e){console.error('FIAL510_HOLD='+String(e?.message||e).slice(0,230));process.exitCode=1}
