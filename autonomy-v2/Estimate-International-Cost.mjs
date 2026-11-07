// Evaluates an operator-provided landed-cost scenario for one imported listing.
// No market prices, currency rates, duties or resale estimates are invented.
import {isAbsolute,extname} from "node:path";
import {readFileSync,statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {readJSON} from "./src/core.mjs";
import {landedCost} from "./src/international.mjs";
export function estimate(leadId,costs,inventory){
 const lead=(inventory?.leads||[]).find(x=>x.id===leadId);
 if(!lead)throw Error("INVENTORY_LEAD_ID_NOT_FOUND");
 return {leadId,source:lead.source,title:lead.title,origin:lead.country,priceLocal:lead.priceLocal,currency:lead.currency,
  result:landedCost(lead,costs),status:"SCENARIO_NOT_A_QUOTE_OR_GUARANTEED_PROFIT"};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const file=process.argv[2],id=process.argv[3];
  if(!file||!isAbsolute(file)||extname(file).toLowerCase()!==".json"||!id)throw Error("ABSOLUTE_SCENARIO_JSON_AND_LEAD_ID_REQUIRED");
  if(statSync(file).size>20000)throw Error("SCENARIO_TOO_LARGE");
  const r=estimate(id,JSON.parse(readFileSync(file,"utf8")),readJSON("international-inventory.json",{leads:[]}));
  console.log("INTERNATIONAL_LANDED_COST=SCENARIO_ONLY");
  console.log(JSON.stringify(r,null,2));
  if(r.result.state!=="scenario_only_not_verified")process.exitCode=2;
 }catch(e){console.error("LANDED_COST=FAILED REASON="+String(e.message).slice(0,130));process.exitCode=1}
}
