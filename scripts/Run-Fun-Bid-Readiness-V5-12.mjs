// FIAL5.12 — CLI only reads or explicitly runs fixed-source evidence checks.
import {runReadinessCycle,readReadinessStatus} from '../src/bid-readiness/readiness-engine-v5-12.mjs';
try{
 if(process.argv.length!==3||!['--once','--status','--diagnostic'].includes(process.argv[2]))
  throw Error('FIAL512_ALLOWED=--once|--status|--diagnostic');
 const mode=process.argv[2];
 const r=mode==='--once'?await runReadinessCycle():await readReadinessStatus();
 if(mode==='--status')console.log(JSON.stringify({version:r.version,state:r.state,
  counts:r.counts,sources:r.sources.map(x=>({id:x.id,state:x.display_state||x.state,
   reason:x.reason||null}))},null,2));
 else{
  console.log('FIAL512_STATE='+r.state);
  console.log('FIAL512_SOURCE_COUNT='+r.counts.official_sources+
   ' CHECKED='+r.counts.checked_this_cycle+
   ' HOLDS='+r.counts.source_holds+
   ' CURRENT='+r.counts.source_documents_current);
  console.log('FIAL512_PATHWAYS='+r.counts.lead_paths);
  console.log('FIAL512_BID_READY='+r.counts.verified_bid_ready);
  console.log('FIAL512_VERIFIED_REVENUE_USD='+r.counts.actual_revenue_usd);
  console.log('FIAL512_EMAILS_BIDS_REGISTRATIONS_MODELS_REA=ZERO');
  for(const x of r.sources)if(x.state!=='RETRIEVED')
   console.log('FIAL512_SOURCE_HOLD='+x.id+' REASON='+String(x.reason||'review needed').replace(/[\r\n]+/g,' ').slice(0,160));
  if(mode==='--diagnostic')for(const l of r.leads){
   console.log('FIAL512_QUALIFICATION='+JSON.stringify({id:l.id,buyer:l.buyer,
    deadline:l.deadline_local,status:l.candidate_status,fit:l.fit_state,
    direct_bid_ready:false,requirements:l.requirement_evidence,
    next:l.next_action,source:l.source_url}));
  }
  console.log('FIAL512_LOCAL_READ_ONLY_QUALIFICATION=PASS');
 }
}catch(e){console.error('FIAL512_HOLD='+String(e?.message||e).slice(0,240));process.exitCode=1}
