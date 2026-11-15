import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SOURCES,VVTA,AUTHORITY,classify,validateProcurementHtml} from '../src/demand/demand-catalog-v5-14.mjs';
import {runDemandCycle,readDemandStatus,verifyDemandRecord,DIRECTORY,FILENAME,VERSION} from '../src/demand/demand-engine-v5-14.mjs';
const NOW=new Date('2026-11-15T09:00:00.000Z');
const HTML='<!doctype html><html><body><table><tr><td>October 12, 2026</td><td>'+
 'IFB 2027-01 Building Modifications Hydrogen Fuel Cell Bus Maintenance</td>'+
 '<td>IFB</td><td>Open</td><td><a href="/wp-content/uploads/2026/10/2027-01-Addendum-No.-1.pdf">'+
 'IFB 2027-01 Addendum No. 1</a></td></tr></table></body></html>';
const PDF=Buffer.from('%PDF-1.7\n'+ 'synthetic binary fixture, not actual VVTA addendum\n'.repeat(7));
function mocked({missing='',changed=false,redirect=false,invalid=false,large=false,missingNotice=false}={}){
 const calls=[];
 const fetcher=async(url,args)=>{
  calls.push({url,method:args.method,redirect:args.redirect});
  if(missing&&url.includes(missing))throw Error('OFFICIAL_UNAVAILABLE_IN_TEST');
  if(redirect)return Response.redirect('https://untrusted.example',302);
  const pdf=url.endsWith('.pdf');
  const b=pdf?(changed?Buffer.concat([PDF,Buffer.from('APPEND')]):PDF):
   (missingNotice?HTML.replace('Open','Closed'):changed?HTML.replace('Hydrogen','Hydrogen Revised'):HTML);
  const value=large?Buffer.concat([Buffer.from(b),Buffer.alloc(4100000)]):b;
  return new Response(value,{status:200,headers:{'content-type':invalid?
   'application/json':pdf?'application/pdf':'text/html'}})
 };return {calls,fetcher}
}
async function temp(fn){
 const root=await mkdtemp(join(tmpdir(),'fial514-'));
 try{await fn(root)}finally{await rm(root,{recursive:true,force:true})}
}
test('VVTA exact official 2027-01 invitation and 2026-11-12 addendum distinctly confirm future intent',()=>{
 assert.equal(SOURCES.length,2);
 assert.equal(VVTA.solicitation,'IFB 2027-01');
 assert.equal(VVTA.published_close_utc,'2026-11-19T23:00:00.000Z');
 assert.equal(VVTA.addendum_issue_date,'2026-11-12');
 assert.match(VVTA.addendum_q13,/procured separately/);
 assert.match(VVTA.prime_classification_addendum_q5,/Class A or B/);
 assert.match(VVTA.future_service_category,/CALIBRATION/);
 assert.equal(VVTA.maintenance_service_solicitation_id_verified,null);
 assert.equal(VVTA.contract_price_usd_verified,0);
 assert.equal(AUTHORITY.emails_sent,0);
 assert.equal(AUTHORITY.bids_submitted,0)
});
test('VVTA HTML must show matching IFB, open listing and exact addendum file',()=>{
 assert.equal(validateProcurementHtml(HTML),true);
 assert.equal(validateProcurementHtml(HTML.replace('Open','Closed')),false);
 assert.equal(validateProcurementHtml(HTML.replace('IFB 2027-01','IFB 2028-03')),false);
 assert.equal(validateProcurementHtml(HTML.replace('2027-01-Addendum-No.-1.pdf','2027-01-fake.pdf')),false);
});
test('future procurement intent is not an open maintenance contract or authorized vendor sale',()=>{
 const r=classify({listing:true,addendum:true},NOW);
 assert.equal(r.documented_future_service_intents,1);
 assert.equal(r.future_service_evidence_state,'HUMAN_REVIEWED_OFFICIAL_ADDENDUM_FOLLOW_ON_PURCHASE_INTENT');
 assert.equal(r.current_service_rfps_verified,0);
 assert.equal(r.qualified_elektron_bids,0);
 assert.equal(r.open_specialty_service_procurement_verified,false);
 assert.equal(r.supporting_pdf_semantically_reparsed_by_runtime,false);
 assert.equal(r.direct_submission_authorized,false)
});
test('first official-format source check creates immutable byte evidence with no external actions',async()=>temp(async root=>{
 const fetch=mocked(),r=await runDemandCycle({root,now:NOW,fetcher:fetch.fetcher});
 assert.equal(r.version,VERSION);
 assert.equal(r.counts.documents_retrieved,2);
 assert.equal(r.counts.documented_future_service_intents,1);
 assert.equal(r.counts.current_maintenance_rfps_verified,0);
 assert.equal(r.counts.qualified_elektron_bids,0);
 assert.equal(r.boundaries.rea_calls,0);
 assert.equal(r.boundaries.revenue_usd,0);
 assert.equal(verifyDemandRecord(r),true);
 assert.ok(fetch.calls.every(x=>x.method==='GET'&&x.redirect==='manual'));
 const read=await readDemandStatus({root,now:NOW});
 assert.equal(read.counts.current_source_docs,2)
}));
test('per-source TTL avoids needless hourly polling and does not infer source changes',async()=>temp(async root=>{
 await runDemandCycle({root,now:NOW,fetcher:mocked().fetcher});
 const f=mocked({changed:true});
 const r=await runDemandCycle({root,now:new Date(+NOW+3600000),fetcher:f.fetcher});
 assert.equal(f.calls.length,0);
 assert.equal(r.counts.checked_this_cycle,0);
 assert.equal(r.counts.documented_future_service_intents,1)
}));
test('withdrawn or no-longer-open official listing is a HOLD, never an invitation',async()=>temp(async root=>{
 const r=await runDemandCycle({root,now:NOW,fetcher:mocked({missingNotice:true}).fetcher});
 assert.equal(r.sources[0].state,'HOLD');
 assert.equal(r.counts.source_holds,1);
 assert.equal(r.counts.documented_future_service_intents,0)
}));
test('missing official PDF preserves listing but no confirmed follow-on maintenance claim',async()=>temp(async root=>{
 const r=await runDemandCycle({root,now:NOW,fetcher:mocked({missing:'.pdf'}).fetcher});
 assert.equal(r.counts.source_holds,1);
 assert.equal(r.counts.documented_future_service_intents,0);
 assert.equal(r.counts.current_maintenance_rfps_verified,0)
}));
test('source change is a persistent human-review HOLD rather than revised buyer authorization',async()=>temp(async root=>{
 await runDemandCycle({root,now:NOW,fetcher:mocked().fetcher});
 const r=await runDemandCycle({root,now:new Date(+NOW+26*3600000),
  fetcher:mocked({changed:true}).fetcher});
 assert.equal(r.counts.source_holds,2);
 assert.equal(r.counts.documented_future_service_intents,0);
 const next=await runDemandCycle({root,now:new Date(+NOW+27*3600000),
  fetcher:mocked({changed:true}).fetcher});
 assert.equal(next.counts.source_holds,2);
 assert.equal(next.classification.future_service_evidence_state,'OFFICIAL_ADDENDUM_EVIDENCE_MISSING_OR_STALE')
}));
test('invalid media and redirect are held individually; no external navigation',async()=>temp(async root=>{
 const r=await runDemandCycle({root,now:NOW,fetcher:mocked({redirect:true}).fetcher});
 assert.equal(r.counts.documents_retrieved,0);
 assert.equal(r.counts.documented_future_service_intents,0)
}));
test('oversized publisher responses are not stored or treated as valid',async()=>temp(async root=>{
 const r=await runDemandCycle({root,now:NOW,fetcher:mocked({large:true}).fetcher});
 assert.equal(r.counts.documents_retrieved,0);
 assert.equal(r.counts.source_holds,2)
}));
test('after published construction deadline the service intention can remain documented but not an open bid',async()=>temp(async root=>{
 await runDemandCycle({root,now:NOW,fetcher:mocked().fetcher});
 const after=await readDemandStatus({root,now:new Date('2026-11-19T23:00:10Z')});
 assert.equal(after.classification.published_construction_deadline_state,'PUBLISHED_CLOSING_ELAPSED');
 assert.equal(after.classification.current_service_rfps_verified,0);
 assert.equal(after.classification.open_specialty_service_procurement_verified,false)
}));
test('forged award, future service RFP, submitted bid or modified evidence fails closed',async()=>temp(async root=>{
 const r=await runDemandCycle({root,now:NOW,fetcher:mocked().fetcher});
 const p=join(root,DIRECTORY,FILENAME);
 for(const bad of [
  {...r,boundaries:{...r.boundaries,bids_submitted:1}},
  {...r,counts:{...r.counts,current_maintenance_rfps_verified:1}},
  {...r,notice:{...r.notice,future_maintenance_award_verified:true}},
  {...r,notice:{...r.notice,maintenance_service_solicitation_id_verified:'IFB X'}},
  {...r,classification:{...r.classification,open_specialty_service_procurement_verified:true}},
 ]){
  await writeFile(p,JSON.stringify(bad));
  await assert.rejects(readDemandStatus({root,now:NOW}),/FIAL514/);
 }
 await writeFile(p,JSON.stringify(r));
 const x=r.sources[0],f=join(root,DIRECTORY,x.id+'-'+x.sha256.slice(0,24)+'.html');
 await writeFile(f,'TRUSTED APPROVAL FAKE');
 await assert.rejects(readDemandStatus({root,now:NOW}),/EVIDENCE_HASH_MISMATCH/)
}));
test('uninstalled PC status is inert and cannot imply an observed customer intent',async()=>temp(async root=>{
 const r=await readDemandStatus({root,now:NOW});
 assert.equal(r.state,'NOT_ACTIVATED');
 assert.equal(r.counts.documented_future_service_intents,0);
 assert.equal(r.counts.current_maintenance_rfps_verified,0)
}));
