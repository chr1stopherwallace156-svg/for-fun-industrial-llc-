import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {COUNTRIES,SOURCE_REGISTRY,normalizeLead,prepareInventory,landedCost,categoryFor,sourcesForUI} from "../src/international.mjs";
import {csvRows,readIntake,importIntake} from "../Import-International.mjs";

test("Asia supplier registry includes 12 markets, factory and auction sources, without claiming live feeds",()=>{
 for(const country of ["JP","KR","VN","CN","TW","TH","MY","ID","PH","HK","IN","SG"])assert.ok(COUNTRIES[country]);
 for(const id of ["KR_BUYKOREA","JP_JGOODTECH","TW_TAIWANTRADE","TH_THAITRADE","ID_INAEXPORT","MY_MATRADE","PH_TRADELINE","VN_GOGLOBAL","CN_MADEINCHINA","GLOBAL_ALIBABA","GLOBAL_HKTDC"])
  assert.ok(SOURCE_REGISTRY.some(s=>s.id===id));
 assert.ok(SOURCE_REGISTRY.some(s=>s.id==="KR_ONBID_VEHICLE"&&s.access==="official_api_key_required"));
 assert.ok(SOURCE_REGISTRY.filter(s=>s.api==="not_verified").length>=10);
 assert.ok(sourcesForUI().every(s=>!s.allowedHost));
 assert.equal(prepareInventory([]).count,0);
});
test("no fake listing price when recording a company supplier profile",()=>{
 const x=normalizeLead({sourceId:"TH_THAITRADE",externalId:"company-abc",title:"Thai industrial packaging manufacturer",companyName:"Example Supplier For Offline Test Only",recordType:"supplier_profile",country:"TH",url:"https://www.thaitrade.com/",category:"packaging_materials",minOrderQuantity:500,incoterm:"FOB"});
 assert.equal(x.country,"TH");assert.equal(x.currency,"THB");assert.equal(x.companyName,"Example Supplier For Offline Test Only");
 assert.equal(x.recordType,"supplier_profile");assert.equal(x.minOrderQuantity,500);
 assert.equal(x.priceLocal,null);assert.equal(x.incoterm,"FOB");assert.equal(x.exportEligible,"unknown");
 assert.equal(landedCost(x,{}).state,"blocked");
});
test("Global B2B platform must have actual Asian origin and country-specific currency",()=>{
 const base={sourceId:"GLOBAL_ALIBABA",externalId:"sample-12",title:"bulk lot of industrial components",companyName:"Test Company",url:"https://www.alibaba.com/"};
 assert.throws(()=>normalizeLead(base),/COUNTRY_REQUIRED_OR_UNSUPPORTED/);
 for(const [country,currency] of [["CN","CNY"],["VN","VND"],["IN","INR"],["PH","PHP"],["MY","MYR"],["SG","SGD"],["HK","HKD"],["TW","TWD"]])
  assert.equal(normalizeLead({...base,country}).currency,currency);
 assert.throws(()=>normalizeLead({...base,country:"ZZ"}),/COUNTRY_REQUIRED_OR_UNSUPPORTED/);
 assert.throws(()=>normalizeLead({...base,country:"CN",url:"https://alice:password@www.alibaba.com/"}),/LEAD_SOURCE_URL_NOT_APPROVED/);
 assert.throws(()=>normalizeLead({...base,country:"CN",originPort:"VNSGN"}),/ORIGIN_PORT_MISMATCH/);
});
test("Malaysia and Indonesia company records remain research-only despite official directory sites",()=>{
 const leads=[
 {sourceId:"MY_MATRADE",externalId:"m1",title:"Reusable protective packaging supplier",country:"MY",url:"https://myexport.matrade.gov.my/apps/mpd/",recordType:"supplier_profile",companyName:"Offline Test Packaging",city:"Klang"},
 {sourceId:"ID_INAEXPORT",externalId:"i1",title:"Wooden shipping crates exporter",country:"ID",url:"https://www.inaexport.id/about",recordType:"supplier_profile",companyName:"Offline Test Exporter"}
 ];
 const p=prepareInventory(leads);
 assert.equal(p.count,2);assert.equal(p.countries.MY,1);assert.equal(p.countries.ID,1);
 assert.equal(p.leads.every(x=>x.status==="operator_review_only"&&x.priceLocal===null),true);
 assert.equal(categoryFor("protective packaging materials"),"packaging_materials");
});
test("CSV company and MOQ columns roundtrip via local offline import only",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fi-asia-v2-"));
 try{
  const file=path.join(dir,"suppliers.csv");
  fs.writeFileSync(file,"sourceId,externalId,title,country,url,companyName,recordType,minOrderQuantity,incoterm\nTW_TAIWANTRADE,TW-4,Packaging manufacturer,TW,https://www.taiwantrade.com/,Offline Example Co,supplier_profile,400,FOB\n");
  assert.equal(csvRows(fs.readFileSync(file,"utf8")).length,1);
  const input=readIntake(file);
  assert.equal(input.leads[0].companyName,"Offline Example Co");
  assert.equal(input.leads[0].minOrderQuantity,400);
  const result=importIntake(file,{persist:false,existing:prepareInventory([])});
  assert.equal(result.total,1);assert.equal(result.countries.TW,1);
  assert.deepEqual(fs.readdirSync(dir),["suppliers.csv"]);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
