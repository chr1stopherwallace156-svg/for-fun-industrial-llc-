import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CatalogueSnapshotStore,reconcileCatalogue,readBoundedCatalogueResponse,checkPublicCatalogue,CATALOGUE_URL,CATALOGUE_ATTRIBUTION} from '../src/resource-aware/hibp-catalogue.mjs';
const row=(name,modified='2026-11-10T00:00:00Z')=>({Name:name,Title:'Synthetic '+name,AddedDate:'2026-11-09T00:00:00Z',ModifiedDate:modified,Domain:'example.com',PwnCount:23});
const payload=rows=>new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
async function fixture(t,extra={}){
 const root=await mkdtemp(join(tmpdir(),'raem008-'));
 t.after(async()=>{await rm(root,{recursive:true,force:true});});
 return {root,store:new CatalogueSnapshotStore({root,refreshHours:6,...extra})};
}
const check=(store,nowMs,rows,more={})=>checkPublicCatalogue({store,nowMs,operatorApproved:true,fetchImpl:async()=>payload(rows),...more});
test('initial snapshot baselines catalogue without reporting all existing records as new',async t=>{
 const {store}=await fixture(t);
 const r=await check(store,1000,[row('ExampleOne'),row('ExampleTwo')]);
 assert.equal(r.state,'PASS');assert.equal(r.reason,'CATALOGUE_BASELINED');assert.equal(r.records,2);
 assert.equal(r.newSincePriorBaseline,0);assert.equal(r.baseline,true);assert.equal(r.attribution,CATALOGUE_ATTRIBUTION);
});
test('later snapshots distinguish added modified unchanged and absent records',async t=>{
 const {store}=await fixture(t);
 await check(store,1000,[row('ExampleOne'),row('ExampleTwo'),row('ExampleThree')]);
 const r=await check(store,21601000,[row('ExampleOne','2026-11-11T00:00:00Z'),row('ExampleTwo'),row('ExampleFour')]);
 assert.equal(r.state,'PASS');assert.equal(r.newSincePriorBaseline,1);
 assert.equal(r.modifiedSincePriorBaseline,1);assert.equal(r.unchanged,1);assert.equal(r.absentFromLatestSnapshot,1);
 assert.equal(r.samples.length,2);
});
test('empty catalogue baseline is valid but is not a claim of empty production dataset',async t=>{
 const {store}=await fixture(t);const r=await check(store,1000,[]);
 assert.equal(r.state,'PASS');assert.equal(r.records,0);
});
test('same metadata versions produce zero additions or modifications',async t=>{
 const {store}=await fixture(t);const rows=[row('ExampleOne'),row('ExampleTwo')];
 await check(store,1000,rows);
 const r=await check(store,21601000,rows);
 assert.equal(r.newSincePriorBaseline,0);assert.equal(r.modifiedSincePriorBaseline,0);assert.equal(r.unchanged,2);
});
test('early refresh prevents network access and checkpoint movement',async t=>{
 const {store}=await fixture(t);let calls=0;
 const f=async()=>{calls++;return payload([row('ExampleOne')]);};
 const a=await checkPublicCatalogue({store,nowMs:1000,operatorApproved:true,fetchImpl:f});
 const b=await checkPublicCatalogue({store,nowMs:2000,operatorApproved:true,fetchImpl:f});
 assert.equal(a.state,'PASS');assert.equal(b.reason,'REFRESH_NOT_DUE');assert.equal(b.networkRequests,0);assert.equal(calls,1);
});
test('no authorization never fetches or commits',async t=>{
 const {store}=await fixture(t);let calls=0;
 const r=await checkPublicCatalogue({store,nowMs:1000,fetchImpl:async()=>{calls++;return payload([]);}});
 assert.equal(r.reason,'OPERATOR_APPROVAL_REQUIRED');assert.equal(r.networkRequests,0);assert.equal(calls,0);
 assert.equal((await store.read()).checkedAtMs,null);
});
test('requests fixed provider URL with GET, error-on-redirect and attribution',async t=>{
 const {store}=await fixture(t);
 const f=async(url,opt)=>{assert.equal(url,CATALOGUE_URL);assert.equal(opt.method,'GET');assert.equal(opt.redirect,'error');assert.match(opt.headers['user-agent'],/FunIndustrial-RAEM008/);return payload([row('ExampleOne')]);};
 const r=await checkPublicCatalogue({store,nowMs:1000,operatorApproved:true,fetchImpl:f});
 assert.equal(r.state,'PASS');assert.equal(r.networkRequests,1);assert.equal(r.attribution,CATALOGUE_ATTRIBUTION);
});
test('full checkpoint stores hashed name/version pairs, not titles or names',async t=>{
 const {root,store}=await fixture(t);await check(store,1000,[row('ExamplePrivateMarker')]);
 const disk=await readFile(join(root,'hibp_catalogue_snapshot.json'),'utf8');
 assert.equal(disk.includes('ExamplePrivateMarker'),false);assert.equal(disk.includes('Synthetic ExamplePrivateMarker'),false);
 assert.match(disk,/[0-9a-f]{64}/);
});
test('reopened checkpoint retains baseline for later reconciliation',async t=>{
 const {root,store}=await fixture(t);await check(store,1000,[row('ExampleOne')]);
 const reopened=new CatalogueSnapshotStore({root,refreshHours:6});
 const r=await check(reopened,21601000,[row('ExampleOne'),row('ExampleTwo')]);
 assert.equal(r.baseline,false);assert.equal(r.newSincePriorBaseline,1);assert.equal((await reopened.read()).records.length,2);
});
test('rejects duplicate provider names before saving',async t=>{
 const {store}=await fixture(t);
 const r=await check(store,1000,[row('ExampleOne'),row('ExampleOne')]);
 assert.equal(r.state,'HOLD');assert.equal(r.reason,'PROVIDER_SCHEMA_INVALID');
 assert.equal((await store.read()).checkedAtMs,null);
});
test('rejects malformed provider dates and missing fields',async t=>{
 const {store}=await fixture(t);
 const r=await check(store,1000,[{...row('ExampleOne'),ModifiedDate:'not-a-date'}]);
 assert.equal(r.reason,'PROVIDER_SCHEMA_INVALID');
 assert.equal((await store.read()).records.length,0);
});
test('rejects wrong content type and truncated JSON',async()=>{
 const a=await readBoundedCatalogueResponse(new Response('[]',{status:200,headers:{'content-type':'text/html'}}));
 assert.equal(a.reason,'PROVIDER_CONTENT_TYPE_INVALID');
 const b=await readBoundedCatalogueResponse(new Response('[{',{status:200,headers:{'content-type':'application/json'}}));
 assert.equal(b.reason,'PROVIDER_JSON_INVALID');
});
test('rejects oversized responses without processing records',async()=>{
 const response=new Response('X'.repeat(8*1024*1024+1),{status:200,headers:{'content-type':'application/json'}});
 const r=await readBoundedCatalogueResponse(response);
 assert.equal(r.state,'HOLD');assert.equal(r.reason,'PROVIDER_RESPONSE_TOO_LARGE');
});
test('429/503 errors do not advance the checkpoint',async t=>{
 const {store}=await fixture(t);
 const f=async()=>new Response('{}',{status:429,headers:{'content-type':'application/json'}});
 const r=await checkPublicCatalogue({store,operatorApproved:true,nowMs:1000,fetchImpl:f});
 assert.equal(r.reason,'PROVIDER_RATE_LIMITED');assert.equal((await store.read()).checkedAtMs,null);
});
test('too many records triggers HOLD with configurable limit',async()=>{
 const r=await readBoundedCatalogueResponse(payload([row('ExampleOne'),row('ExampleTwo')]),{maxEntries:1});
 assert.equal(r.reason,'PROVIDER_CATALOGUE_COUNT_INVALID');
});
test('host resource pressure prevents fetch',async t=>{
 const {store}=await fixture(t);let calls=0;
 const r=await checkPublicCatalogue({store,nowMs:1000,operatorApproved:true,maxProcessRssMiB:16,fetchImpl:async()=>{calls++;return payload([]);}});
 assert.equal(r.reason,'RESOURCE_PRESSURE');assert.equal(r.networkRequests,0);assert.equal(calls,0);
});
test('transport errors are HOLD with no checkpoint',async t=>{
 const {store}=await fixture(t);
 const r=await checkPublicCatalogue({store,nowMs:1000,operatorApproved:true,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(r.reason,'PROVIDER_REQUEST_FAILED');assert.equal((await store.read()).checkedAtMs,null);
});
test('tampered checkpoint is held rather than reset',async t=>{
 const {root,store}=await fixture(t);
 await writeFile(join(root,'hibp_catalogue_snapshot.json'),'corrupt');
 await assert.rejects(check(store,1000,[row('ExampleOne')]),/RAEM008_CHECKPOINT_INVALID/);
 assert.equal(await readFile(join(root,'hibp_catalogue_snapshot.json'),'utf8'),'corrupt');
});
test('existing lock blocks state update',async t=>{
 const {root,store}=await fixture(t);const h=await open(join(root,'hibp_catalogue_snapshot.lock'),'wx');
 try{const r=await store.commitCatalogue([row('ExampleOne')],{operatorApproved:true,nowMs:1000});assert.equal(r.reason,'OPERATION_LOCKED');}
 finally{await h.close();}
});
test('malformed configuration and unsorted duplicates are rejected',()=>{
 assert.throws(()=>new CatalogueSnapshotStore({root:'relative'}),/RAEM008_CONFIG_INVALID/);
 assert.throws(()=>reconcileCatalogue([row('ExampleOne'),row('ExampleOne')],[]),/RAEM008_DUPLICATE_PROVIDER_NAME/);
});

test('unexpected catalogue collapse holds without replacing prior checkpoint',async t=>{
 const {store}=await fixture(t);
 const first=await check(store,1000,[row('ExampleOne'),row('ExampleTwo'),row('ExampleThree')]);
 assert.equal(first.state,'PASS');
 const second=await check(store,21601000,[]);
 assert.equal(second.state,'HOLD');assert.equal(second.reason,'CATALOGUE_SUDDEN_SHRINK');
 const state=await store.read();assert.equal(state.records.length,3);assert.equal(state.checkedAtMs,1000);
});
