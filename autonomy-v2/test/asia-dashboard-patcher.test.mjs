import test from "node:test";
import assert from "node:assert/strict";
import {applyAsiaUi} from "../scripts/patch-asia-dashboard.mjs";
const fixture=[
 '<!doctype html><html><body>',
 '<!-- FI_INTERNATIONAL_SOURCE_V1 -->',
 '<select id="fiIntlCountry"><option value="JP">Japan</option><option value="KR">South Korea</option><option value="VN">Vietnam</option></select>',
 '<p>Japan, South Korea and Vietnam. Official source directory and operator-reviewed inventory; not automated site scraping or a profit guarantee.</p>',
 '<script>',
 'const found=[{title:"T",companyName:"Example Co"}].filter(i=>[i.title,i.titleLocal,i.manufacturer,i.model,i.city,i.region,i.description].join(" "));',
 'const detail=[i.countryName,i.category,i.manufacturer,i.model,i.quantity?"Quantity "+i.quantity+" "+i.unit:"",i.priceLocal!==null?"Observed "+i.currency+" "+i.priceLocal:"Price unavailable"];',
 '</script></body></html>'
].join("\n");
test("existing V1 view gains 9 Asian options and company/MOQ fields without altering supplier links",()=>{
 const upgraded=applyAsiaUi(fixture);
 assert.match(upgraded,/FI_ASIA_COMPANIES_V2/);
 for(const c of ["CN","TW","TH","MY","ID","PH","HK","IN","SG"])assert.match(upgraded,new RegExp('<option value="'+c+'">'));
 assert.match(upgraded,/i\.companyName/);
 assert.match(upgraded,/i\.minOrderQuantity/);
 assert.match(upgraded,/i\.incoterm/);
 assert.match(upgraded,/supplier/);
 assert.throws(()=>applyAsiaUi(upgraded),/ASIA_V2_ALREADY_INSTALLED/);
});
test("patch does not touch unknown or partial dashboard files",()=>{
 assert.throws(()=>applyAsiaUi('<html><body></body></html>'),/INTERNATIONAL_V1_REQUIRED/);
 assert.throws(()=>applyAsiaUi('<!-- FI_INTERNATIONAL_SOURCE_V1 -->'),/ASIA_V2_ANCHOR_HOLD/);
});
