// FIAL5.13 bounded official-source CLI. --status/--diagnostic never fetch.
import {runBuyerCycle,readBuyerStatus} from '../src/buyers/buyer-engine-v5-13.mjs';
try{
 if(process.argv.length!==3||!['--once','--status','--diagnostic'].includes(process.argv[2]))
  throw Error('FIAL513_CLI_ALLOWED=--once|--status|--diagnostic');
 const mode=process.argv[2];
 const r=mode==='--once'?await runBuyerCycle():await readBuyerStatus();
 if(mode==='--status'){
  console.log(JSON.stringify({version:r.version,state:r.state,
   counts:r.counts,buyer:r.buyer.name,
   sources:r.sources.map(x=>({id:x.id,state:x.display_state,reason:x.reason||null}))},null,2));
 }else{
  console.log('FIAL513_BUYER_EVIDENCE='+r.state);
  console.log('FIAL513_REAL_BUS_OPERATOR='+r.buyer.name);
  console.log('FIAL513_PUBLISHED_SCHOOL_BUSES='+r.buyer.published_total_school_buses);
  console.log('FIAL513_OFFICIAL_SOURCES='+r.counts.official_sources+
   ' RETRIEVED='+r.counts.documents_retrieved+
   ' CURRENT='+r.counts.current_sources+
   ' HOLDS='+r.counts.source_holds);
  console.log('FIAL513_PUBLIC_BUYER_ROUTE='+r.decision.buyer_evidence_state);
  console.log('FIAL513_VERIFIED_OPEN_EV_REPAIR_BIDS='+r.counts.verified_open_repair_bids);
  console.log('FIAL513_VERIFIED_ELECTRIC_BUS_COUNT=NOT_VERIFIED');
  console.log('FIAL513_VERIFIED_CURRENT_SERVICE_NEED=NOT_VERIFIED');
  console.log('FIAL513_CONTACT_APPROVED=NO');
  console.log('FIAL513_CUSTOMER_REVENUE_USD=0');
  console.log('FIAL513_EXTERNAL_EMAIL_CALL_BID_SITE_VISIT_REA_MODEL=ZERO');
  for(const x of r.sources)if(x.state!=='RETRIEVED')
   console.log('FIAL513_SOURCE_HOLD='+x.id+' '+String(x.reason||'source not current').replace(/[\r\n]+/g,' ').slice(0,160));
  if(mode==='--diagnostic')for(const x of r.requirements)
   console.log('FIAL513_UNVERIFIED_GATE='+x);
  console.log('FIAL513_READ_ONLY_BUYER_RESEARCH=PASS')
 }
}catch(e){console.error('FIAL513_HOLD='+String(e.message||e).slice(0,240));process.exitCode=1}
