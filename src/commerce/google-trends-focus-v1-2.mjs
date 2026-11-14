// FUN_GOOGLE_TRENDS_FOCUS_V1_2 — deterministic commerce filter; no fake county search metrics.
// Only Google RSS source snapshots become scoped, dated search-interest evidence.
export const CA_COUNTIES=Object.freeze([
'Alameda','Alpine','Amador','Butte','Calaveras','Colusa','Contra Costa','Del Norte','El Dorado','Fresno',
'Glenn','Humboldt','Imperial','Inyo','Kern','Kings','Lake','Lassen','Los Angeles','Madera',
'Marin','Mariposa','Mendocino','Merced','Modoc','Mono','Monterey','Napa','Nevada','Orange',
'Placer','Plumas','Riverside','Sacramento','San Benito','San Bernardino','San Diego',
'San Francisco','San Joaquin','San Luis Obispo','San Mateo','Santa Barbara','Santa Clara',
'Santa Cruz','Shasta','Sierra','Siskiyou','Solano','Sonoma','Stanislaus','Sutter','Tehama',
'Trinity','Tulare','Tuolumne','Ventura','Yolo','Yuba']);
export const FEEDS=Object.freeze({
 US:'https://trends.google.com/trending/rss?geo=US',
 'US-CA':'https://trends.google.com/trending/rss?geo=US-CA'
});
const SHA=/^[a-f0-9]{64}$/;
const PRODUCTS=Object.freeze({
 automotive:['dash cam','dashcam','car vacuum','car detailing','auto detailing','car seat','car parts','carplay','headlight','tire pressure','tire inflator','car charger','ev charger','battery charger','jump starter','truck bed','wiper blade','brake pads','oil filter','floor mats','roof rack'],
 home:['vacuum','air purifier','air fryer','blender','coffee maker','espresso machine','mattress','pillow','bedding','humidifier','dehumidifier','water filter','dishwasher','washing machine','refrigerator','furniture','storage bins','organization bins','smart lock','security camera','solar panel','water heater'],
 technology:['laptop','tablet','headphones','earbuds','keyboard','gaming mouse','webcam','monitor','smartphone','iphone','android phone','computer','ssd','hard drive','power bank','usb charger','wireless charger','projector','smartwatch','bluetooth speaker','wifi router','3d printer'],
 personal:['shampoo','skincare','sunscreen','moisturizer','hair dryer','trimmer','razor','makeup','serum','toothbrush','hairbrush'],
 apparel:['shoes','sneakers','boots','jacket','hoodie','jeans','backpack','handbag','socks','sunglasses','coat'],
 pets:['pet food','dog food','cat food','dog leash','cat litter','pet grooming','dog bed','cat tree','aquarium','pet carrier'],
 tools:['power drill','cordless drill','drill bits','wrench set','toolbox','chainsaw','pressure washer','multimeter','workbench','compressor','flashlight','power tools'],
 fitness:['dumbbell','treadmill','yoga mat','exercise bike','resistance bands','gym equipment','helmet','bicycle','protein shaker'],
 property:['home insurance','home prices','housing prices','homes for sale','houses for sale','real estate','rental property','apartment rent','home repair','roof repair','roofing contractor','hvac repair','plumbing service','solar installation','landscaping','estate sale','property auction','foreclosure auction','construction materials','window replacement','pest control'],
 local_services:['car wash','auto repair','mobile detailing','appliance repair','cleaning service','moving company','storage unit','equipment rental','electrician','plumber']
});
const EXCLUDE=Object.freeze([
 /\b(?:vs|versus|standings|playoffs|box score|final score|live score|touchdown|world cup|champions league|ufc|nba|nfl|mlb|nhl|match score)\b/i,
 /\b(?:obituary|died|death|funeral|celebrity|actor|actress|movie trailer|film premiere|box office|netflix cast|birthday|wedding)\b/i,
 /\b(?:earthquake|tornado|snow storm|weather forecast|storm warning|wildfire|hurricane|shooting|crash victims|cyber attack)\b/i,
 /\b(?:election results|senate race|presidential debate|political polls|vote count)\b/i
]);
const clean=(s)=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
function hasPhrase(text,phrase){return (' '+text+' ').includes(' '+phrase+' ')}
function trafficFloor(s){
 if(typeof s!=='string'||!/^\d[\d,]{0,10}\+$/.test(s.trim()))return null;
 const n=Number(s.slice(0,-1).replace(/,/g,''));
 return Number.isSafeInteger(n)?n:null;
}
export function countyMentions(query){
 if(typeof query!=='string'||query.length>300)return [];
 const phrase=clean(query);
 return CA_COUNTIES.filter(county=>hasPhrase(phrase,clean(county)+' county'));
}
export function screenTrend(query){
 if(typeof query!=='string'||!query.trim()||query.length>200)
  return {included:false,reason:'invalid_or_empty_query',categories:[],county_mentions:[]};
 const normalized=clean(query),county_mentions=countyMentions(query);
 const categories=Object.entries(PRODUCTS).filter(([,indicators])=>indicators.some(term=>hasPhrase(normalized,term))).map(([category])=>category);
 const excluded=EXCLUDE.some(rx=>rx.test(normalized));
 return {included:categories.length>0&&!excluded,
  reason:excluded?'news_sports_weather_or_entertainment_context':categories.length?'explicit_product_or_service_indicator':'no_product_or_service_indicator',
  categories,county_mentions};
}
const fresh=record=>record&&Number.isFinite(Date.parse(record.fetched_utc));
function verifiedFeed(snapshot,scope,now){
 if(!snapshot||snapshot.source_url!==FEEDS[scope]||
  snapshot.source_type!=='google_trending_now_rss'||
  typeof snapshot.source_sha256!=='string'||!SHA.test(snapshot.source_sha256)||
  !fresh(snapshot)||!Array.isArray(snapshot.items))return null;
 const ageHours=Math.max(0,Math.floor((Date.parse(now)-Date.parse(snapshot.fetched_utc))/3600000));
 if(snapshot.items.length>30)return null;
 return {scope,record:snapshot,ageHours};
}
export function buildTrendsFocus({us=null,california=null,now=new Date().toISOString()}={}){
 if(!Number.isFinite(Date.parse(now)))throw Error('TRENDS_FOCUS_TIME_INVALID');
 const feeds=[verifiedFeed(us,'US',now),verifiedFeed(california,'US-CA',now)].filter(Boolean);
 const included=[],excluded=[],byScope={};
 for(const scope of ['US','US-CA']){
  const feed=feeds.find(x=>x.scope===scope);
  byScope[scope]=feed?{state:feed.ageHours>48?'stale':'captured',
   source_url:FEEDS[scope],source_sha256:feed.record.source_sha256,
   fetched_utc:feed.record.fetched_utc,age_hours:feed.ageHours,
   raw_count:feed.record.items.length,displayed_count:0,excluded_count:0}:
   {state:'not_collected',source_url:FEEDS[scope],source_sha256:null,
    fetched_utc:null,age_hours:null,raw_count:0,displayed_count:0,excluded_count:0};
  if(!feed)continue;
  const seen=new Set();
  for(const item of feed.record.items){
   if(typeof item.query!=='string'||item.query.length>200||!item.query.trim())continue;
   const normalized=clean(item.query);
   if(seen.has(normalized))continue;seen.add(normalized);
   const s=screenTrend(item.query);
   const entry={query:item.query,scope,category_hints:s.categories,
    county_name_mentions:s.county_mentions,county_signal_type:s.county_mentions.length?'text_mention_only':'no_county_evidence',
    approx_traffic:typeof item.approx_traffic==='string'?item.approx_traffic:null,
    traffic_bucket_floor:trafficFloor(item.approx_traffic),
    published_utc:item.published_utc||null,
    source_sha256:feed.record.source_sha256,source_fetched_utc:feed.record.fetched_utc,
    source_age_hours:feed.ageHours,
    commercial_demand_verified:false,county_search_interest_verified:false,
    screening_reason:s.reason,screening_method:'explicit_phrases_and_exclusions_v1.2'};
   if(s.included){included.push(entry);byScope[scope].displayed_count++}
   else{excluded.push(entry);byScope[scope].excluded_count++}
  }
 }
 const order=(a,b)=>a.scope===b.scope?
  (b.traffic_bucket_floor||0)-(a.traffic_bucket_floor||0)||a.query.localeCompare(b.query):
  a.scope==='US-CA'?-1:1;
 included.sort(order);excluded.sort(order);
 return {version:'fun-google-trends-focus-v1.2',mode:'read_only_cached_source_filter',
  generated_utc:now,markets:byScope,
  relevant:included.slice(0,40),excluded_preview:excluded.slice(0,20),
  relevant_count:included.length,excluded_count:excluded.length,
  counties:CA_COUNTIES.map(name=>({name,measurement_available:false,
   direct_county_google_trends_rss_supported:false,
   matching_queries:included.filter(x=>x.scope==='US-CA'&&x.county_name_mentions.includes(name)).map(x=>x.query),
   evidence_label:'text_mentions_only_not_county_trend_metrics'})),
  county_count:CA_COUNTIES.length,county_level_metrics_available:false,
  regional_data_alternative:'Google Trends BigQuery DMA data requires separate authorized Google Cloud access and DMA-to-county geography joins.',
  controls:{automatic_fetch:false,rea_calls:false,store_mutations:false,training:false},
  notes:['The default view screens out news, sports, weather and person-name searches lacking explicit product/service terms.',
   'Excluded queries remain inspectable for filter auditing; they are not discarded from source evidence.',
   'US-CA represents California-wide Trending Now data, never a 58-county search-count breakdown.',
   'County matches are explicit words in query titles, not geographic measurements.',
   'Google trending news is not actual buyer intent or sales. Empty results are valid.']};
}
