import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createCommerceIntelligence,parseTrendingRss,matchProductsToTrends,GOOGLE_RSS} from '../src/commerce/trends-commerce-v1.mjs';
import {createUnifiedMlHub,HOST} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';

const rss='<?xml version="1.0"?><rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss"><channel>'+
 '<title>Daily Search Trends</title><item><title><![CDATA[cordless car vacuum cleaner]]></title>'+
 '<ht:approx_traffic>5,000+</ht:approx_traffic><pubDate>Fri, 13 Nov 2026 06:00:00 -0800</pubDate></item>'+
 '<item><title>wireless handheld vacuum</title><ht:approx_traffic>200+</ht:approx_traffic></item></channel></rss>';
const tmp=()=>mkdtemp(join(tmpdir(),'fi-commerce-test-'));
const fetchRss=async(url,options)=>{assert.equal(url,GOOGLE_RSS);assert.equal(options.method,'GET');return new Response(rss,{status:200,headers:{'content-type':'text/xml'}})};
const sampleProduct={node:{id:'gid://shopify/Product/1',title:'Cordless Car Vacuum Cleaner',handle:'cordless-vacuum',status:'ACTIVE',updatedAt:'2026-11-13T04:00:00Z',
 variants:{edges:[{node:{id:'gid://shopify/ProductVariant/2',sku:'VAC-1',price:'39.00'}}],pageInfo:{hasNextPage:false}}}};
function graphqlFetch(url,options){
 assert.equal(url,'https://sample-store.myshopify.com/admin/api/2026-10/graphql.json');
 assert.equal(options.headers['x-shopify-access-token'],'test-token-not-real');
 assert.equal(options.method,'POST');
 const q=JSON.parse(options.body).query;
 const data=q.includes('products(first')?
  {products:{edges:[sampleProduct],pageInfo:{hasNextPage:false}}}:
  {orders:{edges:[],pageInfo:{hasNextPage:false}}};
 return Promise.resolve(new Response(JSON.stringify({data}),{status:200,headers:{'content-type':'application/json'}}));
}
test('Google Trending Now feed preserves approximate traffic and rejects malformed XML',()=>{
 const parsed=parseTrendingRss(rss);
 assert.equal(parsed.length,2);
 assert.equal(parsed[0].query,'cordless car vacuum cleaner');
 assert.equal(parsed[0].approx_traffic,'5,000+');
 assert.equal(parsed[0].published_utc,'2026-11-13T14:00:00.000Z');
 assert.throws(()=>parseTrendingRss('<body>Error</body>'),/GOOGLE_RSS_FORMAT_INVALID/);
});
test('manual Google RSS refresh preserves source digest and local content-addressed bytes, no extra fetch',async()=>{
 const directory=await tmp();let fetches=0;
 try{
  const api=createCommerceIntelligence({directory,fetchImpl:async(...args)=>{fetches++;return fetchRss(...args)}});
  const initial=await api.status();assert.equal(initial.googleTrends.count,0);assert.equal(fetches,0);
  const refreshed=await api.refreshTrends();assert.equal(fetches,1);
  assert.equal(refreshed.state,'captured_unverified_search_interest');
  assert.equal(refreshed.search_volume_is_exact,false);
  const cache=await api.data();assert.equal(fetches,1);assert.equal(cache.trends.items.length,2);
  const files=await readdir(directory);assert.equal(files.filter(x=>x.endsWith('.rss')).length,1);
  const bytes=await readFile(join(directory,files.find(x=>x.endsWith('.rss'))));
  const {createHash}=await import('node:crypto');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),refreshed.source_sha256);
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('Shopify stays unavailable until separately scoped local token is configured',async()=>{
 const directory=await tmp();let requests=0;
 try{
  const api=createCommerceIntelligence({directory,fetchImpl:async()=>{requests++;throw Error('NO_EXTERNAL_CALL')}});
  const state=await api.status();assert.equal(state.shopify.configured,false);
  await assert.rejects(()=>api.refreshShopify(),/SHOPIFY_LOCAL_CREDENTIALS_NOT_CONFIGURED/);
  assert.equal(requests,0);
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('Shopify read-only GraphQL returns listing prices, no invented supplier costs or sales',async()=>{
 const directory=await tmp();let requests=0;
 try{
  const api=createCommerceIntelligence({directory,shopDomain:'sample-store.myshopify.com',
   shopToken:'test-token-not-real',fetchImpl:async(...args)=>{requests++;return graphqlFetch(...args)}});
  const x=await api.refreshShopify();assert.equal(requests,2);
  assert.equal(x.products.length,1);assert.equal(x.orders.length,0);
  assert.equal(x.products[0].variants[0].selling_price,'39.00');
  assert.equal(x.supplier_cost_verified,false);assert.equal(x.profit_verified,false);
  assert.equal(JSON.stringify(x).includes('test-token-not-real'),false);
  const y=await api.data();assert.equal(requests,2);assert.equal(y.shopify.orders_available,true);
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('a word overlap is a discovery hint, never sales demand proof',()=>{
 const matches=matchProductsToTrends([{id:'p1',title:'Cordless Car Vacuum Cleaner'}],
  [{query:'cordless car vacuum cleaner'}]);
 assert.equal(matches.length,1);
 assert.equal(matches[0].match_type,'lexical_overlap_only');
 assert.equal(matches[0].demand_verified,false);
 assert.deepEqual(matchProductsToTrends([{id:'p2',title:'Car Wash'}],[{query:'restaurant wait times'}]),[]);
});
function mockCommerce(){
 let trends=0,shopify=0;
 return {status:async()=>({version:'fun-commerce-intelligence-v1',googleTrends:{count:0},shopify:{configured:false}}),
 data:async()=>({version:'fun-commerce-intelligence-v1',trends:null,shopify:null,matches:[]}),
 refreshTrends:async()=>{trends++;return {state:'captured_unverified_search_interest'}},
 refreshShopify:async()=>{shopify++;return {state:'read_only_store_snapshot'}},
 counts:()=>({trends,shopify})};
}
async function listen(server){return new Promise((resolve,reject)=>server.once('error',reject).listen(0,HOST,()=>resolve(server)))}
async function request(server,method,path,headers={},body=null){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:HOST,port:server.address().port,method,path,headers:{host:'127.0.0.1:8802',...headers}},res=>{
   const parts=[];res.on('data',x=>parts.push(x));res.on('end',()=>resolve({code:res.statusCode,text:Buffer.concat(parts).toString('utf8')}));
  });req.once('error',reject);req.end(body);
 });
}
test('hub commerce status/data are read-only and refresh is separately authorized',async()=>{
 const commerce=mockCommerce();
 const server=await listen(createUnifiedMlHub({commerce,readPage:async()=>'<html><body>hello</body></html>',
  readWidget:async()=> 'x'.repeat(200),readCommerceWidget:async()=> 'window.commerceReady=true'}));
 try{
  assert.equal((await request(server,'GET','/api/commerce/status')).code,200);
  assert.equal((await request(server,'GET','/api/commerce/data')).code,200);
  const html=await request(server,'GET','/');
  assert.match(html.text,/fi-commerce-panel/);
  assert.match(html.text,/api\/commerce\/widget.js/);
  const widget=await request(server,'GET','/api/commerce/widget.js');
  assert.equal(widget.code,200);
  assert.equal((await request(server,'POST','/api/commerce/trends/refresh',{'content-type':'application/json'},'{}')).code,403);
  assert.equal((await request(server,'POST','/api/commerce/trends/refresh',{origin:'https://attacker.example','x-fi-commerce':'operator-click','content-type':'application/json'},'{}')).code,403);
  assert.equal(commerce.counts().trends,0);
  const allowed={origin:'http://127.0.0.1:8802','x-fi-commerce':'operator-click','content-type':'application/json'};
  assert.equal((await request(server,'POST','/api/commerce/trends/refresh',allowed,'{"unexpected":true}')).code,422);
  assert.equal(commerce.counts().trends,0);
  assert.equal((await request(server,'POST','/api/commerce/trends/refresh',allowed,'{}')).code,200);
  assert.equal(commerce.counts().trends,1);
  assert.equal((await request(server,'POST','/api/commerce/shopify/refresh',allowed,'{}')).code,200);
  assert.equal(commerce.counts().shopify,1);
  assert.equal((await request(server,'GET','/api/commerce/not-supported')).code,404);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('Shopify client credentials exchange stays in memory and never enters saved snapshots',async()=>{
 const directory=await tmp();let grants=0,graphql=0;
 try{
  const fetchImpl=async(url,options)=>{
   if(url==='https://sample-store.myshopify.com/admin/oauth/access_token'){
    grants++;
    assert.equal(options.method,'POST');
    assert.equal(options.headers['content-type'],'application/x-www-form-urlencoded');
    const fields=new URLSearchParams(options.body);
    assert.equal(fields.get('grant_type'),'client_credentials');
    assert.equal(fields.get('client_id'),'test-client-id');
    assert.equal(fields.get('client_secret'),'test-secret-not-real');
    return new Response(JSON.stringify({access_token:'token-23456789',expires_in:86399}),{status:200});
   }
   graphql++;
   assert.equal(options.headers['x-shopify-access-token'],'token-23456789');
   const query=JSON.parse(options.body).query;
   const data=query.includes('products(first')?{products:{edges:[sampleProduct],pageInfo:{hasNextPage:false}}}:
    {orders:{edges:[],pageInfo:{hasNextPage:false}}};
   return new Response(JSON.stringify({data}),{status:200});
  };
  const api=createCommerceIntelligence({directory,shopDomain:'sample-store.myshopify.com',
   clientId:'test-client-id',clientSecret:'test-secret-not-real',fetchImpl});
  assert.equal((await api.status()).shopify.auth_mode,'client_credentials');
  await api.refreshShopify();
  await api.refreshShopify();
  assert.equal(grants,1);assert.equal(graphql,4);
  const snapshot=await readFile(join(directory,'shopify.json'),'utf8');
  assert.equal(snapshot.includes('test-secret-not-real'),false);
  assert.equal(snapshot.includes('token-23456789'),false);
 }finally{await rm(directory,{recursive:true,force:true})}
});
