import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SOURCES,BUYER,GATES,BOUNDARIES,decision} from '../src/buyers/buyer-catalog-v5-13.mjs';
import {runBuyerCycle,readBuyerStatus,verifyBuyerRecord,VERSION,DIRECTORY,FILENAME} from '../src/buyers/buyer-engine-v5-13.mjs';
const NOW=new Date('2026-11-15T08:00:00.000Z');
function mock({fail='',changed=false,redirect=false,remove=false,oversized=false,wrongType=false}={}){
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,method:opts.method,redirect:opts.redirect});
  if(fail&&url.includes(fail))throw Error('TEST_OFFICIAL_NOT_AVAILABLE');
  if(redirect)return Response.redirect('https://example.invalid',302);
  const s=SOURCES.find(x=>x.url===url);
  const text='<!doctype html><html><body>'+s.facts.join(' ; ')+
   (changed?' Updated agency page':'')+(remove?' [removed facts]':'')+'</body></html>';
  const body=oversized?text+'x'.repeat(700000):remove?'<!doctype html><html><body>none of the listed evidence</body></html>':text;
  return new Response(body,{status:200,headers:{'content-type':wrongType?'application/json':'text/html'}})
 };return {fetcher,calls}
}
async function temp(fn){
 const root=await mkdtemp(join(tmpdir(),'fial513-'));
 try{await fn(root)}finally{await rm(root,{force:true,recursive:true})}
}
test('official BCSD school transportation, purchasing, vendor policy and real ZESBI costs form distinct proof sources',()=>{
 assert.equal(SOURCES.length,4);
 assert.equal(new Set(SOURCES.map(x=>x.id)).size,4);
 assert.ok(SOURCES.slice(0,3).every(x=>x.host==='www.bcsd.com'));
 assert.equal(BUYER.name,'Bakersfield City School District');
 assert.equal(BUYER.published_total_school_buses,161);
 assert.equal(BUYER.ev_bus_count_verified,null);
 assert.equal(BUYER.actual_current_need_verified,false);
 assert.equal(BUYER.open_ev_service_solicitation_verified,false);
 assert.equal(BUYER.elektron_vendor_approved,false);
 assert.equal(BUYER.customer_revenue_usd,0);
});
test('published transportation fleet plus purchasing policy is one verified *buyer path*, not one verified sales lead',()=>{
 const d=decision({fleet:true,bids:true,vendor:true,zesbi:true});
 assert.equal(d.buyer_evidence_state,'PUBLIC_FLEET_OPERATOR_AND_PURCHASING_ROUTE_VERIFIED');
 assert.equal(d.current_need_status,'NOT_VERIFIED');
 assert.equal(d.direct_bid_ready,false);
 assert.equal(d.contact_approved,false);
 assert.equal(d.awarded_ze_bus_program_verified,false);
 assert.equal(decision({fleet:true,bids:true}).vendor_route_publicly_documented,false);
 assert.equal(BOUNDARIES.phone_calls_placed,0);
 assert.ok(GATES.some(x=>x.includes('GET_OFFICIAL_PURCHASE_ORDER')));
});
test('first real-format four-source observation creates no invented purchase order or existing awarded district grant',async()=>temp(async root=>{
 const x=mock(),r=await runBuyerCycle({root,now:NOW,fetcher:x.fetcher});
 assert.equal(r.version,VERSION);
 assert.equal(r.sources.length,4);
 assert.equal(r.counts.documents_retrieved,4);
 assert.equal(r.counts.verified_public_buyer_pathways,1);
 assert.equal(r.decision.buyer_evidence_state,'PUBLIC_FLEET_OPERATOR_AND_PURCHASING_ROUTE_VERIFIED');
 assert.equal(r.counts.verified_open_repair_bids,0);
 assert.equal(r.counts.verified_contact_permission,0);
 assert.equal(r.boundaries.emails_sent,0);
 assert.equal(r.boundaries.rea_calls,0);
 assert.equal(r.boundaries.site_visits,0);
 assert.ok(x.calls.every(y=>y.method==='GET'&&y.redirect==='manual'));
 assert.equal(verifyBuyerRecord(r),true);
 const read=await readBuyerStatus({root,now:NOW});
 assert.equal(read.counts.current_sources,4);
}));
test('incremental TTL avoids extra checks even when content would have changed',async()=>temp(async root=>{
 await runBuyerCycle({root,now:NOW,fetcher:mock().fetcher});
 const f=mock({changed:true});
 const next=await runBuyerCycle({root,now:new Date(+NOW+3600000),fetcher:f.fetcher});
 assert.equal(f.calls.length,0);
 assert.equal(next.counts.checked_this_cycle,0);
 assert.equal(next.counts.current_sources,4)
}));
test('a removed official fleet fact causes buyer qualification HOLD, not a guessed 161-bus confirmation',async()=>temp(async root=>{
 const r=await runBuyerCycle({root,now:NOW,fetcher:mock({fail:'/transportation'}).fetcher});
 assert.equal(r.counts.source_holds,1);
 assert.equal(r.counts.verified_public_buyer_pathways,0);
 assert.equal(r.decision.buyer_evidence_state,'PUBLIC_BUYER_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED');
 assert.equal(r.sources[0].state,'HOLD');
 assert.equal(r.counts.verified_open_repair_bids,0)
}));
test('ZESBI source downtime does not invent a funding award and does not invalidate independent BCSD buyer',async()=>temp(async root=>{
 const r=await runBuyerCycle({root,now:NOW,fetcher:mock({fail:'californiazesbi'}).fetcher});
 assert.equal(r.counts.source_holds,1);
 assert.equal(r.counts.verified_public_buyer_pathways,1);
 assert.equal(r.decision.zesbi_eligible_cost_category_publicly_documented,false);
 assert.equal(r.decision.awarded_ze_bus_program_verified,false)
}));
test('changed issuer source stays human-review HOLD even when subsequent bytes stop changing',async()=>temp(async root=>{
 await runBuyerCycle({root,now:NOW,fetcher:mock().fetcher});
 const changed=await runBuyerCycle({root,now:new Date(+NOW+80*3600000),
   fetcher:mock({changed:true}).fetcher});
 assert.equal(changed.counts.source_holds,4);
 assert.equal(changed.counts.verified_public_buyer_pathways,0);
 assert.ok(changed.sources.every(x=>x.state==='CHANGED_REQUIRES_REVIEW'));
 const onceMore=await runBuyerCycle({root,now:new Date(+NOW+81*3600000),
  fetcher:mock({changed:true}).fetcher});
 assert.equal(onceMore.counts.source_holds,4)
}));
test('invalid content type and external redirect do not create buyer evidence',async()=>temp(async root=>{
 const r=await runBuyerCycle({root,now:NOW,fetcher:mock({redirect:true}).fetcher});
 assert.equal(r.counts.documents_retrieved,0);
 assert.equal(r.counts.verified_public_buyer_pathways,0);
 assert.equal(r.counts.source_holds,4)
}));
test('source byte cap protects the PC from oversized public pages',async()=>temp(async root=>{
 const r=await runBuyerCycle({root,now:NOW,fetcher:mock({oversized:true}).fetcher});
 assert.equal(r.counts.documents_retrieved,0);
 assert.equal(r.counts.verified_public_buyer_pathways,0);
 assert.equal(r.counts.source_holds,4)
}));
test('time-based source freshness drops buyer proof without external refresh or model calls',async()=>temp(async root=>{
 await runBuyerCycle({root,now:NOW,fetcher:mock().fetcher});
 const stale=await readBuyerStatus({root,now:new Date(+NOW+15*24*3600000)});
 assert.equal(stale.counts.current_sources,0);
 assert.equal(stale.counts.verified_public_buyer_pathways,0);
 assert.equal(stale.decision.direct_bid_ready,false)
}));
test('tampered licensing, public fleet or claimed contract revenue fails closed; altered source hash detected',async()=>temp(async root=>{
 const orig=await runBuyerCycle({root,now:NOW,fetcher:mock().fetcher});
 const path=join(root,DIRECTORY,FILENAME);
 for(const r of [
  {...orig,buyer:{...orig.buyer,elektron_vendor_approved:true}},
  {...orig,buyer:{...orig.buyer,ev_bus_count_verified:44}},
  {...orig,buyer:{...orig.buyer,published_total_school_buses:190}},
  {...orig,counts:{...orig.counts,verified_service_orders:1}},
  {...orig,boundaries:{...orig.boundaries,emails_sent:1}},
  {...orig,decision:{...orig.decision,contact_approved:true}}
 ]){
  await writeFile(path,JSON.stringify(r));
  await assert.rejects(readBuyerStatus({root,now:NOW}),/FIAL513/);
 }
 await writeFile(path,JSON.stringify(orig));
 const s=orig.sources[0],f=join(root,DIRECTORY,s.id+'-'+s.sha256.slice(0,24)+'.html');
 await writeFile(f,'FAKE CHANGED CONTENT');
 await assert.rejects(readBuyerStatus({root,now:NOW}),/EVIDENCE_HASH_MISMATCH/)
}));
test('not activated returns only static historical buyer notes, no live proof of current need',async()=>temp(async root=>{
 const r=await readBuyerStatus({root,now:NOW});
 assert.equal(r.state,'NOT_ACTIVATED');
 assert.equal(r.counts.verified_public_buyer_pathways,0);
 assert.equal(r.counts.verified_open_repair_bids,0);
 assert.equal(r.decision.current_need_status,'NOT_VERIFIED')
}));
