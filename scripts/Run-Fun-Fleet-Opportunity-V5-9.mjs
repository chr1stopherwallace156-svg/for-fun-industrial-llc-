// FIAL5.9 CLI: scheduled independent official data checks, read-only diagnostics.
// Does not contact applicants, start models or perform vendor actions.
import {runFleetCycle,readFleetStatus,VERSION} from '../src/fleet/fleet-engine-v5-9.mjs';
try{
 if(process.argv.length!==3||!['--once','--status','--diagnostic'].includes(process.argv[2]))
  throw Error('FIAL59_ALLOWED=--once|--status|--diagnostic');
 const mode=process.argv[2];
 const r=mode==='--once'?await runFleetCycle():await readFleetStatus();
 if(r.version!==VERSION)throw Error('FIAL59_VERSION_MISMATCH');
 if(mode==='--status'){
  console.log(JSON.stringify({version:r.version,state:r.state,counts:r.counts,
   source_states:r.sources?.map(x=>({id:x.id,state:x.state,reason:x.reason||null}))},null,2));
 }else{
  console.log('FIAL59_PROSPECT_SOURCE_STATUS='+r.state);
  console.log('FIAL59_OFFICIAL_SOURCES='+r.counts.official_sources);
  console.log('FIAL59_CHECKED='+r.counts.checked+' HELD='+r.counts.held+
   ' PAGE_CHANGES='+r.counts.published_changes);
  console.log('FIAL59_NAMED_RESEARCH_PROSPECTS='+r.counts.named_prospects);
  console.log('FIAL59_HISTORICAL_APPLICATION_ROWS='+r.counts.listed_application_rows);
  console.log('FIAL59_VERIFIED_OPEN_RFPS=0');
  console.log('FIAL59_AWARDED_CONTRACTS=0');
  console.log('FIAL59_ACTUAL_REVENUE_USD=0');
  console.log('FIAL59_NO_EMAIL_NO_FILINGS_NO_MODEL_NO_REA=TRUE');
  for(const x of r.sources||[])if(x.state==='SOURCE_UNAVAILABLE')
   console.log('FIAL59_SOURCE_HOLD='+x.id+' REASON='+String(x.reason||'unknown').replace(/[\\r\\n]+/g,' ').slice(0,180));
  if(mode==='--diagnostic')for(const p of (r.prospects||[]).slice(0,12))
   console.log('FIAL59_RESEARCH_LEAD='+JSON.stringify({name:p.name,city:p.city,
    buses:p.listed_buses,chargers:p.listed_chargers,pages:p.pdf_pages,
    priority:p.research_priority_points,open_rfp_verified:false,
    document_date:p.source_published_date}));
  console.log('FIAL59_LOCAL_CYCLE_OR_DIAGNOSTIC=PASS');
 }
}catch(e){console.error('FIAL59_HOLD='+String(e.message||e).slice(0,210));process.exitCode=1}
