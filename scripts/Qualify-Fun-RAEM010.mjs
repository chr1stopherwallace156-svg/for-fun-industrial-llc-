// One-time offline round-trip check: only disposable synthetic local files are written.
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CatalogueSnapshotStore} from '../src/resource-aware/hibp-catalogue.mjs';
import {inspectCatalogueCheckpoint} from '../src/resource-aware/catalogue-checkpoint-report.mjs';
const parent=await mkdtemp(join(tmpdir(),'raem010-'));
const root=join(parent,'checkpoint');
const row=(name)=>({Name:name,Title:'Synthetic '+name,AddedDate:'2026-11-09T00:00:00Z',ModifiedDate:'2026-11-10T00:00:00Z'});
try{
 const store=new CatalogueSnapshotStore({root,refreshHours:6});
 const baseline=await store.commitCatalogue([row('SyntheticOne'),row('SyntheticTwo')],{nowMs:1000,operatorApproved:true});
 const before=await inspectCatalogueCheckpoint(root,{nowMs:2000});
 const after=await inspectCatalogueCheckpoint(root,{nowMs:21601000});
 const success=baseline.state==='PASS'&&baseline.baseline===true&&before.state==='PRESENT'&&before.baselineRecordCount===2&&before.eligibleNow===false&&after.eligibleNow===true&&before.checkpointSha256===after.checkpointSha256;
 console.log('RAEM_010_TEST_BASELINE='+JSON.stringify({state:baseline.state,records:baseline.records}));
 console.log('RAEM_010_TEST_STATUS_BEFORE='+JSON.stringify(before));
 console.log('RAEM_010_TEST_STATUS_AFTER='+JSON.stringify(after));
 console.log('RAEM_010_QUALIFICATION='+(success?'PASS':'FAIL'));
 if(!success)process.exitCode=1;
}finally{
 await rm(parent,{recursive:true,force:true});
 console.log('RAEM_010_TEST_END=TEMP_CLEANUP_NO_PROVIDER_REQUESTS_NO_SERVICE_CHANGES');
}
