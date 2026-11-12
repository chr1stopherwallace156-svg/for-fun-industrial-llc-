// RAEM-010 read-only operational status; does not authorize a second live request.
import {join} from 'node:path';
import {homedir} from 'node:os';
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {evaluateLivePilotReadiness} from '../src/resource-aware/catalogue-live-gate.mjs';
import {inspectCatalogueCheckpoint} from '../src/resource-aware/catalogue-checkpoint-report.mjs';
const flags=process.argv.slice(2);
if(flags.length>1||(flags.length===1&&!['--status','--dry-run'].includes(flags[0])))throw Error('RAEM010_STATUS_ONLY_NO_LIVE_MODE');
const localAppData=process.env.LOCALAPPDATA||join(homedir(),'AppData','Local');
const root=join(localAppData,'FunIndustrial','RAEM009PublicCatalogue');
const snapshot=await sampleHost({sampleDelayMs:200});
const admission=evaluateLivePilotReadiness(snapshot,process.memoryUsage().rss/(1024*1024));
const checkpoint=await inspectCatalogueCheckpoint(root);
console.log('RAEM_010_RESOURCE_STATUS='+JSON.stringify({snapshot,admission}));
console.log('RAEM_010_CHECKPOINT='+JSON.stringify(checkpoint));
const eligibility=checkpoint.state==='PRESENT'&&checkpoint.eligibleNow?'ELIGIBLE_FOR_SEPARATELY_AUTHORIZED_CHECK':checkpoint.state==='PRESENT'?'REFRESH_NOT_DUE':'CHECKPOINT_NOT_READY';
console.log('RAEM_010_ELIGIBILITY='+eligibility);
console.log('RAEM_010_RESULT='+(checkpoint.state==='PRESENT'?'PASS READ_ONLY':'HOLD '+checkpoint.reason));
console.log('RAEM_010_END=NO_NETWORK_NO_WRITES_NO_BACKGROUND_SCHEDULER_NO_SERVICE_CHANGES');
