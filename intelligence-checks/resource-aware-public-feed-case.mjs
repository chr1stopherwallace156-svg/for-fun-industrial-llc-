import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {IncrementalCheckpointStore} from '../src/resource-aware/incremental-checkpoint.mjs';
import {PUBLIC_FEED_URL,SOURCE_ATTRIBUTION,normalizePublicBreach,readLimitedPublicResponse,checkLatestPublicBreach} from '../src/resource-aware/hibp-public-feed.mjs';

const mockBreach=()=>({
 Name:'ExampleBreach2026',Title:'Example Security Notice',Domain:'example.com',
 BreachDate:'2026-10-01',AddedDate:'2026-11-11T12:10:00Z',
 ModifiedDate:'2026-11-11T12:10:00Z',PwnCount:1200,
 IsVerified:true,IsFabricated:false
});
const jsonResponse=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'raem007-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 return new IncrementalCheckpointStore({root,source:'hibp_public_latest',refreshHours:6});
}
test('normalizes only limited public breach metadata with source attribution',()=>{
 const b=normalizePublicBreach(mockBreach());
 assert.equal(b.attribution,SOURCE_ATTRIBUTION);assert.equal(b.name,'ExampleBreach2026');
 assert.equal(b.reportedAffectedAccounts,1200);assert.equal(b.isVerified,true);
 assert.match(b.eventId,/^hibp_[0-9a-f]{64}$/);assert.equal('Description' in b,false);
});
test('rejects malformed and missing breach fields',()=>{
 assert.throws(()=>normalizePublicBreach({...mockBreach(),Domain:''}),/SCHEMA_INVALID/);
 assert.throws(()=>normalizePublicBreach({...mockBreach(),PwnCount:'1200'}),/SCHEMA_INVALID/);
 assert.throws(()=>normalizePublicBreach({...mockBreach(),Title:'<img>'}),/SCHEMA_INVALID/);
});
test('rejects HTTP errors and provider 429 without processing content',async()=>{
 const a=await readLimitedPublicResponse(jsonResponse({error:true},429));
 assert.equal(a.state,'HOLD');assert.equal(a.reason,'PROVIDER_RATE_LIMITED');
 const b=await readLimitedPublicResponse(jsonResponse({error:true},503));
 assert.equal(b.reason,'PROVIDER_HTTP_503');
});
test('rejects incorrect content type and oversized responses',async()=>{
 const a=await readLimitedPublicResponse(new Response('{}',{status:200,headers:{'content-type':'text/html'}}));
 assert.equal(a.reason,'PROVIDER_CONTENT_TYPE_INVALID');
 const b=await readLimitedPublicResponse(new Response('X'.repeat(70000),{status:200,headers:{'content-type':'application/json'}}));
 assert.equal(b.reason,'PROVIDER_RESPONSE_TOO_LARGE');
});
test('rejects invalid UTF-8 and JSON',async()=>{
 const a=await readLimitedPublicResponse(new Response(Uint8Array.from([0xff,0x0a]),{status:200,headers:{'content-type':'application/json'}}));
 assert.equal(a.reason,'PROVIDER_JSON_INVALID');
 const b=await readLimitedPublicResponse(new Response('{invalid',{status:200,headers:{'content-type':'application/json'}}));
 assert.equal(b.reason,'PROVIDER_JSON_INVALID');
});
test('refuses redirected responses',async()=>{
 const body=new Response('{}',{headers:{'content-type':'application/json'}}).body;
 const r=await readLimitedPublicResponse({status:200,redirected:true,headers:new Headers({'content-type':'application/json'}),body});
 assert.equal(r.reason,'PROVIDER_REDIRECT_DENIED');
});
test('requires explicit approval before any fetch',async t=>{
 const store=await fixture(t);let calls=0;
 const r=await checkLatestPublicBreach({store,nowMs:1000,fetchImpl:async()=>{calls++;return jsonResponse(mockBreach());}});
 assert.equal(r.state,'HOLD');assert.equal(r.reason,'OPERATOR_APPROVAL_REQUIRED');assert.equal(calls,0);
 assert.equal((await store.read()).cursor,0);
});
test('one manual approved fetch updates checkpoint and includes original attribution',async t=>{
 const store=await fixture(t);let calls=0;
 const fetchImpl=async(url,options)=>{
  calls++;
  assert.equal(url,PUBLIC_FEED_URL);
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  assert.equal(options.headers.accept,'application/json');
  return jsonResponse(mockBreach());
 };
 const result=await checkLatestPublicBreach({store,nowMs:1000,operatorApproved:true,fetchImpl});
 assert.equal(result.state,'PASS');assert.equal(result.networkRequests,1);
 assert.equal(result.checkpointCommitted,true);assert.equal(result.newItems,1);
 assert.equal(result.source,SOURCE_ATTRIBUTION);assert.equal(result.latest.domain,'example.com');
 assert.equal('eventId' in result.latest,false);assert.equal(calls,1);
 assert.equal((await store.read()).cursor,1);
});
test('six-hour refresh hold makes zero network calls',async t=>{
 const store=await fixture(t);let calls=0;
 const fetchImpl=async()=>{calls++;return jsonResponse(mockBreach());};
 await checkLatestPublicBreach({store,nowMs:1000,operatorApproved:true,fetchImpl});
 const r=await checkLatestPublicBreach({store,nowMs:2000,operatorApproved:true,fetchImpl});
 assert.equal(r.reason,'REFRESH_NOT_DUE');assert.equal(r.networkRequests,0);assert.equal(calls,1);
});
test('later same latest breach is deduplicated and checkpointed',async t=>{
 const store=await fixture(t);
 const fetchImpl=async()=>jsonResponse(mockBreach());
 await checkLatestPublicBreach({store,nowMs:1000,operatorApproved:true,fetchImpl});
 const r=await checkLatestPublicBreach({store,nowMs:21601000,operatorApproved:true,fetchImpl});
 assert.equal(r.state,'PASS');assert.equal(r.newItems,0);assert.equal(r.duplicates,1);
 assert.equal((await store.read()).processedTotal,1);
});
test('changed metadata version is recognized as a new fingerprint',async t=>{
 const store=await fixture(t);
 await checkLatestPublicBreach({store,nowMs:1000,operatorApproved:true,fetchImpl:async()=>jsonResponse(mockBreach())});
 const changed={...mockBreach(),ModifiedDate:'2026-11-12T12:10:00Z'};
 const r=await checkLatestPublicBreach({store,nowMs:21601000,operatorApproved:true,fetchImpl:async()=>jsonResponse(changed)});
 assert.equal(r.newItems,1);assert.equal((await store.read()).processedTotal,2);
});
test('malformed remote response does not advance checkpoint',async t=>{
 const store=await fixture(t);
 const r=await checkLatestPublicBreach({store,nowMs:1000,operatorApproved:true,fetchImpl:async()=>jsonResponse({not:'a breach'})});
 assert.equal(r.state,'HOLD');assert.equal(r.reason,'PROVIDER_SCHEMA_INVALID');assert.equal((await store.read()).cursor,0);
});
test('resource pressure prevents network access',async t=>{
 const store=await fixture(t);let calls=0;
 const r=await checkLatestPublicBreach({store,nowMs:1000,operatorApproved:true,maxProcessRssMiB:16,fetchImpl:async()=>{calls++;return jsonResponse(mockBreach());}});
 assert.equal(r.state,'HOLD');assert.equal(r.reason,'RESOURCE_PRESSURE');assert.equal(r.networkRequests,0);assert.equal(calls,0);
});
test('transport failure is a hold and does not checkpoint',async t=>{
 const store=await fixture(t);
 const r=await checkLatestPublicBreach({store,nowMs:1000,operatorApproved:true,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(r.reason,'PROVIDER_REQUEST_FAILED');assert.equal((await store.read()).cursor,0);
});
test('restricts adapter options and requires a checkpoint store',async()=>{
 await assert.rejects(checkLatestPublicBreach({store:{},operatorApproved:true}),/INPUT_INVALID/);
});
