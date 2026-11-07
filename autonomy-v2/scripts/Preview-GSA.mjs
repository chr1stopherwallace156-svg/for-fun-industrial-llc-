// One-time GSA read-only inspection, never writes credentials, files or autonomous jobs.
// DEMO_KEY is for this manual preview only, not the Sidequest scheduler.
import {normalizeGSA} from "../src/domestic.mjs";
const key=process.env.GSA_API_KEY||"DEMO_KEY";
const url=new URL("https://api.gsa.gov/assets/gsaauctions/v2/auctions");
url.searchParams.set("api_key",key);
url.searchParams.set("format","JSON");
try{
 const r=await fetch(url,{signal:AbortSignal.timeout(35000),redirect:"error",headers:{accept:"application/json"}});
 if(!r.ok)throw Error("GSA_HTTP_"+r.status);
 const contentType=r.headers.get("content-type")||"";
 const declared=Number(r.headers.get("content-length")||0);
 if(declared>25_000_000)throw Error("GSA_RESPONSE_TOO_LARGE");
 const body=await r.text();
 if(body.length>25_000_000)throw Error("GSA_RESPONSE_TOO_LARGE");
 const lots=normalizeGSA(JSON.parse(body));
 const active=lots.filter(x=>x.summary.includes("Auction status: Active"));
 const target=active.length?active:lots;
 const matching=target.filter(x=>/\b(truck|van|vehicle|generator|machin|equipment|industrial|pallet|tool|forklift|automotive|parts|lot)\b/i.test(x.title+" "+x.summary));
 const ranked=(matching.length?matching:target).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
 process.stdout.write("GSA_LIVE=PASS MODE=READ_ONLY_PREVIEW AUTH="+(key==="DEMO_KEY"?"DEMO_KEY":"USER_KEY")+"\n");
 process.stdout.write("GSA_TOTAL_LOTS="+lots.length+" ACTIVE="+active.length+" MATCHING="+matching.length+"\n");
 process.stdout.write("GSA_SCHEMA=LIVE_CAMELCASE_SUPPORTED REA_CALLS=0 BIDS=0\n");
 for(const row of ranked.slice(0,12)){
  process.stdout.write(JSON.stringify({title:row.title,location:row.location,deadline:row.deadline,observedBidNotFinalPrice:row.askPrice,score:row.score,url:row.url})+"\n");
 }
}catch(e){
 process.stderr.write("GSA_LIVE_PREVIEW_FAILED="+String(e?.message||e).replaceAll(key,"[REDACTED]").slice(0,200)+"\n");
 process.exitCode=1;
}
