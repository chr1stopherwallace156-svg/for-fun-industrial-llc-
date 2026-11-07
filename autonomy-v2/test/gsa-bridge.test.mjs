import test from "node:test";
import assert from "node:assert/strict";
import {gsaImportDocument,combinedOpportunities,GSA_IMPORT_TTL_MS} from "../src/gsa-bridge.mjs";

function fixture(){return {auctions:[
 {saleNo:"ABC",lotNo:"3",itemName:"2004 Ford F550 Crew Cab",auctionStatus:"Active",propertyCity:"Crescent",propertyState:"OR",highBidAmount:"325",aucEndDt:"2026-11-10",lotInfo:"<p>Requires inspection &amp; transport</p>",itemDescURL:"https://www.gsaauctions.gov/auctions/preview/382489"},
 {saleNo:"DEF",lotNo:"2",itemName:"Industrial compressors",auctionStatus:"Active",propertyCity:"Vancouver",propertyState:"WA",lotInfo:"<div>Salvage condition, used</div>"},
 {saleNo:"GHI",lotNo:"1",itemName:"Expired old lot",auctionStatus:"Closed",propertyCity:"Reno",propertyState:"NV"}
]}}
const base={checkedAt:"2026-11-07T00:00:00Z",scope:"United States",items:[{id:"grant-1",kind:"grant",title:"Research grant",score:40,source:"Grants.gov"}],sources:[{name:"Grants.gov",ok:true,count:1}],summary:{total:1,grantCount:1,auctionCount:0,bidCount:0}};
test("official manually downloaded GSA JSON records are evidence-labelled and time-limited",()=>{
 const now=Date.UTC(2026,10,7,2,30),data=gsaImportDocument(fixture(),{now});
 assert.equal(data.lotCount,3);assert.equal(data.activeCount,2);
 assert.equal(data.items.length,2);
 assert.equal(data.expiresAt,new Date(now+GSA_IMPORT_TTL_MS).toISOString());
 assert.equal(data.digest.length,64);
 assert.equal(data.items[0].bidIsFinalPrice,false);
 assert.equal(data.items[0].askPrice,325);
 assert.equal(data.items[0].location,"Crescent, OR");
 assert.doesNotMatch(data.items[0].summary,/<p>|<\/p>/);
});
test("active snapshot overlays existing grants, with GSA lots first, without overwriting base",()=>{
 const now=Date.UTC(2026,10,7,2,30);
 const gsa=gsaImportDocument(fixture(),{now});
 const result=combinedOpportunities(base,gsa,{now:now+10000});
 assert.equal(result.gsaSnapshot.state,"active");
 assert.equal(result.gsaSnapshot.importedLots,2);
 assert.equal(result.items.length,3);
 assert.equal(result.items[0].kind,"surplus_auction");
 assert.equal(result.summary.auctionCount,2);
 assert.equal(result.summary.grantCount,1);
 assert.equal(result.sources.some(x=>x.name==="GSA Auctions / Windows verified snapshot"&&x.ok),true);
 assert.equal(base.items.length,1); // no in-place overwrite
});
test("expired or future-dated imports never surface stale auction bids",()=>{
 const now=Date.UTC(2026,10,7,2,30),gsa=gsaImportDocument(fixture(),{now});
 const expired=combinedOpportunities(base,gsa,{now:now+GSA_IMPORT_TTL_MS});
 assert.equal(expired.gsaSnapshot.state,"expired_or_invalid");
 assert.equal(expired.summary.auctionCount,0);
 assert.deepEqual(expired.items,base.items);
 const future=combinedOpportunities(base,gsa,{now:now-120000});
 assert.equal(future.gsaSnapshot.state,"expired_or_invalid");
 assert.equal(future.summary.auctionCount,0);
});
test("no import has explicit diagnostic and returns current baseline unchanged",()=>{
 const x=combinedOpportunities(base,null);
 assert.equal(x.gsaSnapshot.state,"not_imported");
 assert.equal(x.items.length,1);
 assert.equal(x.sources.find(s=>s.name==="GSA Auctions / Windows verified snapshot").ok,false);
});
test("empty GSA response cannot be presented as an official live snapshot",()=>{
 assert.throws(()=>gsaImportDocument({auctions:[{saleNo:"ABC",itemName:"Used equipment",auctionStatus:"Closed"}]}),/NO_ACTIVE/);
 assert.throws(()=>gsaImportDocument({foo:"bar"}),/NO_RECOGNIZED_LOTS/);
});

test("hundreds of auction observations do not bury previously collected grants",()=>{
 const lots=Array.from({length:600},(_,i)=>({saleNo:"S-"+i,lotNo:1,itemName:"Surplus fleet truck "+i,auctionStatus:"Active",propertyState:"CA"}));
 const now=Date.UTC(2026,10,7,3);
 const imported=gsaImportDocument({auctions:lots},{now});
 assert.equal(imported.activeCount,600);
 const combined=combinedOpportunities(base,imported,{now:now+1});
 assert.equal(combined.items.length,300);
 assert.equal(combined.summary.auctionCount,299);
 assert.equal(combined.summary.grantCount,1);
 assert.equal(combined.gsaSnapshot.importedLots,600);
 assert.equal(combined.items.at(-1).id,"grant-1");
});
