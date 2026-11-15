// FIAL5.14 official buyer-purchasing demand vs LEA funding: no side-effects on GET.
import {runDemandCycle,readDemandStatus} from '../src/demand/demand-engine-v5-14.mjs';
try{
 if(process.argv.length!==3||!['--once','--status','--diagnostic'].includes(process.argv[2]))
  throw Error('FIAL514_ALLOWED=--once|--status|--diagnostic');
 const action=process.argv[2],r=action==='--once'?await runDemandCycle():await readDemandStatus();
 if(action==='--status')
  console.log(JSON.stringify({version:r.version,state:r.state,counts:r.counts,
   sources:r.sources.map(x=>({id:x.id,state:x.display_state,reason:x.reason||null})),
   buyer_review:r.active_bid_review,program_event:r.program_event_state},null,2));
 else{
  console.log('FIAL514_STATE='+r.state);
  console.log('FIAL514_SOURCES='+r.counts.official_sources+' CHECKED='+r.counts.checked_this_cycle+
   ' CURRENT='+r.counts.current_sources+' HOLDS='+r.counts.source_holds);
  console.log('FIAL514_BUYER='+r.buyer.name);
  console.log('FIAL514_BCSD_ACTIVE_INDEX_TITLE_HINTS='+r.counts.titles_for_manual_review);
  console.log('FIAL514_VERIFIED_EV_SERVICE_PURCHASE_RFPS='+r.counts.verified_live_ev_repair_rfps);
  console.log('FIAL514_CEC_ZESBI_SECOND='+r.program_event_state);
  console.log('FIAL514_LEA_APPLICATION_START='+r.program.opening_local);
  console.log('FIAL514_VERIFIED_FUNDED_DISTRICT_AWARDS='+r.counts.verified_funded_district_awards);
  console.log('FIAL514_CUSTOMER_PURCHASE_ORDERS='+r.counts.buyer_orders);
  console.log('FIAL514_CUSTOMER_REVENUE_USD='+r.counts.actual_revenue_usd);
  console.log('FIAL514_EMAIL_CALL_BID_VENDOR_GRANT_PAYMENT_MODEL_REA=ZERO');
  for(const x of r.sources)if(x.state!=='RETRIEVED')
   console.log('FIAL514_SOURCE_HOLD='+x.id+' REASON='+String(x.reason||'source review').replace(/[\r\n]+/g,' ').slice(0,160));
  if(action==='--diagnostic'){
   for(const x of r.active_bid_review.possible_relevant_titles)
    console.log('FIAL514_TITLE_ONLY_HUMAN_REVIEW='+JSON.stringify(x));
   for(const x of r.requirements)console.log('FIAL514_UNVERIFIED_GATE='+x)
  }
  console.log('FIAL514_LOCAL_RESEARCH_ONLY=PASS')
 }
}catch(e){console.error('FIAL514_HOLD='+String(e?.message||e).slice(0,220));process.exitCode=1}
