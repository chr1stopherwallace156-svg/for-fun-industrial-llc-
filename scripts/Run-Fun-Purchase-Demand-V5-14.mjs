// FIAL5.14 — one explicit bounded source refresh or no-fetch diagnostics.
import {runDemandCycle,readDemandStatus} from '../src/demand/demand-engine-v5-14.mjs';
try{
 if(process.argv.length!==3||!['--once','--status','--diagnostic'].includes(process.argv[2]))
  throw Error('FIAL514_CLI_ALLOWED=--once|--status|--diagnostic');
 const mode=process.argv[2];
 const r=mode==='--once'?await runDemandCycle():await readDemandStatus();
 if(mode==='--status')console.log(JSON.stringify({
  version:r.version,state:r.state,counts:r.counts,
  sources:r.sources.map(x=>({id:x.id,state:x.display_state||x.state,
   reason:x.reason||null}))},null,2));
 else{
  console.log('FIAL514_DEMAND_STATE='+r.state);
  console.log('FIAL514_OFFICIAL_ISSUER='+r.notice.issuer);
  console.log('FIAL514_CONSTRUCTION_IFB='+r.notice.solicitation);
  console.log('FIAL514_PUBLISHED_CLOSING='+r.notice.published_close_local);
  console.log('FIAL514_OFFICIAL_SOURCES='+r.counts.official_sources+
   ' CHECKED='+r.counts.checked_this_cycle+
   ' RETRIEVED='+r.counts.documents_retrieved+
   ' CURRENT='+r.counts.current_source_docs+
   ' HOLDS='+r.counts.source_holds);
  console.log('FIAL514_FUTURE_MAINTENANCE_INTENT='+r.classification.future_service_evidence_state);
  console.log('FIAL514_DOCUMENTED_FUTURE_SERVICE_INTENTS='+r.counts.documented_future_service_intents);
  console.log('FIAL514_CURRENT_MAINTENANCE_RFPS_VERIFIED=0');
  console.log('FIAL514_ELEKTRON_BID_READY=NO');
  console.log('FIAL514_CONTRACT_AWARDS_AND_REVENUE=ZERO');
  console.log('FIAL514_EMAIL_CALL_BID_VENDOR_REA_MODEL=ZERO');
  for(const x of r.sources)if(x.state!=='RETRIEVED')
   console.log('FIAL514_SOURCE_HOLD='+x.id+' '+String(x.reason||'not current').replace(/[\r\n]+/g,' ').slice(0,170));
  if(mode==='--diagnostic'){
   console.log('FIAL514_ADDENDUM_Q13='+r.notice.addendum_q13);
   console.log('FIAL514_DIRECT_GENERAL_PRIME_LICENSE='+r.notice.prime_classification_addendum_q5);
   for(const q of r.qualification_gates)
    console.log('FIAL514_UNVERIFIED_GATE='+q);
  }
  console.log('FIAL514_READ_ONLY_PURCHASING_INTENT=PASS')
 }
}catch(e){console.error('FIAL514_HOLD='+String(e.message||e).slice(0,230));process.exitCode=1}
