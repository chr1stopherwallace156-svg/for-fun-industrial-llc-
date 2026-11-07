// Single read-only GSA Auctions feed preview; no persistence, no bids, no logins.
// A DEMO_KEY is test-only. For continuous scheduling use an operator-issued personal API key.
import {normalizeGSA} from "./src/domestic.mjs";
const key=process.env.GSA_API_KEY||"DEMO_KEY";
const source=process.env.GSA_API_KEY?"personal":"demo_only";
const url=new URL("https://api.gsa.gov/assets/gsaauctions/v2/auctions");
url.searchParams.set("api_key",key);url.searchParams.set("format","JSON");
try {
 const res=await fetch(url,{method:"GET",headers:{"accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw Error("GSA_HTTP_"+res.status);
 const raw=await res.text();
 if(raw.length>8_000_000)throw Error("GSA_FEED_OVER_8_MB");
 const data=JSON.parse(raw);
 const lots=normalizeGSA(data).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
 console.log("GSA_PREVIEW=PASS SOURCE="+source+" LOTS_PARSED="+lots.length);
 for(const x of lots.slice(0,16)){
  console.log(["AUCTION",x.title,"LOCATION="+(x.location||"unknown"),"BID="+(x.askPrice===null?"not supplied":("$"+x.askPrice.toFixed(2))),
    "CLOSE="+(x.deadline||"not provided"),"SCORE="+x.score,"URL="+(x.url||"unavailable")].join(" | ").slice(0,450));
 }
 console.log("NOTE=Highest bid may not equal final sale price. Inspect condition, fees and shipping before a decision.");
} catch(e){
 console.error("GSA_PREVIEW=UNAVAILABLE REASON="+String(e.message||e).slice(0,160));
 process.exitCode=1;
}
