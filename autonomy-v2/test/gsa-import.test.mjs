import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {importFromFile} from "../GSA-Import-From-File.mjs";

test("GSA import CLI accepts official-shape JSON but unit test never writes runtime",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fi-gsa-import-test-"));
 try{
  const f=path.join(dir,"official.json");
  fs.writeFileSync(f,JSON.stringify({auctions:[{saleNo:"XX1",lotNo:9,itemName:"Salvage truck",auctionStatus:"Active",propertyCity:"Sacramento",propertyState:"CA",highBidAmount:2500}]}),"utf8");
  const r=importFromFile(f,{persist:false});
  assert.equal(r.imported,1);assert.equal(r.allParsed,1);assert.equal(r.stored,false);
  assert.ok(Date.parse(r.expiresAt)>Date.parse(r.checkedAt));
  assert.equal(fs.readdirSync(dir).length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test("import rejects relative paths, invalid JSON and oversized files",()=>{
 assert.throws(()=>importFromFile("relative.json",{persist:false}),/ABSOLUTE/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fi-gsa-import-negative-"));
 try{
  const f=path.join(dir,"invalid.json");fs.writeFileSync(f,"not json");
  assert.throws(()=>importFromFile(f,{persist:false}));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
