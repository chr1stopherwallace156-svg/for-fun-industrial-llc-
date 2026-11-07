import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {parseAuctionFile,previewAuctionData} from "../GSA-Preview-From-File.mjs";

test("GSA Windows offline preview reads a real-shape GSA JSON and never needs network",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fi-gsa-preview-"));
 try{
  const f=path.join(dir,"gsa.json");
  fs.writeFileSync(f,JSON.stringify({auctions:[{
   saleNo:"TEST-SALE-01",lotNo:9,itemName:"Industrial diesel generator",
   auctionStatus:"Active",propertyCity:"Riverside",propertyState:"CA",
   biddersCount:2,highBidAmount:"$1,250.00",
   lotInfo:"<h4>Overview</h4><p>Used, inspection required &amp; tested</p>",
   aucEndDt:"2026-11-24"
  }]}),"utf8");
  const r=parseAuctionFile(f);
  assert.equal(r.total,1);assert.equal(r.active,1);
  assert.equal(r.rows[0].location,"Riverside, CA");
  assert.equal(r.rows[0].observedBidNotFinalPrice,1250);
  assert.match(r.rows[0].conditionSummary,/Used, inspection required & tested/);
  assert.doesNotMatch(r.rows[0].conditionSummary,/<h4>|<p>/i);
  const script=fileURLToPath(new URL("../GSA-Preview-From-File.mjs",import.meta.url));
  const p=spawnSync(process.execPath,[script,f],{encoding:"utf8",timeout:8000});
  assert.equal(p.status,0,p.stderr);
  assert.match(p.stdout,/GSA_WINDOWS_PREVIEW=PASS/);
  assert.match(p.stdout,/AUCTION_LOTS_PARSED=1 ACTIVE_COUNT=1/);
  assert.match(p.stdout,/BIDDING=DISABLED/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test("GSA offline parser rejects missing and invalid data rather than showing fabricated lots",()=>{
 assert.throws(()=>previewAuctionData({notAuctions:[]}),/NO_RECOGNIZED_LOTS/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fi-gsa-invalid-"));
 try{
  const f=path.join(dir,"invalid.json");fs.writeFileSync(f,"not JSON");
  assert.throws(()=>parseAuctionFile(f),/Unexpected token|not valid JSON/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
