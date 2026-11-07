import test from "node:test";
import assert from "node:assert/strict";
import {COUNTRIES,SOURCE_REGISTRY,PORTS,categoryFor,normalizeLead,prepareInventory,landedCost,sourcesForUI} from "../src/international.mjs";

test("publicly browsable alternatives coexist with Korean API in disabled-by-access posture",()=>{
 for(const c of ["DE","NL","FR","CA","AU","AE","GB","US","JP","KR","VN"])assert.ok(COUNTRIES[c]);
 for(const id of ["DE_ZOLL","EU_TROOSTWIJK","CA_GOVDEALS","GLOBAL_RITCHIE","GLOBAL_BSTOCK"])
  assert.ok(SOURCE_REGISTRY.find(s=>s.id===id));
 const korean=SOURCE_REGISTRY.filter(s=>s.id.startsWith("KR_ONBID"));
 assert.equal(korean.length,2);
 assert.ok(korean.every(s=>s.access==="official_api_key_required"));
 for(const p of ["NLRTM","DEHAM","CAVAN","AEJEA","AUSYD","GBFXT"])assert.ok(PORTS.find(x=>x.code===p));
});
test("German government surplus listing requires official origin and EUR, not Korean credentials",()=>{
 const item=normalizeLead({sourceId:"DE_ZOLL",externalId:"A-99",title:"3 Paletten Restposten Maschinen",country:"DE",originPort:"DEHAM",url:"https://www.zoll-auktion.de/auktion/auktion.php?id=100",priceLocal:1200,priceType:"current_bid",priceBasis:"lot_total"});
 assert.equal(item.country,"DE");assert.equal(item.currency,"EUR");
 assert.equal(item.category,"bulk_lots");assert.equal(item.originPort,"DEHAM");
 assert.equal(item.bidIsFinalPrice,false);assert.equal(item.exportEligible,"unknown");
});
test("Europe multi-country liquidation needs explicit origin and chooses that currency",()=>{
 const base={sourceId:"EU_TROOSTWIJK",externalId:"lot-123",title:"pallet warehouse liquidation",url:"https://www.troostwijkauctions.com/en/l/some-lot",priceLocal:900};
 assert.throws(()=>normalizeLead(base),/COUNTRY_UNSUPPORTED_OR_REQUIRED/);
 const nl=normalizeLead({...base,country:"NL",originPort:"NLRTM"});
 assert.equal(nl.currency,"EUR");assert.equal(nl.country,"NL");
 const gb=normalizeLead({...base,country:"GB",originPort:"GBFXT"});
 assert.equal(gb.currency,"GBP");assert.equal(gb.country,"GB");
 assert.throws(()=>normalizeLead({...base,country:"KR"}),/COUNTRY_NOT_OFFERED_BY_SOURCE/);
 assert.throws(()=>normalizeLead({...base,country:"NL",originPort:"DEHAM"}),/ORIGIN_PORT_MISMATCH/);
});
test("Ritchie global source supports real origin in Australia, UAE and Canada",()=>{
 const item={sourceId:"GLOBAL_RITCHIE",externalId:"r1",title:"Used heavy duty commercial truck",url:"https://www.rbauction.com/lots/example",priceLocal:10500};
 for(const [country,currency] of [["AU","AUD"],["AE","AED"],["CA","CAD"]]){
  const lead=normalizeLead({...item,country});
  assert.equal(lead.currency,currency);assert.equal(lead.country,country);
 }
 const alternateHost=normalizeLead({...item,country:"CA",url:"https://www.rbauctioneers.com/lots/example"});
 assert.equal(alternateHost.country,"CA");
});
test("allowlisted marketplace sources reject lookalike hosts, login URLs and mismatched countries",()=>{
 const item={sourceId:"GLOBAL_BSTOCK",country:"US",externalId:"B1",title:"liquidation pallet returns",url:"https://bstock.com/auctions/lot/123"};
 assert.equal(normalizeLead(item).country,"US");
 for(const url of ["http://bstock.com/auctions/lot","https://bstock.com.example.com/a","https://user:pw@bstock.com/a","https://evil.example/a","https://bstock.com:8443/a"])
  assert.throws(()=>normalizeLead({...item,url}),/LEAD_SOURCE_URL_NOT_APPROVED/);
 assert.throws(()=>normalizeLead({...item,country:"KR"}),/COUNTRY_NOT_OFFERED_BY_SOURCE/);
 const results=prepareInventory([item,{sourceId:"CA_GOVDEALS",country:"CA",externalId:"C1",title:"Municipal surplus forklift",url:"https://prod-seo.govdeals.ca/en/asset/123"}]);
 assert.equal(results.count,2);assert.equal(results.countries.CA,1);assert.equal(results.countries.US,1);
});
test("shipping containers distinguished from goods inside crates; profit estimator remains quote-only",()=>{
 assert.equal(categoryFor("20ft shipping container"),"shipping_containers");
 assert.equal(categoryFor("Mischpaletten Restposten"),"bulk_lots");
 assert.equal(categoryFor("warehouse cargo pallet of returns"),"bulk_lots");
 const item=normalizeLead({sourceId:"DE_ZOLL",externalId:"x",title:"Storage container",url:"https://www.zoll-auktion.de/auktion/",priceLocal:4500});
 assert.equal(landedCost(item,{}).state,"blocked");
 assert.equal(sourcesForUI().length,SOURCE_REGISTRY.length);
 assert.equal(sourcesForUI().some(s=>s.allowedHost||s.allowedHosts),false);
});
