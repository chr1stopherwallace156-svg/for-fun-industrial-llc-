// FUN_COMMERCE_OPPORTUNITIES_V1_1
// Deterministic, read-only review queue from locally captured Google Trends RSS
// and separately authorized Shopify catalog. Never a sales/demand forecast.
import {GOOGLE_RSS,GOOGLE_CALIFORNIA_RSS} from './trends-commerce-v1.mjs';
import {screenTrend} from './google-trends-focus-v1-2.mjs';

const TOKEN_STOP=new Set(['and','the','for','new','best','sale','deals','with','from',
 'shop','store','online','near','buy','price','reviews','review','2025','2026','2027',
 'size','more','find','how','what','where','top','pro','plus','model','edition']);
const PRODUCT_TERMS=Object.freeze({
 automotive:['vacuum','dashcam','dash','camera','detailing','polish','tire','tires','wheel','wheels','seat','seats','charger','chargers','battery','batteries','headlight','headlights','wiper','wipers','floor mats','carplay'],
 home:['vacuum','blender','coffee','mattress','sofa','lamp','lamps','pillow','pillows','organizer','organizers','storage','air fryer','humidifier','purifier','cookware','bedding'],
 technology:['headphones','earbuds','keyboard','mouse','monitor','laptop','tablet','phone','charger','chargers','webcam','microphone','router','projector','speaker','speakers'],
 pets:['pet','pets','dog','dogs','cat','cats','leash','leashes','litter','grooming','aquarium'],
 personal_care:['shampoo','skincare','serum','makeup','sunscreen','moisturizer','trimmer','razor','hairdryer'],
 fashion:['shoes','sneakers','boots','jacket','jackets','shirt','shirts','pants','hoodie','hoodies','backpack','backpacks','handbag','handbags','socks','sunglasses'],
 tools:['drill','drills','saw','saws','toolbox','wrench','wrenches','compressor','multimeter','flashlight','flashlights','workbench'],
 fitness:['dumbbell','dumbbells','treadmill','yoga','mat','mats','resistance bands','cleats','helmet','helmets','bike','bicycle','bicycles']
});
const nowUtc=()=>new Date().toISOString();
const validSha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const tokens=x=>new Set(String(x||'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(t=>!TOKEN_STOP.has(t))||[]);
const words=xs=>[...xs];
const hasPhrase=(text,term)=>(' '+String(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ').includes(' '+term+' ');
function types(query){
 const q=String(query||'').toLowerCase().replace(/[^a-z0-9]+/g,' ');
 return Object.entries(PRODUCT_TERMS).filter(([,terms])=>terms.some(term=>hasPhrase(q,term))).map(([category])=>category);
}
function approxFloor(text){
 if(typeof text!=='string'||!/^[\d,]{1,12}\+$/.test(text.trim()))return null;
 const n=Number(text.slice(0,-1).replace(/,/g,''));
 return Number.isSafeInteger(n)&&n>=0?n:null;
}
function ageHours(date,at){
 const ms=Date.parse(date);
 if(!Number.isFinite(ms))return null;
 return Math.max(0,Math.round((Date.parse(at)-ms)/3600000));
}
function sourceSnapshot(snapshot,url,at){
 const okay=!!snapshot&&snapshot.source_url===url&&validSha(snapshot.source_sha256)&&Number.isFinite(Date.parse(snapshot.fetched_utc));
 return {present:okay,fetched_utc:okay?snapshot.fetched_utc:null,sha256:okay?snapshot.source_sha256:null,
  age_hours:okay?ageHours(snapshot.fetched_utc,at):null};
}
function shopSnapshot(store,at){
 const okay=!!store&&store.source_type==='shopify_admin_graphql'&&validSha(store.products_source_sha256)&&Number.isFinite(Date.parse(store.fetched_utc));
 return {present:okay,fetched_utc:okay?store.fetched_utc:null,sha256:okay?store.products_source_sha256:null,
  age_hours:okay?ageHours(store.fetched_utc,at):null,products_truncated:okay&&store.products_truncated===true};
}
function productPrice(p){
 const values=(Array.isArray(p.variants)?p.variants:[]).map(v=>v.selling_price);
 const amounts=values.filter(v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(v)&&Number(v)>0)
  .map(Number);
 return amounts.length?Math.min(...amounts):null;
}
const freshness=(source)=>source.present&&source.age_hours!==null&&source.age_hours<=48;
export function rankCommerceOpportunities({trends,california,shopify,now=nowUtc()}={}){
 if(!Number.isFinite(Date.parse(now)))throw Error('OPPORTUNITY_TIMESTAMP_INVALID');
 const captured=sourceSnapshot(trends,GOOGLE_RSS,now);
 const caCaptured=sourceSnapshot(california,GOOGLE_CALIFORNIA_RSS,now);
 const catalog=shopSnapshot(shopify,now);
 const usItems=captured.present&&Array.isArray(trends.items)?trends.items.slice(0,25).map(item=>({item,scope:'US',source:captured})):[];
 const caItems=caCaptured.present&&Array.isArray(california.items)?california.items.slice(0,25).map(item=>({item,scope:'US-CA',source:caCaptured})):[];
 const trendItems=[...caItems,...usItems];
 const products=catalog.present&&Array.isArray(shopify.products)?shopify.products.slice(0,50):[];
 const matches=[],leads=[];
 for(const {item:t,scope,source} of trendItems){
  if(typeof t.query!=='string'||!t.query.trim()||t.query.length>200)continue;
  if(!screenTrend(t.query).included)continue;
  const category=types(t.query);
  const candidates=[];
  const a=tokens(t.query);
  for(const p of products){
   if(typeof p.title!=='string'||typeof p.id!=='string')continue;
   const overlap=words(tokens(p.title)).filter(w=>a.has(w));
   if(overlap.length<2)continue;
   const amount=productPrice(p);
   candidates.push({kind:'catalog_title_overlap',product_id:p.id,product_title:p.title,
    product_status:p.status||null,listed_price_min:amount,price_currency:'shop_currency_not_yet_verified',
    search_query:t.query,search_scope:scope,approx_traffic:t.approx_traffic||null,search_lower_bound:approxFloor(t.approx_traffic),
    matched_terms:overlap.slice(0,8),catalog_source_sha256:catalog.sha256,
    search_source_sha256:source.sha256,
    source_fetched_utc:{google:source.fetched_utc,shopify:catalog.fetched_utc},
    research_priority:Math.min(80,45+Math.min(4,overlap.length)*9),
    priority_is_heuristic:true,real_market_demand_verified:false,supplier_availability_verified:false,
    supplier_cost_verified:false,net_profit_estimated:false,
    next_evidence_needed:['supplier wholesale cost','availability and delivery',
      'transaction fees and returns','independent demand validation']});
  }
  if(candidates.length)matches.push(...candidates);
  else if(category.length)leads.push({kind:'product_interest_research_lead',search_query:t.query,search_scope:scope,
   category_hints:category.slice(0,3),approx_traffic:t.approx_traffic||null,
   search_lower_bound:approxFloor(t.approx_traffic),search_source_sha256:source.sha256,
   search_fetched_utc:source.fetched_utc,research_priority:20,
   priority_is_heuristic:true,real_market_demand_verified:false,
   available_supplier_product_verified:false,net_profit_estimated:false,
   next_evidence_needed:['identify a legitimate product and authorized supplier',
    'verify supply, cost, shipping, fees and returns','validate actual buyer demand']});
 }
 const sorted=items=>items.sort((a,b)=>b.research_priority-a.research_priority||
  (b.search_lower_bound||0)-(a.search_lower_bound||0)||a.search_query.localeCompare(b.search_query));
 sorted(matches);sorted(leads);
 const enough=freshness(captured);
 const report={
  version:'fun-commerce-opportunities-v1.1',state:!captured.present&&!caCaptured.present?'awaiting_google_source':
   !enough&&!(caCaptured.present&&caCaptured.age_hours!==null&&caCaptured.age_hours<=48)?'source_stale_review_only':matches.length?'catalog_matches_need_supplier_and_demand_checks':
   leads.length?'product_interest_leads_need_supplier_checks':'no_commercial_evidence_matched',
  generated_utc:now,source_status:{google:captured,california:caCaptured,shopify:catalog},
  trend_count:trendItems.length,shopify_product_count:products.length,
  matches:matches.slice(0,20),research_leads:leads.slice(0,12),
  uncategorized_search_count:Math.max(0,trendItems.length-new Set(matches.map(x=>x.search_scope+':'+x.search_query).concat(leads.map(x=>x.search_scope+':'+x.search_query))).size),
  total_matches:matches.length,total_research_leads:leads.length,
  qualifies_as_verified_sales_opportunity:false,order_authority:false,
  explanatory_notes:[
   'Priority is a transparent keyword-overlap review heuristic, NOT a trained prediction or proven market demand.',
   'Only explicit commercial search topics pass V1.2 filtering; news, people-only searches and sports are ignored.',
   'US-CA statewide search interest does not measure individual California county demand.',
   'Approximate Google search-traffic buckets are NOT exact search counts, purchase orders or conversion rates.',
   'A Shopify listed price is not a wholesale cost or verified gross/net profit.',
   'Without real supplier cost, shipping, fees, returns and independent demand evidence, do not calculate profit or instruct purchases.',
   !catalog.present?'No authenticated Shopify catalog snapshot is available. Product-interest topics can only enter a research queue.':
    catalog.products_truncated?'The Shopify catalog snapshot is incomplete; unmatched products may exist beyond the first page.':
    products.length===0?'Shopify snapshot has no products; no supplier availability has been verified.':'Shopify catalog titles may match search terms but do not prove demand.'
  ]};
 return report;
}