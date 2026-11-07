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
