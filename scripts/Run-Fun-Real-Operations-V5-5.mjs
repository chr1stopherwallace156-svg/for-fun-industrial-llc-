// One bounded Fun Industrial FIAL5.5 real operations cycle.
// Does not start models or services and does not send email or file forms.
import {runUnifiedCycle,storeIdentity,readRealStatus,VERSION} from '../src/operator/real-operations-v5-5.mjs';
import {ROOT} from '../src/operator/executive-ops-v1.mjs';
import {join} from 'node:path';
const action=process.argv[2];
try{
 if(action==='--set-local-profile'){
  if(process.argv.length!==4)throw Error('LOCAL_PROFILE_JSON_ARGUMENT_REQUIRED');
  // Profile goes only to LOCALAPPDATA, never GitHub. No account tokens here.
  const provided=JSON.parse(process.argv[3]);
  const r=await storeIdentity(provided);
  console.log('FIAL55_PRIVATE_PROFILE='+r.state);
  console.log('FIAL55_PRIVATE_PROFILE_PATH='+r.path);
 }else if(action==='--once'){
  if(process.argv.length!==3)throw Error('UNEXPECTED_EXTRA_ARGUMENT');
  const r=await runUnifiedCycle({sourceFile:process.env.FIAL55_APPROVED_SOURCE_FILE||null});
  console.log('FIAL55_LOCAL_OPERATIONS='+r.state);
  console.log('FIAL55_REGISTERED_TASKS_ADDED='+r.register.added);
  console.log('FIAL55_BASELINE_WORK_ITEMS='+r.legacy.items);
  console.log('FIAL55_REAL_LOCAL_ARTIFACTS_NEW='+r.real.new_local_artifacts);
  console.log('FIAL55_READONLY_CONFIG='+r.real.config_source.status);
  console.log('FIAL55_WORK_RECEIPT='+join(ROOT(),'RealWorkV55','last-real-cycle.json'));
  console.log('FIAL55_EMAIL_SENT=0 FILINGS_SUBMITTED=0 MONEY_SPENT=0 REA_CALLS=0');
 }else if(action==='--status'){
  if(process.argv.length!==3)throw Error('UNEXPECTED_EXTRA_ARGUMENT');
  const status=await readRealStatus();
  console.log(JSON.stringify({version:VERSION,status:status.state||status.version,
    last_cycle:status.when_utc||null,artifacts:status.artifacts?.length||0,
    external_actions:status.external_actions||'NONE'},null,2));
 }else throw Error('ALLOWED_ARGS=--once|--status|--set-local-profile');
}catch(e){console.error('FIAL55_HOLD='+String(e.message||e).slice(0,220));process.exitCode=1}
