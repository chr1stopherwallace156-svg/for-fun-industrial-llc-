import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {CA_COUNTIES,FEEDS,screenTrend,countyMentions,buildTrendsFocus} from '../src/commerce/google-trends-focus-v1-2.mjs';
import {createCommerceIntelligence,GOOGLE_RSS,GOOGLE_CALIFORNIA_RSS} from '../src/commerce/trends-commerce-v1.mjs';
import {rankCommerceOpportunities} from '../src/commerce/opportunity-ranking-v1-1.mjs';
import {createUnifiedMlHub,HOST} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';

const NOW='2026-11-14T08:15:00.000Z';
const US_HASH='b'.repeat(64),CA_HASH='c'.repeat(64),SHOP_HASH='d'.repeat(64);
const item=(query,approx_traffic='200+')=>({query,approx_traffic,published_utc:'2026-11-14T07:30:00.000Z'});
const source=(scope,items)=>({source_url:FEEDS[scope],source_type:'google_trending_now_rss',
 fetched_utc:'2026-11-14T08:00:00.000Z',source_sha256:scope==='US'?US_HASH:CA_HASH,items});
const shop=products=>({source_type:'shopify_admin_graphql',fetched_utc:'2026-11-14T08:00:00.000Z',products_source_sha256:SHOP_HASH,products,products_truncated:false,orders:[]});
const product=(title,id='gid://shopify/Product/1')=>({id,title,status:'ACTIVE',variants:[{selling_price:'49.00'}]});
const RSS='<?xml version="1.0"?><rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss"><channel>'+
 '<title>Daily Search Trends</title>'+
 '<item><title>Los Angeles County car wash</title><ht:approx_traffic>2,000+</ht:approx_traffic><pubDate>Sat, 14 Nov 2026 00:00:00 -0800</pubDate></item>'+
 '<item><title>jennifer aniston</title><ht:approx_traffic>100+</ht:approx_traffic></item></channel></rss>';

test('CA County reference is exactly 58 unique official county names; not fabricated county measurements',()=>{
 assert.equal(CA_COUNTIES.length,58);
 assert.equal(new Set(CA_COUNTIES).size,58);
 for(const name of ['Los Angeles','San Bernardino','Riverside','Orange','San Diego','Ventura','Kern','Sacramento','Alameda','San Francisco','Yuba']){
  assert.ok(CA_COUNTIES.includes(name),name);
 }
 assert.deepEqual(countyMentions('housing prices Los Angeles County'),['Los Angeles']);
 assert.deepEqual(countyMentions('Riverside County car wash'),['Riverside']);
 assert.deepEqual(countyMentions('river side county car wash'),[]);
});

test('people-only searches, sports, weather and unrelated news remain excluded from product default view',()=>{
 for(const q of ['jennifer aniston','harrison ford','donte johnson',
  'portugal vs denmark','cif football playoffs 2026','big 12 standings',
  'snow storm weather forecast california','japan cyber attack','jonathan kreiss-tomkins']){
  assert.equal(screenTrend(q).included,false,q);
 }
 for(const q of ['wireless headphones','cordless car vacuum cleaner','power drill','car detailing',
 'Los Angeles County car wash','solar panel installation','roof repair']){
  assert.equal(screenTrend(q).included,true,q);
 }
 const place=screenTrend('Los Angeles County car wash');
 assert.deepEqual(place.county_mentions,['Los Angeles']);
 assert.ok(place.categories.includes('local_services'));
 assert.equal(screenTrend('weather forecast california power drill').included,false);
});

test('verified California statewide and US snapshots are independently provenance-tagged and filtered',()=>{
 const report=buildTrendsFocus({now:NOW,
  us:source('US',[item('jennifer aniston'),item('cordless car vacuum cleaner','500+')]),
  california:source('US-CA',[item('Los Angeles County car wash','2,000+'),item('portugal vs denmark')])});
 assert.equal(report.version,'fun-google-trends-focus-v1.2');
 assert.equal(report.county_count,58);
 assert.equal(report.county_level_metrics_available,false);
 assert.equal(report.relevant_count,2);
 assert.equal(report.excluded_count,2);
 assert.equal(report.relevant[0].scope,'US-CA');
 assert.equal(report.relevant[0].traffic_bucket_floor,2000);
 assert.equal(report.relevant[0].source_sha256,CA_HASH);
 assert.equal(report.relevant[1].source_sha256,US_HASH);
 assert.equal(report.relevant[0].county_search_interest_verified,false);
 assert.equal(report.counties.find(x=>x.name==='Los Angeles').matching_queries[0],'Los Angeles County car wash');
 assert.equal(report.counties.find(x=>x.name==='San Bernardino').measurement_available,false);
 assert.equal(report.markets['US-CA'].source_url,GOOGLE_CALIFORNIA_RSS);
 assert.equal(report.markets.US.source_url,GOOGLE_RSS);
 assert.equal(report.excluded_preview[0].screening_reason,'news_sports_weather_or_entertainment_context');
 assert.equal(report.controls.automatic_fetch,false);
});

test('rejects swapped, forged and missing source URL+hash rather than mislabeling national search as California',()=>{
 const fake=source('US',[item('headphones')]);
 const wrong={...fake,source_url:'https://example.net/untrusted'};
 const r=buildTrendsFocus({now:NOW,us:wrong,california:fake});
 assert.equal(r.relevant_count,0);
 assert.equal(r.markets.US.state,'not_collected');
 assert.equal(r.markets['US-CA'].state,'not_collected');
 const bad=source('US-CA',[item('camera')]);bad.source_sha256='bad';
 assert.equal(buildTrendsFocus({now:NOW,california:bad}).markets['US-CA'].state,'not_collected');
});

test('read-only opportunity ranking excludes celebrity titles even when store catalog has title overlap',()=>{
 const us=source('US',[item('jennifer aniston'),item('cordless car vacuum cleaner','3,000+')]);
 const ca=source('US-CA',[item('Riverside County car wash','500+')]);
 const store=shop([product('Jennifer Aniston Collection'),product('Cordless Car Vacuum Cleaner')]);
 const report=rankCommerceOpportunities({trends:us,california:ca,shopify:store,now:NOW});
 assert.equal(report.state,'catalog_matches_need_supplier_and_demand_checks');
 assert.equal(report.trend_count,3);
 assert.ok(!report.matches.some(x=>x.search_query==='jennifer aniston'));
 assert.equal(report.matches.length,1);
 assert.equal(report.matches[0].search_scope,'US');
 assert.equal(report.matches[0].search_source_sha256,US_HASH);
 assert.ok(report.research_leads.some(x=>x.search_query==='Riverside County car wash'&&x.search_scope==='US-CA'));
 assert.equal(report.source_status.california.sha256,CA_HASH);
 assert.equal(report.order_authority,false);
 assert.equal(report.qualifies_as_verified_sales_opportunity,false);
});

test('California fetch is one authorized, bounded HTTPS RSS GET and preserves existing US source evidence',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'fi-trends-california-'));
 let calls=0;
 try{
  const api=createCommerceIntelligence({directory,fetchImpl:async(url,options)=>{
   calls++;assert.equal(url,GOOGLE_CALIFORNIA_RSS);assert.equal(options.method,'GET');
   assert.equal(options.redirect,'error');
   return new Response(RSS,{status:200,headers:{'content-type':'application/rss+xml'}});
  }});
  const before=await api.data();
  assert.equal(before.trends,null);assert.equal(before.california,null);assert.equal(calls,0);
  const result=await api.refreshCaliforniaTrends();
  assert.equal(calls,1);assert.equal(result.state,'captured_california_statewide_search_interest');
  assert.equal(result.geographic_scope,'US-CA');
  assert.equal(result.county_level_metrics_available,false);
  const data=await api.data();
  assert.equal(data.trends,null);assert.equal(data.california.items.length,2);
  assert.equal(data.california.source_url,GOOGLE_CALIFORNIA_RSS);
  assert.equal((await api.status()).californiaTrends.verified,true);
  const filenames=await readdir(directory);
  const name=filenames.find(x=>x.startsWith('trending-us-ca-')&&x.endsWith('.rss'));
  assert.ok(name);
  const bytes=await readFile(join(directory,name));
  const digest=createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest,result.source_sha256);
 }finally{await rm(directory,{recursive:true,force:true})}
});

async function listen(server){return await new Promise((resolve,reject)=>server.once('error',reject).listen(0,HOST,()=>resolve(server)))}
async function request(server,method,path,headers={},body=null){
 return await new Promise((resolve,reject)=>{
  const req=http.request({hostname:HOST,port:server.address().port,path,method,
   headers:{host:'127.0.0.1:8802',...headers}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,
     data:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
   });req.on('error',reject);req.end(body);
 });
}

test('new GET focus is local-only with no external fetch; California POST is same-origin exact user authorization',async()=>{
 let reads=0,californiaFetches=0;
 const commerce={
  data:async()=>{reads++;return {trends:source('US',[item('jennifer aniston')]),california:source('US-CA',[item('car detailing')]),shopify:null}},
  status:async()=>({version:'fun-commerce-intelligence-v1'}),
  refreshCaliforniaTrends:async()=>{californiaFetches++;return {state:'captured_california_statewide_search_interest'}},
  refreshShopify:async()=>{throw Error('UNEXPECTED_ACTION')},
  refreshTrends:async()=>{throw Error('UNEXPECTED_ACTION')}
 };
 const server=await listen(createUnifiedMlHub({commerce}));
 try{
  const report=await request(server,'GET','/api/commerce/focus');
  assert.equal(report.status,200);assert.equal(report.data.county_count,58);
  assert.equal(californiaFetches,0);assert.equal(reads,1);
  assert.equal((await request(server,'POST','/api/commerce/california/refresh',{'content-type':'application/json'},'{}')).status,403);
  assert.equal((await request(server,'POST','/api/commerce/california/refresh',{
   origin:'https://attacker.invalid','content-type':'application/json','x-fi-commerce':'operator-click'},'{}')).status,403);
  assert.equal((await request(server,'POST','/api/commerce/california/refresh',{
   origin:'http://127.0.0.1:8802','content-type':'application/json','x-fi-commerce':'operator-click'},'{"evil":1}')).status,422);
  assert.equal(californiaFetches,0);
  const okay=await request(server,'POST','/api/commerce/california/refresh',{
   origin:'http://127.0.0.1:8802','content-type':'application/json','x-fi-commerce':'operator-click'},'{}');
  assert.equal(okay.status,200);assert.equal(californiaFetches,1);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('Commerce UI displays filtered topics by default and raw news only under an audit disclosure',async()=>{
 const widget=await readFile(new URL('../src/commerce/trends-commerce-widget-v1.js',import.meta.url),'utf8');
 assert.match(widget,/request\('\/api\/commerce\/focus'\)/);
 assert.match(widget,/fi-commerce-refresh-california/);
 assert.match(widget,/fi-commerce-filter-audit/);
 assert.match(widget,/fi-commerce-county/);
 assert.match(widget,/county-level measurements are available/);
 assert.match(widget,/li\.textContent=format\(item\)/);
 assert.match(widget,/screening_reason/);
 assert.doesNotMatch(widget,/innerHTML\s*=/);
});
