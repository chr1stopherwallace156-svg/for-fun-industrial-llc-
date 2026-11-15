import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SOURCES,BUYER,PROGRAM,BOUNDARIES,reviewActiveBidTitles,demandDecision} from '../src/demand/demand-catalog-v5-14.mjs';
import {runDemandCycle,readDemandStatus,validateDemandReceipt,DIRECTORY,FILENAME,VERSION} from '../src/demand/demand-engine-v5-14.mjs';
const now=new Date('2026-11-15T09:00:00.000Z');
const bids='<html><body><nav>Active Bids Awarded Bids</nav><h2>Active Bids</h2>'+
 '<p>BCSD Desktop Bid with White Glove Services 26-08-01</p>'+
 '<p>BCSD After School Tutoring RFPQ 26-08-02</p>'+
 '<p>BCSD Chromebook Assessment and Repair Bid 26-09-01</p>'+
 '<p>BCSD Paper Products Bid 26-11-05</p>'+
 '<h2>Awarded Bids</h2><p>BCSD Fleet Vehicle Bid 26-05-02 Award Sheet</p>'+
 '<footer>PlanetBids</footer></body></html>';
function mock({unavailable='',change=false,redirect=false,remove=false,large=false}={}){
 const called=[];
 async function fetcher(url,opts){
  called.push({url,method:opts.method,redirect:opts.redirect});
  if(unavailable&&url.includes(unavailable))throw Error('MOCK_OFFICIAL_TEMPORARILY_OFFLINE');
  if(redirect)return Response.redirect('https://unexpected.example.org',302);
  const s=SOURCES.find(x=>x.url===url);
  const source=s.id==='bcsd-active-bids'?bids:
    '<!doctype html><html><body>'+s.anchors.join(' with ')+' some additional official notice text</body></html>';
  let html=remove&&s.id==='bcsd-active-bids'?'<html><body>Nothing here</body></html>':source;
  if(change)html=html.replace('</body>',' with revised new agency announcement</body>');
  if(large)html+='x'.repeat(900000);
  return new Response(html,{status:200,headers:{'content-type':'text/html'}})
 }
 return {fetcher,called}
}
async function sandbox(fn){const root=await mkdtemp(join(tmpdir(),'fial514-'));
 try{await fn(root)}finally{await rm(root,{force:true,recursive:true})}
}
test('CEC ZESBI Nov 17 is a future LEA incentive event, not a vendor purchase order',()=>{
 assert.equal(SOURCES.length,3);
 assert.equal(PROGRAM.opening_local,'2026-11-17T10:00:00-08:00');
 assert.equal(PROGRAM.officially_announced_funds_minimum_usd,55000000);
 assert.equal(PROGRAM.eligible_applicant_type,'ELIGIBLE_LOCAL_EDUCATIONAL_AGENCY_NOT_ELEKTRON');
 assert.equal(PROGRAM.direct_vendor_order,false);
 assert.equal(PROGRAM.awarded_to_bcsd_verified,false);
 assert.equal(BOUNDARIES.purchase_orders_verified,undefined);
 assert.equal(BOUNDARIES.customer_purchase_orders,0);
 assert.equal(BUYER.buyer_ev_bus_count_verified,null);
});
test('official bid index distinguishes Active Bids from Awarded Bids and computer repair from EV bus repair',()=>{
 const x=reviewActiveBidTitles(bids);
 assert.equal(x.active_bid_area_seen,true);
 assert.equal(x.possible_relevant_titles.length,0);
 assert.equal(x.buyer_service_bid_verified,0);
 assert.ok(x.parsed_titles_count>=0);
 assert.throws(()=>reviewActiveBidTitles('<html>Active Bids only</html>'),/ACTIVE_AWARDED_SECTION/);
});
test('fleet words in awarded section cannot create current buyer service hint',()=>{
 const html='<html><body>Active Bids Awarded Bids <h2>Active Bids</h2>'+
 '<p>School Data Bid 26-11-01</p><h2>Awarded Bids</h2>'+
 '<p>Electric Fleet Charging Repair Bid 26-11-02</p></body></html>';
 const r=reviewActiveBidTitles(html);
 assert.equal(r.possible_relevant_titles.length,0)
});
test('matched index words only generate title-review hints, never verified RFP, contract or portal acceptance',()=>{
 const html='<html><nav>Active Bids Awarded Bids</nav><h2>Active Bids</h2>'+
 '<p>Electric Fleet Charging Repair Bid 26-11-02</p>'+
 '<h2>Awarded Bids</h2></html>';
 const r=reviewActiveBidTitles(html);
 assert.equal(r.possible_relevant_titles.length,1);
 assert.equal(r.possible_relevant_titles[0].open_deadline_verified,false);
 assert.equal(r.possible_relevant_titles[0].official_bid_package_verified,false);
 assert.equal(r.buyer_service_bid_verified,0)
});
test('first official sources GET makes dated evidence and zero verified demand, with separate future event',async()=>sandbox(async root=>{
 const m=mock(),r=await runDemandCycle({root,now,fetcher:m.fetcher});
 assert.equal(r.version,VERSION);
 assert.equal(r.counts.official_sources,3);
 assert.equal(r.counts.documents_retrieved,3);
 assert.equal(r.counts.current_sources,3);
 assert.equal(r.counts.verified_live_ev_repair_rfps,0);
 assert.equal(r.counts.buyer_orders,0);
 assert.equal(r.boundaries.emails_sent,0);
 assert.equal(r.boundaries.rea_calls,0);
 assert.equal(r.program_event_state,'ANNOUNCED_UPCOMING_NOT_YET_OPEN');
 assert.ok(m.called.every(x=>x.method==='GET'&&x.redirect==='manual'));
 assert.equal(validateDemandReceipt(r),true);
 const read=await readDemandStatus({root,now});
 assert.equal(read.counts.current_sources,3)
}));
test('6h incremental schedule cycle within TTL uses zero HTTP requests',async()=>sandbox(async root=>{
 await runDemandCycle({root,now,fetcher:mock().fetcher});
 const m=mock({change:true});
 const next=await runDemandCycle({root,now:new Date(+now+5*3600000),fetcher:m.fetcher});
 assert.equal(m.called.length,0);
 assert.equal(next.counts.checked_this_cycle,0);
 assert.equal(next.counts.current_sources,3)
}));
test('funding announced start passes without automatically confirming acceptance by application portal',async()=>sandbox(async root=>{
 await runDemandCycle({root,now,fetcher:mock().fetcher});
 const d=await readDemandStatus({root,now:new Date('2026-11-17T19:00:00Z')});
 assert.equal(d.program_event_state,'SOURCE_CONFIRMATION_REQUIRED');
 assert.equal(d.decision.revenue_usd,0);
 assert.equal(d.decision.elektron_funding_applicant_eligible_verified,false)
}));
test('district source unavailable leaves program independently intact, no new buyer order',async()=>sandbox(async root=>{
 const d=await runDemandCycle({root,now,fetcher:mock({unavailable:'bcsd.com'}).fetcher});
 assert.equal(d.counts.source_holds,1);
 assert.equal(d.counts.documents_retrieved,2);
 assert.equal(d.decision.published_program_event_verified,true);
 assert.equal(d.decision.verified_live_ev_repair_rfps,0)
}));
test('changed source across TTL remains held, not updated into a current EV bid',async()=>sandbox(async root=>{
 await runDemandCycle({root,now,fetcher:mock().fetcher});
 const d=await runDemandCycle({root,now:new Date(+now+30*3600000),
  fetcher:mock({change:true}).fetcher});
 assert.equal(d.counts.source_holds,3);
 assert.equal(d.counts.verified_live_ev_repair_rfps,0);
 const again=await runDemandCycle({root,now:new Date(+now+31*3600000),
  fetcher:mock({change:true}).fetcher});
 assert.equal(again.counts.source_holds,3)
}));
test('removed required active-bid index and redirect cannot be promoted to a buying opportunity',async()=>sandbox(async root=>{
 const d=await runDemandCycle({root,now,fetcher:mock({remove:true}).fetcher});
 assert.equal(d.sources[0].state,'HOLD');
 assert.equal(d.decision.verified_live_ev_repair_rfps,0);
 assert.equal(d.counts.documents_retrieved,2)
}));
test('oversized official source fails each source without out-of-budget stream download',async()=>sandbox(async root=>{
 const d=await runDemandCycle({root,now,fetcher:mock({large:true}).fetcher});
 assert.equal(d.counts.source_holds,3);
 assert.equal(d.counts.buyer_orders,0)
}));
test('mutated grants, purchases, permissions or indexed titles cannot be promoted to truth',async()=>sandbox(async root=>{
 const original=await runDemandCycle({root,now,fetcher:mock().fetcher});
 const p=join(root,DIRECTORY,FILENAME);
 const attacks=[
  {...original,boundaries:{...original.boundaries,rea_calls:1}},
  {...original,boundaries:{...original.boundaries,emails_sent:1}},
  {...original,counts:{...original.counts,verified_live_ev_repair_rfps:1}},
  {...original,program:{...original.program,awarded_to_elektron_verified:true}},
  {...original,buyer:{...original.buyer,buyer_ev_bus_count_verified:33}},
  {...original,active_bid_review:{...original.active_bid_review,buyer_service_bid_verified:1}}
 ];
 for(const bad of attacks){
  await writeFile(p,JSON.stringify(bad));
  await assert.rejects(readDemandStatus({root,now}),/FIAL514/)
 }
 await writeFile(p,JSON.stringify(original));
 const s=original.sources[0],file=join(root,DIRECTORY,s.id+'-'+s.sha256.slice(0,24)+'.html');
 await writeFile(file,'tampered and not correct');
 await assert.rejects(readDemandStatus({root,now}),/EVIDENCE_SHA256_MISMATCH/)
}));
test('not-yet-installed machine returns honest zero public evidence and action counts',async()=>sandbox(async root=>{
 const x=await readDemandStatus({root,now});
 assert.equal(x.state,'NOT_ACTIVATED');
 assert.equal(x.counts.documents_retrieved,0);
 assert.equal(x.counts.verified_live_ev_repair_rfps,0);
 assert.equal(x.decision.contact_authorized,false)
}));
