// Blend operator-run, officially downloaded GSA auctions into the existing
// domestic dashboard. Imported observations expire; a past bid isn't a live quote.
import {normalizeGSA} from "./domestic.mjs";
import {createHash} from "node:crypto";
export const GSA_IMPORT_TTL_MS=2*60*60*1000;
export function gsaImportDocument(raw,{now=Date.now()}={}){
 const lots=normalizeGSA(raw);
 if(!Number.isFinite(now)||lots.length===0)throw Error("GSA_IMPORT_NO_VERIFIED_LOTS");
 const active=lots.filter(x=>/Auction status:\s*Active\b/i.test(x.summary));
 if(!active.length)throw Error("GSA_IMPORT_HAS_NO_ACTIVE_LOTS");
 const checkedAt=new Date(now).toISOString(),expiresAt=new Date(now+GSA_IMPORT_TTL_MS).toISOString();
 const digest=createHash("sha256").update(JSON.stringify(raw)).digest("hex");
 return {schema:1,feed:"GSA Auctions",source:"official_api_manual_download",checkedAt,expiresAt,digest,activeCount:active.length,lotCount:lots.length,
  items:active.slice(0,3000).map(x=>({...x,checkedAt,expiresAt,evidence:"official_gsa_manual_snapshot",status:"unverified_details_bid_not_final",bidIsFinalPrice:false}))};
}
export function combinedOpportunities(base,imported,{now=Date.now()}={}){
 const original=base&&typeof base==="object"?base:{};
 const items=Array.isArray(original.items)?original.items:[];
 const sources=Array.isArray(original.sources)?original.sources:[];
 const check=Date.parse(imported?.checkedAt||""),expiry=Date.parse(imported?.expiresAt||"");
 const valid=imported?.schema===1&&imported?.source==="official_api_manual_download"&&
  Number.isFinite(check)&&Number.isFinite(expiry)&&check<=now+60_000&&expiry>now&&expiry-check===GSA_IMPORT_TTL_MS&&
  Array.isArray(imported?.items)&&imported.items.length>0&&imported.items.length<=3000;
 const eligible=valid?imported.items.filter(x=>x?.source==="GSA Auctions"&&x?.kind==="surplus_auction"&&x?.bidIsFinalPrice===false):[];
 const merged=new Map();
 for(const item of [...eligible,...items])if(item?.id&&!merged.has(item.id))merged.set(item.id,item);
 // Auctions first, then sort by topical relevance; do not claim these are bargains.
 const ranked=[...merged.values()].sort((a,b)=>Number(b.kind==="surplus_auction")-Number(a.kind==="surplus_auction")||(Number(b.score)||0)-(Number(a.score)||0));
 const auctionRows=ranked.filter(x=>x.kind==="surplus_auction"),otherRows=ranked.filter(x=>x.kind!=="surplus_auction");
 const maxAuctions=300-Math.min(40,otherRows.length);
 const displayed=[...auctionRows.slice(0,maxAuctions),...otherRows.slice(0,300-maxAuctions)];
 const status=valid&&eligible.length?"active":imported?.checkedAt?"expired_or_invalid":"not_imported";
 const supplemental={name:"GSA Auctions / Windows verified snapshot",ok:valid&&eligible.length>0,detail:status==="active"?"Manual official API download; expires "+imported.expiresAt:status==="not_imported"?"Not imported; run approved Windows preview import":"Snapshot expired or invalid — refresh required",count:valid?eligible.length:0};
 return {...original,checkedAt:valid?imported.checkedAt:(original.checkedAt||null),scope:"United States",items:displayed,sources:[...sources.filter(s=>s?.name!==supplemental.name),supplemental],
  summary:{...(original.summary||{}),total:displayed.length,auctionCount:displayed.filter(x=>x.kind==="surplus_auction").length,grantCount:displayed.filter(x=>x.kind==="grant").length,bidCount:displayed.filter(x=>x.kind==="solicitation").length},
  gsaSnapshot:{state:status,checkedAt:imported?.checkedAt||null,expiresAt:imported?.expiresAt||null,importedLots:valid?eligible.length:0,source:"official_manual_download_not_recurring",bidIsFinalPrice:false}};
}
