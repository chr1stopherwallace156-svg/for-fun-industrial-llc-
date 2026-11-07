// Safe local CSV/JSON imports into Fun Industrial international sourcing.
// Imports are operator-supplied public listings, not automatically scraped/live quotes.
import {readFileSync,statSync} from "node:fs";
import {extname,isAbsolute} from "node:path";
import {fileURLToPath} from "node:url";
import {prepareInventory,COUNTRIES} from "./src/international.mjs";
import {readJSON,atomicJSON,logEvent} from "./src/core.mjs";
const DATA_FILE="international-inventory.json";
const FIELDS=new Set(["sourceId","externalId","title","titleLocal","description","country","category","manufacturer","model","city","region","originPort","quantity","unit","priceLocal","priceType","priceBasis","companyName","recordType","minOrderQuantity","incoterm","url","condition","observedAt"]);
export function csvRows(raw){
 const cells=[],rows=[];let cell="",row=[],quoted=false;
 for(let i=0;i<raw.length;i++){
  const ch=raw[i];
  if(ch==='"'){if(quoted&&raw[i+1]==='"'){cell+='"';i++}else if(!quoted&&!cell){quoted=true}else if(quoted){quoted=false}else throw Error("CSV_QUOTE_MALFORMED")}
  else if(ch===","&&!quoted){row.push(cell);cell=""}
  else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&raw[i+1]==="\n")i++;row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell=""}
  else cell+=ch;
 }
 if(quoted)throw Error("CSV_UNCLOSED_QUOTE");
 row.push(cell);if(row.some(s=>s.trim()))rows.push(row);
 if(!rows.length)return [];
 const header=rows.shift().map(x=>x.trim());
 if(header.some(x=>!FIELDS.has(x))||new Set(header).size!==header.length||!header.includes("sourceId")||!header.includes("externalId")||!header.includes("title")||!header.includes("url"))throw Error("CSV_HEADER_NOT_APPROVED");
 return rows.map((r,i)=>{
  if(r.length!==header.length)throw Error("CSV_ROW_WIDTH_INVALID_"+(i+2));
  return Object.fromEntries(header.map((field,j)=>[field,r[j].trim()]));
 });
}
export function readIntake(filename){
 if(!isAbsolute(filename))throw Error("ABSOLUTE_IMPORT_PATH_REQUIRED");
 const ext=extname(filename).toLowerCase();
 if(![".csv",".json"].includes(ext))throw Error("ONLY_CSV_JSON_ALLOWED");
 if(statSync(filename).size>2_000_000)throw Error("IMPORT_FILE_OVER_2MB");
 const text=readFileSync(filename,"utf8").replace(/^\uFEFF/,"");
 const rows=ext===".csv"?csvRows(text):JSON.parse(text);
 return prepareInventory(rows);
}
export function importIntake(filename,{persist=true,existing=null}={}){
 const incoming=readIntake(filename);
 const current=existing??readJSON(DATA_FILE,null);
 const old=Array.isArray(current?.leads)?current.leads:[];
 const map=new Map(old.map(r=>[r.id,r]));
 const now=new Date().toISOString();for(const item of incoming.leads)map.set(item.id,{...item,sourceLastImportedAt:now});
 if(map.size>500)throw Error("CUMULATIVE_LEADS_OVER_500");
 const merged=prepareInventory([]),countByCountry=Object.fromEntries(Object.keys(COUNTRIES).map(c=>[c,0]));
 merged.leads=[...map.values()];merged.count=merged.leads.length;
 for(const row of merged.leads)if(row.country in countByCountry)countByCountry[row.country]++;
 merged.countries=countByCountry;merged.importedAt=new Date().toISOString();
 merged.provenance="operator_supplied_public_listings_unverified";
 if(persist){atomicJSON(DATA_FILE,merged);logEvent("international_inventory_imported",{newOrUpdated:incoming.count,total:merged.count,countries:countByCountry})}
 return {total:merged.count,newOrUpdated:incoming.count,countries:merged.countries,persisted:persist,importedAt:merged.importedAt};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{const filename=process.argv[2];if(!filename)throw Error("FILE_REQUIRED");
  const r=importIntake(filename);console.log("INTL_IMPORT=PASS COUNT="+r.total+" UPDATED="+r.newOrUpdated+" COUNTRIES="+JSON.stringify(r.countries));
  console.log("MODE=OPERATOR_SUPPLIED_RESEARCH_ONLY BIDS=0 PURCHASES=0 REA_CALLS=0");
 }catch(e){console.error("INTL_IMPORT=FAILED REASON="+String(e.message).slice(0,260));process.exitCode=1}
}
