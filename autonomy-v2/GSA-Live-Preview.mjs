// One-off read-only official GSA Auctions preview.
// This NEVER writes secrets, places bids or modifies the live Fun Industrial database.
// DEMO_KEY is a limited GSA public test key; a personal key belongs in the process env.
import {normalizeGSA} from "./src/domestic.mjs";
const key=process.env.GSA_API_KEY||"DEMO_KEY";
const u=new URL("https://api.gsa.gov/assets/gsaauctions/v2/auctions");
u.searchParams.set("api_key",key);u.searchParams.set("format","JSON");
try{
 const response=await fetch(u.href,{headers:{accept:"application/json"},signal:AbortSignal.timeout(30000),redirect:"error"});
 if(!response.ok)throw Error("GSA_HTTP_"+response.status+"; get a personal key from api.data.gov/signup/ if DEMO_KEY is exhausted");
 const raw=await response.text();
 if(raw.length>25_000_000)throw Error("GSA_RESPONSE_OVER_25_MB");
 const items=normalizeGSA(JSON.parse(raw)).sort((a,b)=>b.score-a.score);
 console.log("GSA_LIVE_PREVIEW=PASS AUCTION_LOTS_PARSED="+items.length+" OUTPUT=TOP_20_RELEVANCE_ONLY");
 for(const item of items.slice(0,20))console.log(JSON.stringify({title:item.title,location:item.location,deadline:item.deadline,observedBid:item.askPrice,score:item.score,source:item.url,summary:item.summary.slice(0,180)}));
 console.log("BIDDING=DISABLED DATA_NOT_SAVED=TRUE");
}catch(e){console.error("GSA_LIVE_PREVIEW=FAILED REASON="+String(e.message).slice(0,220));process.exitCode=1}
