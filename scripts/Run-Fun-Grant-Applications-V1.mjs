// FUN_REAL_GRANTS_CYCLE_V1. Explicit one-cycle runner; Windows Task Scheduler owns cadence.
import {runOpportunityCycle,VERSION} from '../src/applications/opportunity-worker-v1.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
const root=join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial','RealApplicationWorkerV1');
if(process.argv.length!==3||process.argv[2]!=='--once'){
 console.log('FUN_GRANTS_WORKER=INACTIVE; --once REQUIRED; no passive agent started');
}else{
 const started=Date.now();
 try{
  const report=await runOpportunityCycle({directory:root});
  if(report.version!==VERSION||report.submitted_applications!==0)throw Error('WORKER_AUTHORITY_ATTESTATION_FAILED');
  console.log('FUN_REAL_GRANTS_LIVE_SCAN=PASS SOURCE='+report.official_source);
  console.log('FUN_GRANTS_ROWS_SCANNED='+report.records_scanned);
  console.log('FUN_GRANTS_OPEN_BUSINESS_CANDIDATES='+report.open_business_opportunities);
  console.log('FUN_GRANTS_RELEVANT_CANDIDATES='+report.relevant_candidates);
  console.log('FUN_GRANTS_DRAFT_FILES_CREATED='+report.new_editable_drafts);
  console.log('FUN_GRANTS_SOURCE_SHA256='+report.source_sha256);
  console.log('FUN_GRANTS_REPORT='+join(root,'last-run.json'));
  console.log('FUN_GRANTS_PROFILE='+report.profile_file);
  for(const draft of report.available_drafts)console.log('FUN_GRANT_DRAFT='+draft.path);
  console.log('FUN_GRANTS_OUTBOUND_ACTIONS=OFFICIAL_SOURCE_GET_ONLY');
  console.log('FUN_GRANTS_APPLICATION_SUBMISSIONS=0 REAL_AWARD_OR_ELIGIBILITY_NOT_CLAIMED');
  console.log('FUN_GRANTS_RUN_DURATION_MS='+(Date.now()-started));
 }catch(e){
  await mkdir(root,{recursive:true});
  const msg=String(e?.message||e).slice(0,280);
  await writeFile(join(root,'last-error.txt'),new Date().toISOString()+' '+msg+'\n');
  console.error('FUN_REAL_GRANTS_HOLD='+msg);
  process.exitCode=1;
 }
}
