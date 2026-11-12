// RAEM-013: dry-run by default; an explicit operator approval is required for a local file read.
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {evaluateAdmission} from '../src/resource-aware/raem.mjs';
import {chooseAdaptiveIncidentBudget} from '../src/resource-aware/adaptive-incident-budget.mjs';
import {LocalAilSourceRegistry} from '../src/integrations/ail-source-registry.mjs';
const args=process.argv.slice(2);
const dry=args.length===0||(args.length===1&&args[0]==='--dry-run');
const read=args.length===6&&args[0]==='--source-id'&&args[2]==='--file'&&args[4]==='--sha256';
if(!dry&&!read)throw Error('RAEM013_ARGS_INVALID');
const host=await sampleHost({sampleDelayMs:150});
const prior=evaluateAdmission(host,{id:'ail_metadata_local_source',minimumMiB:64,targetMiB:128,maximumMiB:128});
const grant=chooseAdaptiveIncidentBudget(prior,process.memoryUsage().rss/(1024*1024));
console.log('RAEM_013_PREFLIGHT='+JSON.stringify({mode:dry?'dry-run':'local-source-plan',host,grant}));
if(dry)console.log('RAEM_013_RESULT=DRY_RUN_ONLY');
else{
 const registry=new LocalAilSourceRegistry();
 registry.register({id:args[1],path:args[3],expectedSha256:args[5]});
 console.log('RAEM_013_SOURCES='+JSON.stringify(registry.list()));
 if(grant.state!=='GRANT')console.log('RAEM_013_RESULT=HOLD '+grant.reason);
 else{
  const result=await registry.inspect(args[1],{operatorApproved:true,maxProcessRssMiB:grant.grantedMiB,minimumHostFreeMiB:grant.reserveMiB+64});
  console.log('RAEM_013_SUMMARY='+JSON.stringify(result));
  console.log('RAEM_013_RESULT='+(result.state==='PASS'?'PASS LOCAL_METADATA_ONLY':'HOLD '+result.reason));
 }
}
console.log('RAEM_013_END=NO_FILE_WRITES_NO_NETWORK_NO_BACKGROUND_WORK_NO_SERVICE_CHANGES');
