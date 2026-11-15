import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {OFFICIAL_SOURCES,OPPORTUNITIES,PROFILE,rankCommercialFit,
 AUTHORITY} from '../src/fit/commercial-fit-catalog-v5-11.mjs';
import {runFitCycle,readFitStatus,verifyFitRecord,
 VERSION,FOLDER,FILENAME} from '../src/fit/commercial-fit-engine-v5-11.mjs';
const now=new Date('2026-11-15T04:30:00Z');
function mock({missing='',changed=false,redirect=false,oversized=false,invalidMedia=false}={}){
 const calls=[];
 const fetcher=async(url,args)=>{
  calls.push({url,method:args.method,redirect:args.redirect});
  if(missing&&url.includes(missing))throw Error('MOCK_OFFICIAL_UNAVAILABLE');
  if(redirect)return Response.redirect('https://www.example.com',302);
  const pdf=url.includes('morganhill.ca.gov');
  const body=pdf?Buffer.from('%PDF-1.4\n'+
   'f'.repeat(150)+(changed?'CHANGED':'ORIGINAL')):'<!doctype html><html><body>'+
   (url.includes('energy.ca.gov')?'CEC GFO-25-603 funding opportunity':'SCAQMD PA2026-03R grants')+
   (changed?' changed':'')+'</body></html>';
  const b=oversized?Buffer.concat([Buffer.from(body),Buffer.alloc(5500100)]):body;
  return new Response(b,{status:200,headers:{
   'content-type':invalidMedia?'application/json':pdf?'application/pdf':'text/html'
  }});
 };return {fetcher,calls}
}
async function sandbox(fn){
 const root=await mkdtemp(join(tmpdir(),'fun-fit511-'));
 try{await fn(root)}finally{await rm(root,{force:true,recursive:true})}
}
test('three independently published California leads separated by actual commercial transaction type',()=>{
 assert.equal(OPPORTUNITIES.length,3);
 assert.deepEqual(OPPORTUNITIES.map(x=>x.kind),
 ['DIRECT_PROFESSIONAL_DESIGN_RFP','GRANT_FUNDING_OPPORTUNITY','INCENTIVE_REBATE_PROGRAM']);
 assert.equal(OPPORTUNITIES[0].submission_deadline_utc,'2026-11-24T01:00:00.000Z');
 assert.equal(OPPORTUNITIES[1].submission_deadline_utc,'2026-12-12T07:59:00.000Z');
 assert.equal(OPPORTUNITIES[2].submission_deadline_utc,'2027-01-13T23:00:00.000Z');
 assert.deepEqual(OPPORTUNITIES.map(x=>x.direct_contract),[true,false,false]);
 assert.equal(new Set(OFFICIAL_SOURCES.map(x=>x.id)).size,3);
});
test('missing professional engineering and insurance credentials never silently permit direct bids',()=>{
 assert.equal(PROFILE.pe_electrical_license,'UNVERIFIED');
 assert.equal(PROFILE.commercial_insurance,'UNVERIFIED');
 assert.equal(PROFILE.ev_itp_electrician,'UNVERIFIED');
 assert.equal(AUTHORITY.bids_submitted,0);
 for(const p of OPPORTUNITIES){
  const s=rankCommercialFit(p,now);
  assert.equal(s.direct_bid_ready,false);
  assert.equal(s.vendor_eligibility_verified,false);
  assert.equal(s.contract_amount_usd_verified,0);
  assert.ok(s.research_priority<50);
 }
});
test('source 3-way observation saves immutable public data and exactly zero executed actions',async()=>sandbox(async root=>{
 const m=mock(),r=await runFitCycle({root,now,fetcher:m.fetcher});
 assert.equal(r.version,VERSION);
 assert.equal(r.counts.offical_source_count,3);
 assert.equal(r.counts.source_docs_retrieved,3);
 assert.equal(r.counts.official_source_holds,0);
 assert.equal(r.counts.directly_qualified_bids,0);
 assert.ok(m.calls.every(x=>x.method==='GET'&&x.redirect==='manual'));
 assert.equal(r.opportunities.filter(x=>x.official_source_now_accessible).length,3);
 assert.equal(r.opportunities.filter(x=>x.direct_bid_ready).length,0);
 assert.equal(verifyFitRecord(r),true);
 const read=await readFitStatus({root,now});
 assert.equal(read.counts.source_docs_current,3);
}));
test('source TTL avoids polling all official sites in each fast scheduler pass',async()=>sandbox(async root=>{
 await runFitCycle({root,now,fetcher:mock().fetcher});
 const m=mock({changed:true});
 const r=await runFitCycle({root,now:new Date(+now+60*60000),fetcher:m.fetcher});
 assert.equal(m.calls.length,0);assert.equal(r.counts.checked_this_cycle,0);
 assert.equal(r.counts.directly_qualified_bids,0)
}));
test('updated PDF and grant page are held for human review and not automatically called unchanged',async()=>sandbox(async root=>{
 await runFitCycle({root,now,fetcher:mock().fetcher});
 const r=await runFitCycle({root,now:new Date(+now+25*3600000),
  fetcher:mock({changed:true}).fetcher});
 assert.equal(r.counts.changed_docs_pending_review,3);
 assert.equal(r.counts.source_docs_retrieved,0);
 assert.equal(r.opportunities.filter(x=>x.official_source_now_accessible).length,0);
 const next=await runFitCycle({root,now:new Date(+now+26*3600000),
  fetcher:mock({changed:true}).fetcher});
 assert.equal(next.counts.official_source_holds,3);
}));
test('independent government downtime does not invent purchasing opportunities',async()=>sandbox(async root=>{
 const r=await runFitCycle({root,now,fetcher:mock({missing:'scaqmd.gov'}).fetcher});
 assert.equal(r.counts.official_source_holds,1);
 assert.equal(r.sources.find(x=>x.id==='scaqmd-charging-incentive').state,'HOLD');
 assert.equal(r.counts.directly_qualified_bids,0);
 assert.equal(r.opportunities.length,3)
}));
test('redirect and invalid content type hold source, no automatic traversal',async()=>sandbox(async root=>{
 const r=await runFitCycle({root,now,fetcher:mock({redirect:true}).fetcher});
 assert.equal(r.counts.source_docs_retrieved,0);
 assert.equal(r.counts.official_source_holds,3)
}));
test('oversized official file is held without corrupting independent qualification research',async()=>sandbox(async root=>{
 const r=await runFitCycle({root,now,fetcher:mock({oversized:true}).fetcher});
 assert.equal(r.counts.source_docs_retrieved,0);
 assert.equal(r.counts.official_source_holds,3);
 assert.equal(r.counts.directly_qualified_bids,0)
}));
test('stale documents and deadlines expire in read-only status without fetch or extra grant eligibility',async()=>sandbox(async root=>{
 await runFitCycle({root,now,fetcher:mock().fetcher});
 const stale=await readFitStatus({root,now:new Date('2027-01-15T00:00:00Z')});
 assert.equal(stale.counts.source_docs_current,0);
 assert.ok(stale.opportunities.every(x=>x.deadline_state==='DEADLINE_ELAPSED'));
 assert.equal(stale.counts.directly_qualified_bids,0);
}));
test('forged contracts, vendor qualifications or loss of immutable hashes fail closed',async()=>sandbox(async root=>{
 const r=await runFitCycle({root,now,fetcher:mock().fetcher});
 const p=join(root,FOLDER,FILENAME);
 for(const attack of [
  {...r,counts:{...r.counts,directly_qualified_bids:1}},
  {...r,boundaries:{...r.boundaries,rea_calls:1}},
  {...r,opportunities:[{...r.opportunities[0],direct_bid_ready:true},...r.opportunities.slice(1)]},
  {...r,profile:{...r.profile,pe_electrical_license:'VERIFIED'}}
 ]){
  await writeFile(p,JSON.stringify(attack));
  await assert.rejects(readFitStatus({root,now}),/FIAL511/);
 }
 await writeFile(p,JSON.stringify(r));
 await assert.doesNotReject(readFitStatus({root,now}));
 const src=r.sources[0],target=join(root,FOLDER,src.id+'-'+src.sha256.slice(0,24)+'.pdf');
 await writeFile(target,'TAMPERED PDF');
 await assert.rejects(readFitStatus({root,now}),/EVIDENCE_HASH_MISMATCH/)
}));
test('read-only status before deployment cannot claim downloads or bidder eligibility',async()=>sandbox(async root=>{
 const r=await readFitStatus({root,now});
 assert.equal(r.state,'NOT_ACTIVATED');
 assert.equal(r.counts.source_docs_retrieved,0);
 assert.equal(r.opportunities.length,3);
 assert.equal(r.counts.directly_qualified_bids,0);
 assert.ok(r.opportunities.every(x=>x.current_published_document_state==='LOCAL_SOURCE_CHECK_NOT_YET_PERFORMED'));
}));
