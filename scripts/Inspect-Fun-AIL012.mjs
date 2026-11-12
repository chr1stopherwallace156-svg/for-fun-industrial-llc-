// RAEM-012: opt-in bounded local metadata-file read; default is no-file dry-run.
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {evaluateAdmission} from '../src/resource-aware/raem.mjs';
import {chooseAdaptiveIncidentBudget} from '../src/resource-aware/adaptive-incident-budget.mjs';
import {analyzeAilMetadataFile} from '../src/integrations/ail-ndjson.mjs';
import {AIL_METADATA_API_PATH} from '../src/integrations/ail-metadata.mjs';
const args=process.argv.slice(2);
const dry=args.length===0||args.length===1&&args[0]==='--dry-run';
const read=args.length===3&&args[0]==='--file'&&args[2]==='--approved-readonly';
if(!dry&&!read)throw Error('RAEM012_ARGS_INVALID_DRY_RUN_OR_EXPLICIT_FILE_ONLY');
const snapshot=await sampleHost({sampleDelayMs:150});
const prior=evaluateAdmission(snapshot,{id:'ail_metadata_local_file',minimumMiB:64,targetMiB:128,maximumMiB:128});
const granted=chooseAdaptiveIncidentBudget(prior,process.memoryUsage().rss/(1024*1024));
console.log('RAEM_012_PREFLIGHT='+JSON.stringify({mode:dry?'dry-run':'local-approved',snapshot,granted,ailApiShape:AIL_METADATA_API_PATH}));
if(dry){
 console.log('RAEM_012_RESULT=DRY_RUN_ONLY NO_FILE_READ_NO_NETWORK_NO_CHANGES');
}else if(granted.state!=='GRANT'){
 console.log('RAEM_012_RESULT=HOLD '+granted.reason);
}else{
 const result=await analyzeAilMetadataFile(args[1],{maxProcessRssMiB:granted.grantedMiB,minimumHostFreeMiB:granted.reserveMiB+64});
 console.log('RAEM_012_SUMMARY='+JSON.stringify(result));
 console.log('RAEM_012_RESULT='+(result.state==='PASS'?'PASS METADATA_ONLY':'HOLD '+result.reason));
}
console.log('RAEM_012_END=NO_AIL_SERVER_NO_HTTP_NO_BACKGROUND_RUNNER_NO_SERVICE_CHANGES');
