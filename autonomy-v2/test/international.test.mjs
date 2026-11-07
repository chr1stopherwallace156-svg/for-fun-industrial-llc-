import test from "node:test";
import assert from "node:assert/strict";
import {SOURCE_REGISTRY,PORTS,categoryFor,makerFor,normalizeLead,prepareInventory,filterInventory,landedCost,sourcesForUI} from "../src/international.mjs";
const lead={sourceId:"JP_KSI",externalId:"listing-120",title:"トヨタ フォークリフト パレット 一括",country:"JP",city:"Yokohama",originPort:"JPYOK",priceLocal:200000,priceType:"ask",url:"https://kankocho.jp/items/120"};
test("country registry has JP, KR and VN official sources without fabricated listings",()=>{
 assert.ok(SOURCE_REGISTRY.some(x=>x.country==="JP"&&x.id==="JP_KSI"));
 assert.ok(SOURCE_REGISTRY.some(x=>x.country==="KR"&&x.id==="KR_ONBID_MOVABLE"));
 assert.ok(SOURCE_REGISTRY.some(x=>x.country==="VN"&&x.id==="VN_MOJ"));
 assert.ok(PORTS.some(x=>x.code==="KRPUS"));
 assert.equal(prepareInventory([]).count,0);
});
test("multilingual manufacturer and category extraction",()=>{
 assert.equal(categoryFor("노트북 전자부품"),"electronics_components");
 assert.equal(categoryFor("máy móc thiết bị"),"industrial_equipment");
 assert.equal(categoryFor("まとめ売り パレット"),"bulk_lots");
 assert.equal(makerFor("현대"),"HYUNDAI");
 assert.equal(makerFor("トヨタ"),"TOYOTA");
 const x=normalizeLead(lead);
 assert.equal(x.country,"JP");assert.equal(x.currency,"JPY");assert.equal(x.originPort,"JPYOK");assert.equal(x.manufacturer,"TOYOTA");
 assert.equal(x.category,"bulk_lots");
 assert.equal(x.provenance,"operator_supplied_public_listing_unverified");
});
test("normalize Korean vehicle and Vietnamese lot without claiming exportability",()=>{
 const kr=normalizeLead({sourceId:"KR_ONBID_VEHICLE",externalId:"42",title:"현대 차량 중고",url:"https://www.onbid.co.kr/item/42",priceLocal:6000000,quantity:1,originPort:"KRPUS"});
 const vn=normalizeLead({sourceId:"VN_MOJ",externalId:"11",title:"Lô hàng vải",url:"https://dgts.moj.gov.vn/bids/11",priceLocal:"15,000,000",quantity:10,originPort:"VNSGN"});
 assert.equal(kr.manufacturer,"HYUNDAI");assert.equal(kr.currency,"KRW");assert.equal(kr.exportEligible,"unknown");
 assert.equal(vn.category,"bulk_lots");assert.equal(vn.currency,"VND");
 assert.equal(kr.bidIsFinalPrice,false);
});
test("rejects country mismatch, arbitrary website, passwords in URLs, port mismatch, unrecognized source and invalid price",()=>{
 for(const x of [
  {...lead,country:"KR"},
  {...lead,url:"https://evil.example.org/lot"},
  {...lead,url:"https://alice:password@kankocho.jp/lot"},
  {...lead,url:"http://kankocho.jp/lot"},
  {...lead,originPort:"KRPUS"},
  {...lead,sourceId:"NOT_APPROVED"},
  {...lead,priceLocal:"unpriced"}
 ])assert.throws(()=>normalizeLead(x));
 assert.throws(()=>normalizeLead({...lead,sourceId:"GLOBAL_OSH"}),/FACILITY_NOT_A_SELLER/);
});
test("deduplicates source identity, validates imports and filters by make, origin and category",()=>{
 const x=prepareInventory([lead,{...lead,externalId:"other",title:"Toyota truck used",url:"https://kankocho.jp/items/121"},{sourceId:"KR_ONBID_MOVABLE",externalId:"k01",title:"Electronic components",url:"https://onbid.co.kr/a/7"}]);
 assert.equal(x.count,3);assert.equal(x.countries.JP,2);assert.equal(x.countries.KR,1);
 assert.equal(filterInventory(x,{country:"JP"}).length,2);
 assert.equal(filterInventory(x,{manufacturer:"トヨタ"}).length,2);
 assert.equal(filterInventory(x,{query:"truck"}).length,1);
 assert.throws(()=>prepareInventory([lead,lead]),/DUPLICATE_SOURCE_ID/);
 assert.equal(sourcesForUI().some(x=>x.allowedHost),false);
});
test("landed-cost scenario requires supplied FX/freight/duties/insurance and does not promise profit",()=>{
 const item=normalizeLead(lead);
 const missing=landedCost(item,{usdPerLocal:0.0065});
 assert.equal(missing.state,"blocked");assert.ok(missing.missing.includes("dutyUsd"));
 const scenario=landedCost(item,{priceBasis:"lot_total",usdPerLocal:0.0065,internationalFreightUsd:1000,domesticFreightUsd:500,insuranceUsd:75,dutyUsd:200,brokerageUsd:160,portAndStorageUsd:240,inspectionUsd:100,otherUsd:125,resaleEstimateUsd:4800});
 assert.equal(scenario.merchandiseUsd,1300);assert.equal(scenario.landedUsd,3700);
 assert.equal(scenario.grossBeforeIncomeTaxAndOverheadUsd,1100);assert.equal(scenario.state,"scenario_only_not_verified");
});

test("whole lot vs per-unit prices cannot be confused",()=>{
 const item=normalizeLead({...lead,priceLocal:500,quantity:10,priceBasis:"unknown"});
 const costs={usdPerLocal:0.006,internationalFreightUsd:100,domesticFreightUsd:20,insuranceUsd:10,dutyUsd:40,brokerageUsd:30,portAndStorageUsd:20,inspectionUsd:10,otherUsd:0,resaleEstimateUsd:500};
 assert.deepEqual(landedCost(item,costs).missing,["priceBasis_lot_total_or_per_unit"]);
 const total=landedCost(item,{...costs,priceBasis:"lot_total"});
 const each=landedCost(item,{...costs,priceBasis:"per_unit"});
 assert.equal(total.merchandiseUsd,3);
 assert.equal(each.merchandiseUsd,30);
 assert.equal(each.quantityUsed,10);
});
