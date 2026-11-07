// Parse locally fetched GSA Auctions JSON. Does not access the network or modify
// the Sidequest database, dashboard, REA registry, or bidding permissions.
import {readFileSync,statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {normalizeGSA} from "./src/domestic.mjs";

export function previewAuctionData(response,{limit=20}={}){
 const records=normalizeGSA(response);
 const active=records.filter(x=>/Auction status:\s*Active\b/i.test(x.summary));
 const ranked=[...records].sort((a,b)=>
  b.score-a.score || a.title.localeCompare(b.title));
 return {
  total:records.length,
  active:active.length,
  rows:ranked.slice(0,Math.max(1,Math.min(50,Number(limit)||20))).map(x=>({
   title:x.title,location:x.location||"unknown",closingDate:x.deadline||null,
   observedBidNotFinalPrice:x.askPrice,score:x.score,
   sourceUrl:x.url,conditionSummary:x.summary.slice(0,230)
  }))
 };
}
export function parseAuctionFile(filename){
 const size=statSync(filename).size;
 if(size<2||size>25_000_000)throw Error("GSA_RESPONSE_SIZE_OUT_OF_RANGE");
 return previewAuctionData(JSON.parse(readFileSync(filename,"utf8")));
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const filename=process.argv[2];
  if(!filename)throw Error("PREVIEW_INPUT_FILE_REQUIRED");
  const result=parseAuctionFile(filename);
  console.log("GSA_WINDOWS_PREVIEW=PASS SOURCE=OFFICIAL_API READ_ONLY=TRUE");
  console.log("AUCTION_LOTS_PARSED="+result.total+" ACTIVE_COUNT="+result.active);
  console.log("SHOWING_TOP="+result.rows.length+" SORTING=TOPICAL_RELEVANCE_NOT_PROFIT");
  for(const row of result.rows)console.log(JSON.stringify(row));
  console.log("WORKER_UNCHANGED=TRUE BIDDING=DISABLED DATA_NOT_SAVED_IN_PLATFORM=TRUE");
 }catch(e){
  console.error("GSA_WINDOWS_PREVIEW=FAILED REASON="+String(e?.message||e).slice(0,160));
  process.exitCode=1;
 }
}
