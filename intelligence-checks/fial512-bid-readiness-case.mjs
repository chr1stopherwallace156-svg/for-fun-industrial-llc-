import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SOURCES,LEADS,QUALIFICATIONS,BOUNDARIES,stage} from '../src/bid-readiness/readiness-catalog-v5-12.mjs';
import {runReadinessCycle,readReadinessStatus,verifyReadinessRecord,
 DIRECTORY,FILENAME,VERSION} from '../src/bid-readiness/readiness-engine-v5-12.mjs';
const NOW=new Date('2026-11-15T05:00:00.000Z');
function mock({missing='',change=false,redirect=false,large=false,unlisted=false}={}){
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,method:opts.method,redirect:opts.redirect});
  if(missing&&url.includes(missing))throw Error('MOCK_OFFICIAL_SOURCE_UNAVAILABLE');
  if(redirect)return Response.redirect('https://example.invalid',302);
  let html;
  if(url.includes('longbeachbuys.')){
   html='<!doctype html><html><body>Fleet Services EV Charging Depot PW-26-800 R-7282'+(change?' amended':'')+'</body></html>';
   if(unlisted)html='<!doctype html><html><body>no bids currently listed</body></html>'
  }else if(url.includes('californiazesbi.org')){
   html='<!doctype html><html><body>School Transportation Program ZE School Bus Repairs Maintenance Contracts'+(change?' amended':'')+'</body></html>';
  }else html='<!doctype html><html><body>C-10 Electrical Contractor'+(change?' amended':'')+'</body></html>';
  const value=large?html+'x'.repeat(700000):html;
  return new Response(value,{status:200,headers:{'content-type':'text/html'}});
 };return {calls,fetcher}
}
async function temp(fn){
 const root=await mkdtemp(join(tmpdir(),'fun-bid512-'));
 try{await fn(root)}finally{await rm(root,{recursive:true,force:true})}
}
test('distinct direct Long Beach construction and conditional LEA maintenance route never count as qualified contracts',()=>{
 assert.equal(LEADS.length,2);assert.equal(SOURCES.length,3);
 assert.deepEqual(LEADS.map(x=>x.type),[
  'DIRECT_CONSTRUCTION_SOLICITATION','PROGRAM_ELIGIBLE_COST_PATHWAY_NOT_A_PROCUREMENT']);
 assert.equal(LEADS[0].solicitation_number,'PW-26-800');
 assert.equal(LEADS[0].published_deadline_utc,'2026-11-20T19:00:00.000Z');
 assert.equal(LEADS[1].published_deadline_utc,null);
 assert.equal(LEADS[0].contract_awarded,false);
 assert.equal(LEADS[1].contract_awarded,false);
});
test('mandatory site visit, CSLB, EVITP, IBEW, bonding and insurance are hard unverified gates',()=>{
 for(const gate of ['c10_installation_license','evitp','ibew',
  'mandatory_prebid_attendance','insurance_bonding_and_dir']){
  assert.ok(LEADS[0].hard_gates.includes(gate),gate)
 }
 assert.equal(QUALIFICATIONS.cslb_class_c10,'UNVERIFIED');
 assert.equal(QUALIFICATIONS.bid_conference_attended,'UNVERIFIED');
 assert.equal(QUALIFICATIONS.commercial_insurance,'UNVERIFIED');
 assert.equal(BOUNDARIES.verified_bid_ready,0);
});
test('a published deadline is not an accepting portal or proof of supplier eligibility',()=>{
 const l=stage(LEADS[0],NOW);
 assert.equal(l.deadline_state,'FUTURE_PUBLISHED_DEADLINE');
 assert.equal(l.current_portal_accepting_bids_verified,false);
 assert.equal(l.direct_bid_ready,false);
 assert.equal(stage(LEADS[0],new Date('2026-11-20T19:01:00Z')).deadline_state,'PUBLISHED_DEADLINE_EXPIRED');
 assert.equal(stage(LEADS[1],NOW).deadline_state,'NO_VENDOR_BID_DEADLINE');
});
test('bounded first real-format official source run saves hashes and reports zero bids and revenue',async()=>temp(async root=>{
 const f=mock(),r=await runReadinessCycle({root,now:NOW,fetcher:f.fetcher});
 assert.equal(r.version,VERSION);
 assert.equal(r.sources.length,3);
 assert.equal(r.counts.checked_this_cycle,3);
 assert.equal(r.counts.documents_retrieved,3);
 assert.equal(r.counts.source_documents_current,3);
 assert.equal(r.counts.verified_bid_ready,0);
 assert.equal(r.boundaries.emails_sent,0);
 assert.equal(r.boundaries.rea_tool_calls,0);
 assert.ok(f.calls.every(x=>x.method==='GET'&&x.redirect==='manual'));
 assert.equal(verifyReadinessRecord(r),true);
 const read=await readReadinessStatus({root,now:NOW});
 assert.equal(read.counts.source_documents_current,3);
 assert.ok(read.sources.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
}));
test('TTL prevents unnecessary network polling and does not infer contract event',async()=>temp(async root=>{
 await runReadinessCycle({root,now:NOW,fetcher:mock().fetcher});
 const f=mock({change:true});
 const r=await runReadinessCycle({root,now:new Date(+NOW+3600000),fetcher:f.fetcher});
 assert.equal(r.counts.checked_this_cycle,0);
 assert.equal(f.calls.length,0);
 assert.equal(r.counts.verified_bid_ready,0);
}));
test('source disappearance and unverified page replace source with a HOLD, preserve independent ZESBI lead',async()=>temp(async root=>{
 const r=await runReadinessCycle({root,now:NOW,fetcher:mock({unlisted:true}).fetcher});
 assert.equal(r.counts.source_holds,1);
 assert.equal(r.sources[0].state,'HOLD');
 assert.equal(r.counts.documents_retrieved,2);
 assert.equal(r.leads[0].source_evidence_current,false);
 assert.equal(r.leads[1].direct_bid_ready,false)
}));
test('official page byte change is review-only and cannot self-clear',async()=>temp(async root=>{
 await runReadinessCycle({root,now:NOW,fetcher:mock().fetcher});
 const r=await runReadinessCycle({root,now:new Date(+NOW+73*3600000),
  fetcher:mock({change:true}).fetcher});
 assert.equal(r.counts.changed_docs_pending_review,3);
 assert.equal(r.counts.source_holds,3);
 assert.ok(r.sources.every(x=>x.state==='CHANGED_REQUIRES_REVIEW'));
 const again=await runReadinessCycle({root,now:new Date(+NOW+74*3600000),
  fetcher:mock({change:true}).fetcher});
 assert.equal(again.counts.source_holds,3);
 assert.equal(again.counts.verified_bid_ready,0)
}));
test('redirect or oversized source body never upgrades research to a qualified deal',async()=>temp(async root=>{
 const r=await runReadinessCycle({root,now:NOW,fetcher:mock({redirect:true}).fetcher});
 assert.equal(r.counts.source_holds,3);
 assert.equal(r.counts.verified_bid_ready,0)
}));
test('source evidence liveness and deadline states are recomputed without any extra model or fetch',async()=>temp(async root=>{
 await runReadinessCycle({root,now:NOW,fetcher:mock().fetcher});
 const stale=await readReadinessStatus({root,now:new Date('2026-11-22T12:00:00Z')});
 assert.equal(stale.counts.source_documents_current,0);
 assert.equal(stale.leads[0].deadline_state,'PUBLISHED_DEADLINE_EXPIRED');
 assert.equal(stale.leads[0].direct_bid_ready,false);
 assert.equal(stale.leads[1].direct_bid_ready,false)
}));
test('forged paid wins, licenses and contract values are refused, source tamper detected',async()=>temp(async root=>{
 const r=await runReadinessCycle({root,now:NOW,fetcher:mock().fetcher});
 const path=join(root,DIRECTORY,FILENAME);
 for(const bad of [
  {...r,qualification_profile:{...r.qualification_profile,cslb_class_c10:'VERIFIED'}},
  {...r,boundaries:{...r.boundaries,emails_sent:1}},
  {...r,counts:{...r.counts,verified_bid_ready:1}},
  {...r,leads:[{...r.leads[0],direct_bid_ready:true},r.leads[1]]},
  {...r,leads:[{...r.leads[0],contract_value_usd_verified:50000},r.leads[1]]}
 ]){
  await writeFile(path,JSON.stringify(bad));
  await assert.rejects(readReadinessStatus({root,now:NOW}),/FIAL512/);
 }
 await writeFile(path,JSON.stringify(r));
 const s=r.sources[0];
 const p=join(root,DIRECTORY,s.id+'-'+s.sha256.slice(0,24)+'.html');
 await writeFile(p,'changed file');
 await assert.rejects(readReadinessStatus({root,now:NOW}),/EVIDENCE_HASH_TAMPERED/);
}));
test('not-yet-deployed does not fabricate activity',async()=>temp(async root=>{
 const r=await readReadinessStatus({root,now:NOW});
 assert.equal(r.state,'NOT_ACTIVATED');
 assert.equal(r.counts.documents_retrieved,0);
 assert.equal(r.leads.length,2);
 assert.ok(r.leads.every(x=>x.direct_bid_ready===false));
}));
