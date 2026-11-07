// Incremental V2 UI upgrade. Assumes International V1 is already deployed.
// Does not edit source-of-truth GitHub or installed worker data.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
export function applyAsiaUi(original){
 const marker="FI_ASIA_COMPANIES_V2";
 if(original.includes(marker))throw Error("ASIA_V2_ALREADY_INSTALLED");
 if(!original.includes("FI_INTERNATIONAL_SOURCE_V1"))throw Error("INTERNATIONAL_V1_REQUIRED");
 const one=(s,a,b)=>{
  const pos=s.indexOf(a);
  if(pos<0||s.indexOf(a,pos+1)>=0)throw Error("ASIA_V2_ANCHOR_HOLD="+a.slice(0,45));
  return s.slice(0,pos)+b+s.slice(pos+a.length);
 };
 const countries=[["CN","China"],["TW","Taiwan"],["TH","Thailand"],["MY","Malaysia"],["ID","Indonesia"],["PH","Philippines"],["HK","Hong Kong"],["IN","India"],["SG","Singapore"]]
  .map(([code,label])=>'<option value="'+code+'">'+label+"</option>").join("");
 let updated=one(original,'<!-- FI_INTERNATIONAL_SOURCE_V1 -->','<!-- FI_INTERNATIONAL_SOURCE_V1 -->\n<!-- FI_ASIA_COMPANIES_V2 -->');
 updated=one(updated,'<option value="VN">Vietnam</option>','<option value="VN">Vietnam</option>'+countries);
 updated=one(updated,'Japan, South Korea and Vietnam. Official source directory and operator-reviewed inventory; not automated site scraping or a profit guarantee.',
  'Asian company, exporter, factory, wholesale and surplus research across 12 countries/markets. Company profiles do not establish actual stock, prices, or export eligibility.');
 updated=one(updated,'[i.title,i.titleLocal,i.manufacturer,i.model,i.city,i.region,i.description].join(" ")',
  '[i.title,i.titleLocal,i.companyName,i.manufacturer,i.model,i.city,i.region,i.description].join(" ")');
 updated=one(updated,'const detail=[i.countryName,i.category,i.manufacturer,i.model,',
  'const detail=[i.countryName,i.recordType,i.companyName,i.category,i.manufacturer,i.model,');
 updated=one(updated,'i.quantity?"Quantity "+i.quantity+" "+i.unit:"",',
  'i.quantity?"Quantity "+i.quantity+" "+i.unit:"",i.minOrderQuantity?"MOQ "+i.minOrderQuantity:"",i.incoterm&&i.incoterm!=="unverified"?"Incoterm "+i.incoterm:"",');
 return updated;
}
import {fileURLToPath} from "node:url";
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=process.argv[2];if(!root||!path.isAbsolute(root))throw Error("ABSOLUTE_PLATFORM_ROOT_REQUIRED");
  const target=path.join(root,"public","index.html");
  const original=fs.readFileSync(target,"utf8");
  const output=applyAsiaUi(original);
  const m=output.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);if(!m)throw Error("DASHBOARD_SCRIPT_NOT_FOUND");
  const temp=path.join(os.tmpdir(),"fi-asia-v2-check-"+process.pid+".mjs");
  try{fs.writeFileSync(temp,m[1],"utf8");execFileSync(process.execPath,["--check",temp],{stdio:"pipe"})}
  finally{fs.rmSync(temp,{force:true})}
  fs.writeFileSync(target,output,"utf8");
  console.log("ASIA_COMPANY_DASHBOARD_PATCH=PASS");
 }catch(e){console.error("ASIA_COMPANY_DASHBOARD_PATCH=FAILED REASON="+e.message);process.exitCode=1}
}
