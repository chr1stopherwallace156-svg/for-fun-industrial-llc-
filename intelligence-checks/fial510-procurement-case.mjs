import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {NOTICE,SOURCES,deadlineState,validateOfficialListing} from '../src/procurement/procurement-catalog-v5-10.mjs';
import {runProcurementCycle,readProcurementStatus,VERSION,FOLDER,FILE} from '../src/procurement/procurement-engine-v5-10.mjs';
const NOW=new Date('2026-11-15T04:00:00.000Z');
const html='<html><head><title>Jurupa Unified School District Bids</title></head><body>'+
 '<h3>26-27-02TR - Student Transportation Services RFP</h3>'+
 '<a href="26-27-02TR%20-Notice%20Inviting%20Bids.pdf">26-27-02TR - Notice Inviting Bids.pdf</a></body></html>';
const pdf=Buffer.from('%PDF-1.5\nOfficial signed notice synthetic PDF fixture testing only.\n'+
  'not a real district document'.repeat(5));
function fake({missing='',changed=false,unlisted=false,redirect=false,oversize=false}={}){
 const called=[];
 const fetcher=async(url,init)=>{
  called.push({url,method:init.method,redirect:init.redirect});
  if(missing&&url.includes(missing))throw Error('SIMULATED_UNAVAILABLE');
  if(redirect)return new Response('',{status:302,headers:{location:'https://evil.test/'}});
  const isPdf=url.endsWith('.pdf');
  const body=isPdf?(changed?Buffer.concat([pdf,Buffer.from('\nCHANGED')]):pdf):
   (unlisted?'<html><body>No related bid announced</body></html>':
    changed?html.replace('RFP','RFP revised'):html);
  const b=oversize?(isPdf?Buffer.concat([pdf,Buffer.alloc(1500002)]):html+'x'.repeat(250000)):body;
  return new Response(b,{status:200,headers:{'content-type':isPdf?'application/pdf':'text/html'}});
 };return {fetcher,called}
}
async function temp(fn){
 const root=await mkdtemp(join(tmpdir(),'fial510-'));
 try{await fn(root)}finally{await rm(root,{recursive:true,force:true})}
}
test('official district notice uses reviewed date and issuer, never EV-conversion scope or automatic bid authority',()=>{
 assert.equal(NOTICE.solicitation_id,'26-27-02TR');
 assert.equal(NOTICE.due_utc,'2026-12-11T22:00:00.000Z');
 assert.match(NOTICE.source_notice_url,/jurupausd\.org/);
 assert.match(NOTICE.scope,/Special|special education/i);
 assert.equal(NOTICE.conversion_or_ev_requirement,'NOT_STATED');
 assert.equal(NOTICE.verified_contract_value_usd,0);
 assert.equal(NOTICE.actual_award,false);
 assert.equal(NOTICE.auto_submit,false);
 assert.equal(SOURCES.length,2);
 assert.equal(deadlineState(NOW),'BEFORE_PUBLISHED_DEADLINE');
 assert.equal(deadlineState(new Date('2026-12-11T22:00:00.001Z')),'PAST_PUBLISHED_DEADLINE');
});
test('issuer listing requires both exact solicitation number and transport services PDF notice',()=>{
 assert.equal(validateOfficialListing(html),true);
 assert.equal(validateOfficialListing(html.replace('26-27-02TR','26-27-13TR')),false);
 assert.equal(validateOfficialListing(html.replace('Student Transportation Services RFP','Network Equipment')),false);
 assert.equal(validateOfficialListing('<html>No notice</html>'),false);
});
test('first actual-format HTTPS issuer and PDF check produces one bounded future published notice, zero contracts',async()=>temp(async root=>{
 const mock=fake(),r=await runProcurementCycle({root,now:NOW,fetcher:mock.fetcher});
 assert.equal(r.version,VERSION);
 assert.equal(r.counts.verified_current_published_notices,1);
 assert.equal(r.state,'OFFICIAL_ISSUER_LISTING_AND_NOTICE_RETRIEVED_FUTURE_DEADLINE');
 assert.equal(r.boundaries.actual_rfps_submitted,0);
 assert.equal(r.boundaries.model_calls,0);
 assert.equal(r.boundaries.revenue_usd,0);
 assert.equal(r.counts.verified_fit_for_elektron,0);
 assert.equal(r.verified_current_published_notices[0].buyer_portal_live_status_verified,false);
 assert.equal(r.verified_current_published_notices[0].elektron_vendor_fit_verified,false);
 assert.equal(r.sources.every(x=>x.state==='FETCHED'&&/^[a-f0-9]{64}$/.test(x.sha256)),true);
 assert.equal(mock.called.length,2);
 assert.ok(mock.called.every(x=>x.method==='GET'&&x.redirect==='manual'));
 const read=await readProcurementStatus({root,now:NOW});
 assert.equal(read.counts.verified_current_published_notices,1);
}));
test('source-specific TTL avoids repeated downloads without inventing new procurement',async()=>temp(async root=>{
 await runProcurementCycle({root,now:NOW,fetcher:fake().fetcher});
 const mock=fake({changed:true});
 const second=await runProcurementCycle({root,now:new Date(+NOW+3600000),fetcher:mock.fetcher});
 assert.equal(mock.called.length,0);
 assert.equal(second.counts.official_source_checks,0);
 assert.equal(second.counts.verified_current_published_notices,1);
}));
test('source changed or withdrawn => review, not open; source change remains held until human review',async()=>temp(async root=>{
 await runProcurementCycle({root,now:NOW,fetcher:fake().fetcher});
 const second=await runProcurementCycle({root,now:new Date(+NOW+14*3600000),fetcher:fake({changed:true}).fetcher});
 assert.equal(second.counts.changed_sources_requiring_review,2);
 assert.equal(second.counts.verified_current_published_notices,0);
 assert.equal(second.state,'PUBLISHED_NOTICE_REQUIRES_CURRENT_SOURCE_REVIEW');
 const third=await runProcurementCycle({root,now:new Date(+NOW+15*3600000),fetcher:fake({changed:true}).fetcher});
 assert.equal(third.counts.verified_current_published_notices,0);
 assert.ok(third.sources.every(x=>x.state==='REVIEW_CHANGED'));
}));
test('notice removed from publisher listing causes evidence HOLD, not false active opportunity',async()=>temp(async root=>{
 const r=await runProcurementCycle({root,now:NOW,fetcher:fake({unlisted:true}).fetcher});
 assert.equal(r.counts.official_source_holds,1);
 assert.equal(r.counts.verified_current_published_notices,0);
 assert.equal(r.sources[0].state,'UNAVAILABLE');
}));
test('issuer HTTP redirect and missing PDF fail closed independently',async()=>temp(async root=>{
 const r=await runProcurementCycle({root,now:NOW,fetcher:fake({missing:'.pdf'}).fetcher});
 assert.equal(r.counts.official_source_holds,1);
 assert.equal(r.counts.verified_current_published_notices,0);
}));
test('bulk PDF oversized and external redirects are rejected instead of automatically followed',async()=>temp(async root=>{
 const r=await runProcurementCycle({root,now:NOW,fetcher:fake({oversize:true}).fetcher});
 assert.equal(r.counts.verified_current_published_notices,0);
 assert.equal(r.counts.official_source_holds,2);
}));
test('historical date expiry also suppresses cached success at display time',async()=>temp(async root=>{
 await runProcurementCycle({root,now:NOW,fetcher:fake().fetcher});
 const later=await readProcurementStatus({root,now:new Date('2026-12-12T02:00:00Z')});
 assert.equal(later.state,'PUBLISHED_NOTICE_DEADLINE_ELAPSED');
 assert.equal(later.verified_current_published_notices.length,0);
 assert.equal(later.counts.verified_current_published_notices,0);
}));
test('changing a saved deadline, contract award count or source document bytes fails closed',async()=>temp(async root=>{
 await runProcurementCycle({root,now:NOW,fetcher:fake().fetcher});
 const f=join(root,FOLDER,FILE),old=JSON.parse(await readFile(f,'utf8'));
 const forged={...old,counts:{...old.counts,verified_fit_for_elektron:1}};
 await writeFile(f,JSON.stringify(forged));
 await assert.rejects(readProcurementStatus({root,now:NOW}),/SAVED_OFFICIAL_EVIDENCE_OR_AUTHORITY_INVALID/);
 await writeFile(f,JSON.stringify(old));
 old.sources[0].sha256='0'.repeat(64);
 await writeFile(f,JSON.stringify(old));
 await assert.rejects(readProcurementStatus({root,now:NOW}));
}));
test('offline read-only status never invents verification on uninstalled machine',async()=>temp(async root=>{
 const x=await readProcurementStatus({root,now:NOW});
 assert.equal(x.state,'NOT_ACTIVATED');
 assert.equal(x.counts.verified_current_published_notices,0);
 assert.equal(x.boundaries.orders,0);
}));
