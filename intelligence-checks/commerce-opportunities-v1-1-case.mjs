// Deterministic, entirely offline Commerce Intelligence V1.1 qualification.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rankCommerceOpportunities} from '../src/commerce/opportunity-ranking-v1-1.mjs';
import {GOOGLE_RSS} from '../src/commerce/trends-commerce-v1.mjs';
import {createUnifiedMlHub,HOST} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import http from 'node:http';
const NOW='2026-11-13T23:00:00.000Z';
const GOOGLE_SHA='a'.repeat(64),SHOP_SHA='b'.repeat(64);
const trend=(query,approx_traffic='500+')=>({query,approx_traffic,published_utc:NOW});
const google=(items)=>({source_url:GOOGLE_RSS,fetched_utc:'2026-11-13T21:00:00.000Z',source_sha256:GOOGLE_SHA,items});
const product=(title='Cordless Car Vacuum Cleaner')=>({
 id:'gid://shopify/Product/1001',title,status:'ACTIVE',variants:[{selling_price:'34.50',id:'variant1'}]});
const shop=(products)=>({source_type:'shopify_admin_graphql',fetched_utc:'2026-11-13T22:00:00.000Z',products_source_sha256:SHOP_SHA,
 products,products_truncated:false,orders:[]});
test('no saved snapshots cannot fabricate a ranked product opportunity',()=>{
 const report=rankCommerceOpportunities({now:NOW});
 assert.equal(report.state,'awaiting_google_source');
 assert.equal(report.trend_count,0);
 assert.equal(report.matches.length,0);
 assert.equal(report.research_leads.length,0);
 assert.equal(report.qualifies_as_verified_sales_opportunity,false);
 assert.equal(report.order_authority,false);
});
test('real RSS product vocabulary produces only unverified research leads without a Shopify catalog',()=>{
 const report=rankCommerceOpportunities({now:NOW,trends:google([
  trend('cordless car vacuum cleaner','5,000+'),
  trend('portugal vs denmark','2,000+'),
  trend('cif football playoffs 2026','200+')
 ])});
 assert.equal(report.state,'product_interest_leads_need_supplier_checks');
 assert.equal(report.trend_count,3);
 assert.equal(report.shopify_product_count,0);
 assert.equal(report.research_leads.length,1);
 assert.equal(report.research_leads[0].search_query,'cordless car vacuum cleaner');
 assert.equal(report.research_leads[0].search_lower_bound,5000);
 assert.equal(report.research_leads[0].available_supplier_product_verified,false);
 assert.equal(report.uncategorized_search_count,2);
 assert.equal(report.matches.length,0);
});
test('catalog and search overlap are auditable; listed price never becomes verified supplier cost or profit',()=>{
 const report=rankCommerceOpportunities({now:NOW,trends:google([trend('cordless car vacuum cleaner','5000+'),trend('football playoffs 2026')]),
  shopify:shop([product()])});
 assert.equal(report.state,'catalog_matches_need_supplier_and_demand_checks');
 assert.equal(report.matches.length,1);
 const match=report.matches[0];
 assert.equal(match.kind,'catalog_title_overlap');
 assert.equal(match.product_id,'gid://shopify/Product/1001');
 assert.equal(match.listed_price_min,34.5);
 assert.equal(match.price_currency,'shop_currency_not_yet_verified');
 assert.deepEqual(match.matched_terms,['cordless','car','vacuum','cleaner']);
 assert.equal(match.search_source_sha256,GOOGLE_SHA);
 assert.equal(match.catalog_source_sha256,SHOP_SHA);
 assert.equal(match.real_market_demand_verified,false);
 assert.equal(match.supplier_availability_verified,false);
 assert.equal(match.supplier_cost_verified,false);
 assert.equal(match.net_profit_estimated,false);
 assert.equal(match.priority_is_heuristic,true);
 assert.ok(match.next_evidence_needed.includes('supplier wholesale cost'));
 assert.equal(report.qualifies_as_verified_sales_opportunity,false);
 assert.equal(report.uncategorized_search_count,1);
});
test('invalid or stale Google source cannot be presented as fresh market evidence',()=>{
 const stale=google([trend('cordless car vacuum cleaner')]);
 stale.fetched_utc='2026-11-09T00:00:00.000Z';
 const report=rankCommerceOpportunities({now:NOW,trends:stale,shopify:shop([product()])});
 assert.equal(report.state,'source_stale_review_only');
 assert.ok(report.source_status.google.age_hours>48);
 assert.equal(report.qualifies_as_verified_sales_opportunity,false);
 const invalid=google([trend('car detailing')]);invalid.source_sha256='invalid';
 const refused=rankCommerceOpportunities({now:NOW,trends:invalid,shopify:shop([product()])});
 assert.equal(refused.state,'awaiting_google_source');
 assert.equal(refused.trend_count,0);
});
test('a single shared word or malformed prices do not produce invented margin, demand or supplier verification',()=>{
 const other=product('Car Detailing Product');other.variants=[{selling_price:'not-a-price'}];
 const report=rankCommerceOpportunities({now:NOW,
  trends:google([trend('best car vacuum')]),shopify:shop([other])});
 assert.equal(report.matches.length,0);
 assert.equal(report.research_leads.length,1);
 assert.equal(report.research_leads[0].available_supplier_product_verified,false);
 const matched=rankCommerceOpportunities({now:NOW,
  trends:google([trend('car detailing')]),shopify:shop([other])});
 assert.equal(matched.matches.length,1);
 assert.equal(matched.matches[0].listed_price_min,null);
});
test('product ranking only exposes capped evidence and never constructs action permissions',()=>{
 const topics=Array.from({length:40},(_,i)=>trend('cordless car vacuum '+i,'100+'));
 const items=Array.from({length:80},(_,i)=>({id:'p'+i,title:'Cordless Car Vacuum '+i,variants:[]}));
 const report=rankCommerceOpportunities({now:NOW,trends:google(topics),shopify:shop(items)});
 assert.equal(report.trend_count,25);
 assert.equal(report.shopify_product_count,50);
 assert.ok(report.matches.length<=20);
 assert.ok(report.research_leads.length<=12);
 assert.equal(report.order_authority,false);
 assert.equal(report.qualifies_as_verified_sales_opportunity,false);
});
test('read-only V1.1 HTTP report is tied to cached snapshots and never invokes refresh or model inference',async()=>{
 let reads=0,refreshes=0;
 const commerce={
  data:async()=>{reads++;return {trends:google([trend('cordless car vacuum')]),shopify:shop([product()])}},
  status:async()=>({version:'fun-commerce-intelligence-v1'}),
  refreshTrends:async()=>{refreshes++;throw Error('MUST_NOT_RUN')},
  refreshShopify:async()=>{refreshes++;throw Error('MUST_NOT_RUN')}
 };
 const service=createUnifiedMlHub({commerce,readPage:async()=>'<html><body>Test</body></html>',
  readWidget:async()=> 'x'.repeat(200),readCommerceWidget:async()=> 'window.test=true'});
 const server=await new Promise((resolve,reject)=>service.once('error',reject).listen(0,HOST,()=>resolve(service)));
 try{
  const outcome=await new Promise((resolve,reject)=>{
   const req=http.request({hostname:HOST,port:server.address().port,path:'/api/commerce/opportunities',method:'GET',
    headers:{host:'127.0.0.1:8802'}},res=>{
    const parts=[];res.on('data',x=>parts.push(x));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(parts).toString('utf8'))}));
   });req.once('error',reject);req.end();
  });
  assert.equal(outcome.status,200);
  assert.equal(outcome.data.version,'fun-commerce-opportunities-v1.1');
  assert.equal(outcome.data.matches.length,1);
  assert.equal(reads,1);
  assert.equal(refreshes,0);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('browser queue is displayed with textContent rather than untrusted markup injection',async()=>{
 const code=await readFile(new URL('../src/commerce/trends-commerce-widget-v1.js',import.meta.url),'utf8');
 assert.match(code,/fi-commerce-opportunity-report/);
 assert.match(code,/request\('\/api\/commerce\/opportunities'\)/);
 assert.match(code,/li\.textContent=format\(item\)/);
 assert.doesNotMatch(code,/innerHTML\s*=/);
});
