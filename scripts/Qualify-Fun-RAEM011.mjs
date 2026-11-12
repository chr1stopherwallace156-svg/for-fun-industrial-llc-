// RAEM-011: offline operator-report test. No provider requests or file writes.
import {reviewPublicCatalogueResult,HIBP_ATTRIBUTION} from '../src/resource-aware/catalogue-review.mjs';
const base={state:'PASS',reason:'CATALOGUE_BASELINED',baseline:true,records:1051,
 newSincePriorBaseline:0,modifiedSincePriorBaseline:0,unchanged:0,absentFromLatestSnapshot:0,
 samples:[],nextDueMs:1794514731271,attribution:HIBP_ATTRIBUTION,networkRequests:1,receivedBytes:1132288};
const compare={...base,reason:'CATALOGUE_RECONCILED',baseline:false,records:3,
 newSincePriorBaseline:1,modifiedSincePriorBaseline:1,unchanged:1,absentFromLatestSnapshot:1,
 samples:[{type:'added',title:'Synthetic Example',addedDate:'2026-11-09T00:00:00Z',modifiedDate:'2026-11-10T00:00:00Z'}],receivedBytes:500};
const a=reviewPublicCatalogueResult(base),b=reviewPublicCatalogueResult(compare);
console.log('RAEM_011_BASELINE_REVIEW='+JSON.stringify(a));
console.log('RAEM_011_SYNTHETIC_COMPARISON='+JSON.stringify(b));
const ok=a.verdict==='BASELINE_ESTABLISHED'&&a.catalogueRecordCount===1051&&b.verdict==='REVIEW_REQUIRED'&&b.added===1&&b.modified===1&&b.absentFromLatestSnapshot===1&&b.additionalRequestsAuthorized===false;
console.log('RAEM_011_QUALIFICATION='+(ok?'PASS':'FAIL'));
console.log('RAEM_011_END=NO_LIVE_NETWORK_NO_FILES_WRITTEN_NO_BACKGROUND_SCHEDULER_NO_SERVICE_CHANGES');
if(!ok)process.exitCode=1;
