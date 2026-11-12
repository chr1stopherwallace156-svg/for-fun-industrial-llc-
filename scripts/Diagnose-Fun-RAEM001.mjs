// Read-only diagnostic; does not start AIL, REA, Qwen, compute, or scheduler jobs.
import {sampleHost} from '../src/resource-aware/host-snapshot.mjs';
import {ResourceAwareManager} from '../src/resource-aware/raem.mjs';
const snapshot=await sampleHost();
const manager=new ResourceAwareManager();
manager.register({id:'ail_public_monitor',minimumMiB:256,targetMiB:1024,maximumMiB:4096,refreshHours:6});
const evaluation=manager.plan(snapshot,0)[0];
console.log('RAEM_001_DIAGNOSTIC=PASS_OBSERVATIONAL');
console.log('HOST_SNAPSHOT='+JSON.stringify(snapshot));
console.log('POLICY_DECISION='+JSON.stringify(evaluation));
console.log('JOB_EXECUTION=NONE OPERATOR_APPROVAL=NOT_GRANTED EXISTING_SERVICES_UNCHANGED=TRUE');
