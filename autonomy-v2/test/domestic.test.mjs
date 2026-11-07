import test from "node:test";
import assert from "node:assert/strict";
import {normalizeGrants,normalizeSAM,normalizeGSA,validateManual,scoreOpportunity,scanDomestic} from "../src/domestic.mjs";
test("grants.gov search response becomes evidence-labelled leads",()=>{
 const x=normalizeGrants({errorcode:0,data:{oppHits:[{id:"29399",number:"A-300",title:"Electric fleet pilot",agencyName:"DOE",oppStatus:"posted",closeDate:"11/30/2026"}]}},"vehicle");
 assert.equal(x.length,1);assert.equal(x[0].source,"Grants.gov");assert.equal(x[0].kind,"grant");assert.equal(x[0].status,"unverified_details");assert.match(x[0].url,/grants.gov/);
});
test("malformed upstream response fails closed rather than inventing data",()=>{
 assert.throws(()=>normalizeGrants({}),/INVALID/);assert.throws(()=>normalizeSAM({}),/INVALID/);
 assert.throws(()=>normalizeGSA({unexpected:"none"}),/NO_RECOGNIZED_LOTS/);
});
test("government solicitation and surplus normalization",()=>{
 const sam=normalizeSAM({opportunitiesData:[{noticeId:"aa11",title:"Fleet truck maintenance",type:"Solicitation",responseDeadLine:"2026-12-12",uiLink:"https://sam.gov/opp/aa11/view"}]});
 assert.equal(sam[0].kind,"solicitation");assert.equal(sam[0].deadline,"2026-12-12");
 const gsa=normalizeGSA({Results:{Result:[{SaleNo:"A123",LotNo:"08",ItemName:"Used pallet of industrial parts",HighBidAmount:"370.50",PropertyCity:"Los Angeles",PropertyState:"CA"}]}});
 assert.equal(gsa[0].kind,"surplus_auction");assert.equal(gsa[0].askPrice,370.5);assert.equal(gsa[0].currency,"USD");
});
test("GSA live camelCase response captures active sale, bidder count, and safe condition text",()=>{
 const sample={auctions:[
  {saleNo:"91QSCI-26-100",lotNo:12,itemName:"Six pairs of extreme cold boots",
   auctionStatus:"Active",propertyCity:"Pullman",propertyState:"WA",biddersCount:2,
   highBidAmount:"$1,250.50",aucEndDt:"2026-11-12",
   lotInfo:"<h4>Overview</h4><p>This lot contains (6) pairs of extreme cold boots.</p><p>Parts may be missing; repairs &amp; inspection required.</p><script>alert('x')</script>",
   itemDescURL:"https://www.gsaauctions.gov/"
  }]};
 const out=normalizeGSA(sample);
 assert.equal(out.length,1);
 assert.equal(out[0].kind,"surplus_auction");
 assert.equal(out[0].source,"GSA Auctions");
 assert.equal(out[0].location,"Pullman, WA");
 assert.equal(out[0].askPrice,1250.50);
 assert.equal(out[0].deadline,"2026-11-12");
 assert.match(out[0].summary,/Auction status: Active/);
 assert.match(out[0].summary,/Bidders: 2/);
 assert.match(out[0].summary,/Parts may be missing/);
 assert.doesNotMatch(out[0].summary,/<h4>|<p>|<script>/i);
 assert.match(out[0].summary,/Highest observed bid \(not final price\)/);
});
test("GSA response preserves legacy fields and safely rejects malformed values",()=>{
 const x=normalizeGSA({Results:{Result:[{
   SaleNo:"SELL-01",LotNo:"2",ItemName:"Government surplus pallet",
   HighBidAmount:"not-a-number",AuctionStatus:"A",
   LotDescript:"<p>Used &amp; untested</p>",PropertyState:"CA",PropertyCity:"Los Angeles"}]}});
 assert.equal(x[0].askPrice,null);
 assert.equal(x[0].location,"Los Angeles, CA");
 assert.match(x[0].summary,/Used & untested/);
});
test("GSA scan works with a separately supplied key and never uses it in result diagnostics",async()=>{
 const grants={errorcode:0,data:{oppHits:[]}};
 const sample={items:[{saleNo:"US-812",lotNo:1,itemName:"Fleet truck",auctionStatus:"Active",propertyCity:"Sacramento",propertyState:"CA",highBidAmount:900}]};
 const seen=[];
 const fetcher=async(url)=>{
  seen.push(url);
  return {ok:true,text:async()=>JSON.stringify(url.includes("gsa.gov")?sample:grants)};
 };
 const out=await scanDomestic({fetcher,env:{GSA_API_KEY:"unit-test-secret"},manual:[]});
 assert.equal(out.summary.auctionCount,1);
 assert.equal(out.items[0].title,"Fleet truck");
 assert.equal(out.sources.find(s=>s.name==="GSA Auctions").ok,true);
 assert.equal(out.sources.find(s=>s.name==="GSA Auctions").count,1);
 assert.ok(seen.some(u=>u.includes("api_key=unit-test-secret")));
 assert.doesNotMatch(JSON.stringify(out),/unit-test-secret/);
});
test("ranking is relevance, not profitability or a purchase recommendation",()=>{
 const a={title:"Fleet truck equipment lot",summary:"salvage"};
 const b={title:"Art history lecture",summary:""};
 assert.ok(scoreOpportunity(a)>scoreOpportunity(b));
 const lead=validateManual([{id:"item-001",title:"Warehouse pallet lot",url:"http://bad.example/redirect",askPrice:500}])[0];
 assert.equal(lead.url,"");assert.equal(lead.kind,"manual_review");
});
test("read-only scan tolerates absent keyed feeds, never attempts arbitrary website",async()=>{
 const calls=[];const grants={errorcode:0,data:{oppHits:[{id:"test",title:"Test vehicle grant",agencyName:"DOE"}]}};
 const fetcher=async(url,options)=>{calls.push({url,method:options.method,body:options.body});return {ok:true,text:async()=>JSON.stringify(grants)}};
 const out=await scanDomestic({fetcher,env:{},manual:[{id:"manual",title:"Estate sale - publicly advertised auction",url:"https://example.gov/estate/1"}]});
 assert.equal(calls.length,2);assert.ok(calls.every(x=>x.url==="https://api.grants.gov/v1/api/search2"&&x.method==="POST"));
 assert.equal(out.items.length,2);assert.equal(out.summary.workingSources,3);assert.equal(out.summary.unavailableSources,2);
 assert.ok(out.sources.find(x=>x.name==="SAM.gov solicitations"&&x.detail.includes("API_KEY_REQUIRED")));
 assert.equal(out.mode,"read_only_discovery");
});
test("upstream request failure is recorded without stopping other sources",async()=>{
 const fetcher=async()=>({ok:false,status:429});
 const out=await scanDomestic({fetcher,env:{},manual:[]});
 assert.equal(out.summary.total,0);assert.equal(out.sources.filter(s=>s.detail==="HTTP_429").length,2);
});
