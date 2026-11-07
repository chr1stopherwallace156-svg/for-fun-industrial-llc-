// Fun Industrial Opportunity Intelligence US V1 — read-only official-feed adapters.
// No browser login, CAPTCHA interaction, bids, payments, account creation or unrestricted crawling.
import {createHash} from "node:crypto";
const MAX_GSA_LOTS=6000, MAX_BYTES=5_000_000;
export function clean(value,limit=220){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,limit).trim()}
export function stableId(source,raw){return createHash("sha256").update(source+"\x00"+String(raw)).digest("hex").slice(0,22)}
export function publicLink(value){try{const u=new URL(String(value));return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<650?u.href:""}catch{return ""}}
export function scoreOpportunity(item){
 const x=(item.title+" "+item.summary).toLowerCase();let score=10;
 for(const [re,points] of [[/\b(truck|vehicle|fleet|automotive|bus|salvage)\b/g,18],[/\b(industrial|equipment|machin|generator|tool|electrical)\b/g,15],[/\b(warehouse|bulk|lot|pallet|surplus|inventory)\b/g,13],[/\b(property|estate|real estate|land|foreclosure)\b/g,12],[/\b(software|engineering|research|manufactur)\b/g,10]]){if(re.test(x))score+=points}
 if(item.deadline)score+=4;if(item.askPrice!=null)score+=3;
 return Math.min(100,score); // relevance only; NOT profitability or authenticity
}
function record(source,kind,id,title,extra={}){
 const v={id:stableId(source,id),source,kind,title:clean(title,220),summary:clean(extra.summary,450),url:publicLink(extra.url),location:clean(extra.location,120),deadline:clean(extra.deadline,80),askPrice:extra.askPrice==null?null:(Number.isFinite(Number(extra.askPrice))?Number(extra.askPrice):null),currency:"USD",collectedAt:new Date().toISOString(),evidence:"source_feed",status:"unverified_details"};
 v.score=scoreOpportunity(v);return v;
}
export function normalizeGrants(response,keyword){
 if(Number(response?.errorcode)!==0||!Array.isArray(response?.data?.oppHits))throw Error("GRANTS_RESPONSE_INVALID");
 return response.data.oppHits.slice(0,60).filter(o=>o&&o.id&&o.title).map(o=>record("Grants.gov","grant",o.id,o.title,{summary:"Grant number "+clean(o.number)+"; agency "+clean(o.agencyName)+"; status "+clean(o.oppStatus)+"; keyword "+keyword,deadline:o.closeDate,url:"https://www.grants.gov/search-results-detail/"+encodeURIComponent(String(o.id)),location:"United States"}));
}
export function normalizeSAM(response){
 if(!Array.isArray(response?.opportunitiesData))throw Error("SAM_RESPONSE_INVALID");
 return response.opportunitiesData.slice(0,100).filter(o=>o&&o.noticeId&&o.title).map(o=>record("SAM.gov","solicitation",o.noticeId,o.title,{summary:"Notice "+clean(o.solicitationNumber)+"; type "+clean(o.type)+"; NAICS "+clean(o.naicsCode),deadline:o.responseDeadLine||o.reponseDeadLine,url:publicLink(o.uiLink)||("https://sam.gov/opp/"+encodeURIComponent(String(o.noticeId))+"/view"),location:clean(o.placeOfPerformance?.state?.name||o.placeOfPerformance?.state?.code||"USA")}));
}
// GSA has supplied both legacy PascalCase and live camelCase JSON responses.
// Parse field names explicitly and treat free-text auction descriptions as untrusted HTML.
function gsaValue(obj,...names){
 if(!obj||typeof obj!=="object"||Array.isArray(obj))return undefined;
 const props=Object.keys(obj);
 for(const name of names){
  const key=props.find(p=>p.replace(/[^a-z0-9]/gi,"").toLowerCase()===name.toLowerCase());
  if(key!==undefined&&obj[key]!==null&&obj[key]!==undefined)return obj[key];
 }
 return undefined;
}
function gsaText(value,limit=450){
 if(Array.isArray(value))return clean(value.slice(0,30).map(row=>
  typeof row==="string"?row:gsaValue(row,"lotDescript","description","text")||"").join(" "),limit);
 if(value===undefined||value===null)return "";
 if(typeof value==="object")return "";
 const html=String(value).replace(/<\s*(?:br|\/p|\/h[1-6]|\/li)\b[^>]*>/gi," ")
  .replace(/<[^>]*>/g," ").replace(/&#(?:x([a-f0-9]+)|([0-9]+));/gi,(_,hex,dec)=>{
   const n=parseInt(hex||dec,hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):" ";
  }).replace(/&(amp|nbsp|quot|apos|lt|gt|ndash|mdash|reg);/gi,(_,name)=>
   ({amp:"&",nbsp:" ",quot:'"',apos:"'",lt:"<",gt:">",ndash:"-",mdash:"-",reg:"(R)"})[name.toLowerCase()]||" ");
 return clean(html.replace(/\s+/g," "),limit);
}
function gsaBid(value){
 if(value===undefined||value===null||value==="")return null;
 if(typeof value==="number")return Number.isFinite(value)&&value>=0?value:null;
 if(typeof value!=="string")return null;
 const n=value.trim().replace(/^\$/,"").replace(/,/g,"");
 return /^\d+(?:\.\d{1,2})?$/.test(n)&&Number.isFinite(Number(n))?Number(n):null;
}
export function extractGSALots(response){
 const result=[],queue=[{v:response,d:0}],seen=new Set();
 let head=0;
 while(head<queue.length&&seen.size<20000&&result.length<MAX_GSA_LOTS){
  const {v,d}=queue[head++];
  if(!v||typeof v!=="object"||seen.has(v))continue;seen.add(v);
  const sale=gsaValue(v,"saleNo","saleNumber","auctionId");
  const name=gsaValue(v,"itemName","lotDescript","itemDescription","title","lotInfo");
  // Require a sale/auction identity and item description; reject opaque wrappers.
  if(sale!==undefined&&name!==undefined){result.push(v);continue}
  if(d<7)for(const val of Object.values(v).slice(0,35)){
   if(!val||typeof val!=="object")continue;
   if(Array.isArray(val)){for(const item of val.slice(0,600))queue.push({v:item,d:d+1})}
   else queue.push({v:val,d:d+1});
  }
 }
 return result;
}
export function normalizeGSA(response){
 const lots=extractGSALots(response);
 if(!lots.length)throw Error("GSA_RESPONSE_HAS_NO_RECOGNIZED_LOTS");
 return lots.map((o,i)=>{
  const sale=gsaText(gsaValue(o,"saleNo","saleNumber","auctionId"),100);
  const lot=gsaText(gsaValue(o,"lotNo","lotNumber","lotSequence"),50);
  const name=gsaText(gsaValue(o,"itemName","itemDescription","title","lotDescript"),220)
    ||("GSA auction lot "+sale+(lot?" / "+lot:""));
  const description=gsaText(gsaValue(o,"lotInfo","lotDescript","itemDescription"),340);
  const status=gsaText(gsaValue(o,"auctionStatus","status"),35);
  const bidders=gsaValue(o,"biddersCount","bidderCount");
  const observedBid=gsaBid(gsaValue(o,"highBidAmount","currentBid","highestBid"));
  const summary=["Lot "+(lot||"unspecified"),description,status?"Auction status: "+status:"",
   bidders!==undefined?"Bidders: "+gsaText(bidders,8):"",observedBid!==null?"Highest observed bid (not final price): $"+observedBid:""].filter(Boolean).join("; ");
  return record("GSA Auctions","surplus_auction",sale+"-"+(lot||i),name,{
   summary,deadline:gsaValue(o,"aucEndDt","auctionEndDate","endDate","closingDate"),
   askPrice:observedBid,
   location:[gsaValue(o,"propertyCity","city"),gsaValue(o,"propertyState","state")].map(x=>gsaText(x,70)).filter(Boolean).join(", "),
   url:publicLink(gsaValue(o,"itemDescURL","itemDescUrl","itemDescriptionUrl","auctionUrl"))||"https://www.gsaauctions.gov/"
  });
 });
}
export function validateManual(items){
 if(!Array.isArray(items))throw Error("MANUAL_LEADS_MUST_BE_ARRAY");
 return items.slice(0,100).filter(x=>x&&x.id&&x.title).map(x=>record("Operator intake","manual_review",clean(x.id,100),x.title,{summary:x.notes,location:x.location,deadline:x.deadline,askPrice:x.askPrice,url:x.url}));
}
function requestError(r){return "HTTP_"+r.status}
async function getJson(url,{method="GET",body=null,timeout=15000,maxBytes=MAX_BYTES,fetcher=fetch}={}){
 const options={method,headers:{"user-agent":"FunIndustrial-DomesticOpportunityV1/1.0","accept":"application/json",...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout),redirect:"error"};
 const res=await fetcher(url,options);
 if(!res.ok)throw Error(requestError(res));
 const raw=await res.text();if(raw.length>maxBytes)throw Error("FEED_TOO_LARGE");return JSON.parse(raw);
}
function dateMMDDYYYY(dt){return [String(dt.getUTCMonth()+1).padStart(2,"0"),String(dt.getUTCDate()).padStart(2,"0"),dt.getUTCFullYear()].join("/")}
export async function scanDomestic({fetcher=fetch,env=process.env,manual=[]}={}){
 const sources=[],items=[];const recordSource=(name,ok,details,count=0)=>{sources.push({name,ok,detail:clean(details,160),count})};
 const push=(list)=>{items.push(...list)};
 for(const keyword of ["vehicle","manufacturing"]){
  try{const json=await getJson("https://api.grants.gov/v1/api/search2",{method:"POST",body:{keyword,rows:15,oppStatuses:"posted|forecasted"},fetcher});
   const list=normalizeGrants(json,keyword);push(list);recordSource("Grants.gov / "+keyword,true,"Open opportunity search",list.length);
  }catch(e){recordSource("Grants.gov / "+keyword,false,e.message)}
 }
 if(env.GSA_API_KEY){
  try{const u=new URL("https://api.gsa.gov/assets/gsaauctions/v2/auctions");u.searchParams.set("api_key",env.GSA_API_KEY);u.searchParams.set("format","JSON");
   const json=await getJson(u.href,{fetcher,maxBytes:25_000_000});const list=normalizeGSA(json);push(list);recordSource("GSA Auctions",true,"Current public federal surplus lots",list.length);
  }catch(e){recordSource("GSA Auctions",false,e.message)}
 }else recordSource("GSA Auctions",false,"API_KEY_REQUIRED (optional GSA_API_KEY)");
 if(env.SAM_GOV_API_KEY){
  try{const now=new Date(),then=new Date(now.getTime()-7*86400000),u=new URL("https://api.sam.gov/opportunities/v2/search");
   for(const [k,v] of Object.entries({api_key:env.SAM_GOV_API_KEY,postedFrom:dateMMDDYYYY(then),postedTo:dateMMDDYYYY(now),limit:"75",offset:"0",ptype:"o"}))u.searchParams.set(k,v);
   const json=await getJson(u.href,{fetcher});const list=normalizeSAM(json);push(list);recordSource("SAM.gov solicitations",true,"Last seven days",list.length);
  }catch(e){recordSource("SAM.gov solicitations",false,e.message)}
 }else recordSource("SAM.gov solicitations",false,"API_KEY_REQUIRED (optional SAM_GOV_API_KEY)");
 try{const list=validateManual(manual);push(list);recordSource("Manual auction / property intake",true,"Operator-entered leads; not scraped",list.length)}
 catch(e){recordSource("Manual auction / property intake",false,e.message)}
 const unique=new Map();for(const item of items){if(!unique.has(item.id))unique.set(item.id,item)}
 const sorted=[...unique.values()].sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,300);
 return {checkedAt:new Date().toISOString(),scope:"United States",mode:"read_only_discovery",ranking:"keyword_relevance_not_profit",items:sorted,sources,summary:{total:sorted.length,workingSources:sources.filter(x=>x.ok).length,unavailableSources:sources.filter(x=>!x.ok).length,auctionCount:sorted.filter(x=>x.kind==="surplus_auction").length,bidCount:sorted.filter(x=>x.kind==="solicitation").length,grantCount:sorted.filter(x=>x.kind==="grant").length}};
}
