// One-shot synthetic proof of bounded event checkpointing. Never starts a scheduler.
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {IncrementalCheckpointStore} from '../src/resource-aware/incremental-checkpoint.mjs';
const root=await mkdtemp(join(tmpdir(),'fun-raem005-synthetic-'));
const config={root,source:'synthetic_monitor',refreshHours:6,maxRecent:256};
const event=id=>({eventId:'synthetic_'+id,category:'breach_report'});
try {
 const first=new IncrementalCheckpointStore(config);
 const batch1=await first.processBatch({cursor:1,events:[event('a'),event('b'),event('a')],nowMs:1000,operatorApproved:true});
 const early=await first.processBatch({cursor:2,events:[event('c')],nowMs:2000,operatorApproved:true});
 const reopened=new IncrementalCheckpointStore(config);
 const batch2=await reopened.processBatch({cursor:2,events:[event('b'),event('c')],nowMs:21601000,operatorApproved:true});
 const state=await reopened.read();
 const saved=await readFile(join(root,'synthetic_monitor.json'),'utf8');
 const noRawIds=!saved.includes('synthetic_a')&&!saved.includes('synthetic_b')&&!saved.includes('synthetic_c');
 const passed=batch1.state==='PASS'&&batch1.accepted===2&&batch1.duplicates===1&&early.reason==='REFRESH_NOT_DUE'&&batch2.state==='PASS'&&batch2.accepted===1&&batch2.duplicates===1&&state.processedTotal===3&&state.duplicateTotal===2&&noRawIds;
 console.log('RAEM_005_FIRST='+JSON.stringify(batch1));
 console.log('RAEM_005_EARLY='+JSON.stringify(early));
 console.log('RAEM_005_AFTER_REOPEN='+JSON.stringify(batch2));
 console.log('RAEM_005_CHECKPOINT='+JSON.stringify({cursor:state.cursor,processedTotal:state.processedTotal,duplicateTotal:state.duplicateTotal,storedRecentHashes:state.seen.length,nextDueMs:state.nextDueMs,rawEventIdsStored:!noRawIds}));
 console.log('RAEM_005_RESULT='+(passed?'PASS':'FAIL'));
 if(!passed)process.exitCode=1;
} finally {
 await rm(root,{recursive:true,force:true});
 console.log('RAEM_005_END=TEMP_FILES_CLEANED_NO_LIVE_FEEDS_NO_BACKGROUND_SCHEDULER_NO_SERVICE_CHANGES');
}
