// Fun Industrial international opportunity intelligence V1.
// Read-only registries and vetted operator-supplied listings, no scraping or bidding.
import {createHash} from "node:crypto";
const trim=(v,n=220)=>String(v??"").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,n);
export const COUNTRIES=Object.freeze({JP:{name:"Japan",currency:"JPY",language:"ja"},KR:{name:"South Korea",currency:"KRW",language:"ko"},VN:{name:"Vietnam",currency:"VND",language:"vi"}});
export const SOURCE_REGISTRY=Object.freeze([
 {id:"JP_KSI",country:"JP",name:"KSI Government Auctions",kind:"government_auction",url:"https://kankocho.jp/",allowedHost:"kankocho.jp",access:"public_site_manual_review",api:"not_verified",inventory:"vehicles_equipment_property",notes:"Site participation and export eligibility must be checked for each lot"},
 {id:"KR_ONBID_MOVABLE",country:"KR",name:"KAMCO OnBid Movable Property",kind:"government_auction",url:"https://www.onbid.co.kr/",allowedHost:"onbid.co.kr",access:"official_api_key_required",api:"https://www.data.go.kr/data/15157232/openapi.do",inventory:"machinery_equipment_bulk_lots",notes:"Official API application needed; schema and permissions to qualify before auto-ingestion"},
 {id:"KR_ONBID_VEHICLE",country:"KR",name:"KAMCO OnBid Vehicle Auctions",kind:"government_auction",url:"https://www.onbid.co.kr/",allowedHost:"onbid.co.kr",access:"official_api_key_required",api:"https://www.data.go.kr/data/15157233/openapi.do",inventory:"vehicles",notes:"Manufacturer, model and mileage are searchable; import and title rules still apply"},
 {id:"VN_MOJ",country:"VN",name:"Vietnam National Asset Auction Portal",kind:"government_auction",url:"https://dgts.moj.gov.vn/",allowedHost:"dgts.moj.gov.vn",access:"public_site_manual_review",api:"not_verified",inventory:"asset_auction_notices",notes:"Notices may require registration, deposits, local eligibility and document review"},
 {id:"JP_JETRO",country:"JP",name:"JETRO Trade and Supplier Research",kind:"supplier_discovery",url:"https://www.jetro.go.jp/en/",allowedHost:"jetro.go.jp",access:"public_site_manual_review",api:"not_verified",inventory:"supplier_discovery_only",notes:"Supplier research does not certify current stock or prices"},
 {id:"GLOBAL_OSH",country:"GLOBAL",name:"Open Supply Hub Facility Research",kind:"facility_discovery",url:"https://opensupplyhub.org/",allowedHost:"opensupplyhub.org",access:"research_reference_only",api:"not_qualified",inventory:"facilities_not_goods",notes:"Facility location is not an inventory listing; country of a supplied lead must be confirmed"}
]);
export const PORTS=Object.freeze([
 {code:"JPTYO",country:"JP",name:"Tokyo"}, {code:"JPYOK",country:"JP",name:"Yokohama"},
 {code:"KRPUS",country:"KR",name:"Busan"}, {code:"KRINC",country:"KR",name:"Incheon"},
 {code:"VNSGN",country:"VN",name:"Ho Chi Minh City"}, {code:"VNHPH",country:"VN",name:"Hai Phong"},
 {code:"USLAX",country:"US",name:"Los Angeles"}, {code:"USLGB",country:"US",name:"Long Beach"}
]);
export const CATEGORIES=Object.freeze(["bulk_lots","vehicles","industrial_equipment","electronics_components","textiles","furniture","property","general"]);
const REGISTRY=new Map(SOURCE_REGISTRY.map(s=>[s.id,s]));
const PORTMAP=new Map(PORTS.map(p=>[p.code,p]));
const CATS=[
 ["bulk_lots",/(?:\b(?:pallet|crate|container lot|bulk lot|wholesale lot|overstock|liquidation)\b|パレット|まとめ売り|一括|팔레트|일괄|화물|pallet|thùng hàng|lô hàng)/i],
 ["vehicles",/(?:\b(?:truck|vehicle|pickup|forklift|automotive|motorbike|car|bus)\b|トラック|自動車|車両|자동차|차량|트럭|xe tải|ô tô|xe hơi)/i],
 ["industrial_equipment",/(?:\b(?:generator|lathe|machinery|compressor|industrial equipment|machine|conveyor|cnc)\b|工作機械|機械|発電機|기계|공작|발전기|máy móc|thiết bị|máy phát điện)/i],
 ["electronics_components",/(?:\b(?:semiconductor|circuit board|pcb|microcontroller|electronics|electronic parts)\b|電子部品|半導体|전자부품|반도체|linh kiện|điện tử)/i],
 ["textiles",/(?:\b(?:garment|clothing|fabric|textile|apparel)\b|衣類|繊維|의류|원단|vải|quần áo)/i],
 ["furniture",/(?:\b(?:furniture|desk|chair|cabinet)\b|家具|가구|nội thất)/i],
 ["property",/(?:\b(?:real estate|building|warehouse property|land plot)\b|不動産|부동산|bất động sản)/i]
];
const MAKERS=[["TOYOTA",/(?:\btoyota\b|トヨタ|도요타|토요타)/i],["HYUNDAI",/(?:\bhyundai\b|현대|ヒュンダイ)/i],["SAMSUNG",/(?:\bsamsung\b|삼성|サムスン)/i],["HONDA",/(?:\bhonda\b|ホンダ|혼다)/i],["KIA",/(?:\bkia\b|기아)/i],["MITSUBISHI",/(?:\bmitsubishi\b|三菱|미쓰비시)/i],["DAEWOO",/(?:\bdaewoo\b|대우)/i]];
export const categoryFor=(name)=>CATS.find(([,re])=>re.test(trim(name,800)))?.[0]||"general";
export function makerFor(value){const name=trim(value,120);return MAKERS.find(([,re])=>re.test(name))?.[0]||name.toUpperCase()}
function isHttpsSourceUrl(raw,source){
 try{
  const u=new URL(String(raw));
  const host=u.hostname.toLowerCase(),allow=source.allowedHost.toLowerCase();
  return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.hash&&
   (host===allow||host.endsWith("."+allow))&&u.href.length<=850?u.href:null;
 }catch{return null}
}
function money(raw){
 if(raw===null||raw===undefined||raw==="")return null;
 if(typeof raw==="number")return Number.isFinite(raw)&&raw>=0?raw:null;
 if(typeof raw!=="string")return null;
 const s=raw.replace(/[,\s]/g,"");
 return /^\d+(?:\.\d{1,4})?$/.test(s)&&Number.isFinite(Number(s))?Number(s):null;
}
export function normalizeLead(x){
 if(!x||typeof x!=="object"||Array.isArray(x))throw Error("LEAD_INVALID");
 const source=REGISTRY.get(trim(x.sourceId,40));
 if(!source)throw Error("SOURCE_NOT_APPROVED");
 if(x.country&&x.country!==source.country)throw Error("COUNTRY_SOURCE_MISMATCH");
 // Facility directory is research, not inventory.
 if(source.kind==="facility_discovery")throw Error("FACILITY_NOT_A_SELLER_OR_LISTING");
 const externalId=trim(x.externalId,130),title=trim(x.title,260);
 if(!externalId||!title)throw Error("LEAD_ID_TITLE_REQUIRED");
 const url=isHttpsSourceUrl(x.url,source);
 if(!url)throw Error("LEAD_SOURCE_URL_NOT_APPROVED");
 const category=CATEGORIES.includes(x.category)?x.category:categoryFor([title,x.description].join(" "));
 const originPort=trim(x.originPort,5).toUpperCase(),port=originPort?PORTMAP.get(originPort):null;
 if(originPort&&(!port||port.country!==source.country))throw Error("ORIGIN_PORT_MISMATCH");
 const price=money(x.priceLocal);
 if(x.priceLocal!=null&&x.priceLocal!==""&&price===null)throw Error("INVALID_PRICE");
 const quantity=money(x.quantity);
 if(quantity!==null&&(!Number.isInteger(quantity)||quantity<1||quantity>1e8))throw Error("INVALID_QUANTITY");
 const amountType=["ask","current_bid","supplier_quote","unknown"].includes(x.priceType)?x.priceType:"unknown";
 const id=createHash("sha256").update(source.id+"\0"+externalId).digest("hex").slice(0,24);
 const manufacturer=x.manufacturer?makerFor(x.manufacturer):(MAKERS.find(([,re])=>re.test(title))?.[0]||"");
 return {id,externalId,sourceId:source.id,source:source.name,country:source.country,countryName:COUNTRIES[source.country].name,
  title,titleLocal:trim(x.titleLocal||title,260),description:trim(x.description,400),category,
  manufacturer,model:trim(x.model,100),
  city:trim(x.city,100),region:trim(x.region,100),originPort:port?.code||null,originPortName:port?.name||null,
  quantity,unit:trim(x.unit||"lot",30),priceLocal:price,currency:COUNTRIES[source.country].currency,
  priceType:amountType,sourceUrl:url,condition:trim(x.condition||"unverified",110),
  observedAt:trim(x.observedAt,40)||null,provenance:"operator_supplied_public_listing_unverified",
  status:"operator_review_only",bidIsFinalPrice:false,exportEligible:"unknown",realEstate:category==="property"};
}
export function prepareInventory(raw,{limit=500,now=Date.now()}={}){
 const rows=Array.isArray(raw)?raw:raw?.leads;
 if(!Array.isArray(rows)||rows.length>limit)throw Error("INVENTORY_LIST_REQUIRED_OR_TOO_LARGE");
 const unique=new Map(),errors=[];
 rows.forEach((row,i)=>{try{const r=normalizeLead(row);if(unique.has(r.id))throw Error("DUPLICATE_SOURCE_ID");unique.set(r.id,r)}catch(e){errors.push({row:i+1,code:String(e.message).slice(0,70)})}});
 if(errors.length)throw Error("INVENTORY_REJECTED_ROWS="+errors.map(e=>e.row+":"+e.code).slice(0,12).join(","));
 const leads=[...unique.values()];
 return {schema:1,importedAt:new Date(now).toISOString(),provenance:"operator_supplied_public_listings",mode:"research_only",count:leads.length,
  countries:Object.fromEntries(Object.keys(COUNTRIES).map(c=>[c,leads.filter(x=>x.country===c).length])),leads};
}
export function filterInventory(input,{country,category,manufacturer,query}={}){
 let result=(Array.isArray(input)?input:input?.leads)||[];
 if(country&&COUNTRIES[country])result=result.filter(x=>x.country===country);
 if(category&&CATEGORIES.includes(category))result=result.filter(x=>x.category===category);
 if(manufacturer)result=result.filter(x=>x.manufacturer===makerFor(manufacturer));
 if(query){const q=trim(query,90).toLowerCase();result=result.filter(x=>[x.title,x.titleLocal,x.model,x.city,x.manufacturer,x.description].join(" ").toLowerCase().includes(q))}
 return result.slice(0,250);
}
// Costs must be explicitly sourced: quote + FX + freight + insurance + duties + fees.
export function landedCost(lead,input={}){
 if(!lead||money(lead.priceLocal)===null)return {state:"blocked",missing:["verified_listing_price"]};
 const names=["usdPerLocal","internationalFreightUsd","domesticFreightUsd","insuranceUsd","dutyUsd","brokerageUsd","portAndStorageUsd","inspectionUsd","otherUsd","resaleEstimateUsd"];
 const missing=names.filter(n=>money(input[n])===null);
 if(missing.length)return {state:"blocked",missing,reason:"No price, duty, freight or exchange rate is invented"};
 const fx=money(input.usdPerLocal);
 if(fx<=0||fx>1e4)return {state:"blocked",missing:["valid_usdPerLocal"]};
 const shipping=["internationalFreightUsd","domesticFreightUsd","insuranceUsd","dutyUsd","brokerageUsd","portAndStorageUsd","inspectionUsd","otherUsd"].reduce((n,key)=>n+Number(input[key]),0);
 const merchandise=Number(lead.priceLocal)*fx;
 const landed=merchandise+shipping,expected=Number(input.resaleEstimateUsd);
 const gross=expected-landed;
 return {state:"scenario_only_not_verified",currency:"USD",fxUsdPerLocal:fx,merchandiseUsd:Number(merchandise.toFixed(2)),
  landedUsd:Number(landed.toFixed(2)),resaleEstimateUsd:expected,grossBeforeIncomeTaxAndOverheadUsd:Number(gross.toFixed(2)),
  grossMarginPct:expected>0?Number((100*gross/expected).toFixed(2)):null,
  warning:"Not an assured profit: require quote evidence, customs broker classification, buyer demand, taxes and inspection"};
}
export function sourcesForUI(){return SOURCE_REGISTRY.map(({allowedHost,...x})=>x)}
