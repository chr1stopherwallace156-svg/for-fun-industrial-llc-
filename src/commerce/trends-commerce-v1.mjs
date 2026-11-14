// FUN_COMMERCE_INTELLIGENCE_V1: read-only Google Trending Now and scoped Shopify Admin.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';

export const GOOGLE_RSS='https://trends.google.com/trending/rss?geo=US';
const VERSION='fun-commerce-intelligence-v1',SHOP_API='2026-10';
const PRODUCTS_QUERY='query FunCommerceProducts { shop { name } products(first: 50, sortKey: UPDATED_AT, reverse: true) { edges { node { id title handle status updatedAt variants(first: 5) { edges { node { id sku price } } pageInfo { hasNextPage } } } } pageInfo { hasNextPage } } }';
const ORDERS_QUERY='query FunCommerceOrders { orders(first: 20, sortKey: CREATED_AT, reverse: true) { edges { node { id name createdAt totalPriceSet { shopMoney { amount currencyCode } } } } pageInfo { hasNextPage } } }';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const safe=(x,max=200)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max).trim();
const domainValid=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{1,61}\.myshopify\.com$/.test(x);
const xmlText=x=>String(x||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
 .replace(/&(?:amp|lt|gt|quot|apos|#x([0-9a-f]+)|#([0-9]+));/gi,(entity,hex,dec)=>{
  if(hex||dec){const n=parseInt(hex||dec,hex?16:10);return n>=32&&n<=0x10ffff?String.fromCodePoint(n):''}
  return {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[entity.toLowerCase()]||entity;
 });
function field(xml,tag){const match=xml.match(new RegExp('<'+tag.replace(':','\\:')+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag.replace(':','\\:')+'>','i'));return safe(xmlText(match?.[1]),400)}
export function parseTrendingRss(raw){
 if(typeof raw!=='string'||raw.length>260000||!/<rss\b/i.test(raw)||!/<channel\b/i.test(raw))throw Error('GOOGLE_RSS_FORMAT_INVALID');
 const items=[...raw.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,20).map((match,i)=>{
  const xml=match[1],title=field(xml,'title');
  const traffic=field(xml,'ht:approx_traffic');
  const published=field(xml,'pubDate');
  return {rank:i+1,query:title,approx_traffic:traffic||null,published_utc:Number.isFinite(Date.parse(published))?new Date(published).toISOString():null};
 }).filter(x=>x.query.length>0);
 if(!items.length)throw Error('GOOGLE_RSS_NO_TRENDS');
 return items;
}
async function bytesResponse(response,limit){
 if(!response?.ok)throw Error('SOURCE_HTTP_'+String(response?.status||'unknown'));
 const declared=Number(response.headers?.get?.('content-length'));
 if(Number.isFinite(declared)&&declared>limit)throw Error('SOURCE_TOO_LARGE');
 const parts=[];let size=0;
 if(!response.body)throw Error('SOURCE_BODY_MISSING');
 for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('SOURCE_TOO_LARGE');parts.push(chunk)}
 return Buffer.concat(parts);
}
function homeDir(){return join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial','CommerceIntelligenceV1')}
async function loadSnapshot(directory,name){
 try{const raw=await readFile(join(directory,name+'.json'));if(raw.length>250000)throw Error('SNAPSHOT_TOO_LARGE');return JSON.parse(raw.toString('utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
async function persist(directory,name,data,raw=null){
 await mkdir(directory,{recursive:true});
 if(raw){
  const filename='trending-us-'+sha(raw)+'.rss';
  try{await writeFile(join(directory,filename),raw,{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
 }
 const tmp=join(directory,'.'+name+'-'+randomUUID()+'.tmp');
 await writeFile(tmp,JSON.stringify(data),{flag:'wx'});
 await rename(tmp,join(directory,name+'.json'));
}
async function jsonGraphql({url,token,query,fetchImpl}){
 const response=await fetchImpl(url,{method:'POST',redirect:'error',headers:{
  'content-type':'application/json','accept':'application/json','x-shopify-access-token':token
 },body:JSON.stringify({query}),signal:AbortSignal.timeout(16000)});
 const raw=await bytesResponse(response,600000);
 let value;try{value=JSON.parse(raw.toString('utf8'))}catch{throw Error('SHOPIFY_JSON_INVALID')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('SHOPIFY_RESPONSE_INVALID');
 if(Array.isArray(value.errors)&&value.errors.length)throw Error('SHOPIFY_GRAPHQL_REJECTED:'+safe(value.errors[0].message,120));
 return {data:value.data,digest:sha(raw)};
}
const terms=s=>[...new Set(safe(s,300).toLowerCase().match(/[a-z0-9]{3,}/g)||[])].filter(x=>!['with','that','from','have','this','what','your','near','best','plus','new'].includes(x));
export function matchProductsToTrends(products,trends){
 const results=[];
 for(const product of products){
  const p=terms(product.title);
  for(const trend of trends){
   const matches=p.filter(t=>terms(trend.query).includes(t));
   if(matches.length>=2)results.push({product_id:product.id,product_title:product.title,trend_query:trend.query,matched_words:matches,match_type:'lexical_overlap_only',demand_verified:false});
  }
 }
 return results.slice(0,30);
}
export function createCommerceIntelligence({fetchImpl=fetch,directory=homeDir(),shopDomain=process.env.FUN_SHOPIFY_SHOP_DOMAIN||'',
 shopToken=process.env.FUN_SHOPIFY_ADMIN_TOKEN||''}={}){
 let active=false;
 async function data(){
  const [trends,store]=await Promise.all([loadSnapshot(directory,'trends'),loadSnapshot(directory,'shopify')]);
  return {version:VERSION,mode:'manual_read_only',trends,shopify:store,
   matches:matchProductsToTrends(store?.products||[],trends?.items||[]),
   disclaimers:['Trending searches are not product demand or sales. Approximate traffic is a search-interest bucket.',
    'Selling prices do not establish net profit without verified supplier cost, shipping, fees and returns.',
    'No purchases, product publication, training or REA tools are authorized.']};
 }
 async function status(){
  const state=await data();
  return {version:VERSION,googleTrends:{source:GOOGLE_RSS,mode:'public_rss_not_alpha_api',
   refreshed_utc:state.trends?.fetched_utc||null,count:state.trends?.items?.length||0},
   shopify:{configured:domainValid(shopDomain)&&Boolean(shopToken),domain:domainValid(shopDomain)?shopDomain:null,
    refreshed_utc:state.shopify?.fetched_utc||null,products:state.shopify?.products?.length||0,
    orders:state.shopify?.orders?.length||0},automaticPolling:false,externalActions:0,
   purchaseAuthority:false,trainingAuthority:false,busy:active};
 }
 async function refreshTrends(){
  if(active)throw Error('COMMERCE_BUSY');active=true;
  try{
   const response=await fetchImpl(GOOGLE_RSS,{method:'GET',redirect:'error',
    headers:{accept:'application/rss+xml,application/xml;q=0.9'},signal:AbortSignal.timeout(12000)});
   const raw=await bytesResponse(response,250000),items=parseTrendingRss(raw.toString('utf8'));
   const record={source_url:GOOGLE_RSS,source_type:'google_trending_now_rss',fetched_utc:new Date().toISOString(),
    source_sha256:sha(raw),items,search_volume_is_exact:false,search_volume_is_sales:false};
   await persist(directory,'trends',record,raw);
   return {state:'captured_unverified_search_interest',...record};
  }finally{active=false}
 }
 async function refreshShopify(){
  if(active)throw Error('COMMERCE_BUSY');
  if(!domainValid(shopDomain)||!shopToken)throw Error('SHOPIFY_LOCAL_TOKEN_NOT_CONFIGURED');
  if(typeof shopToken!=='string'||shopToken.length>1024)throw Error('SHOPIFY_TOKEN_INVALID');
  active=true;
  try{
   const endpoint='https://'+shopDomain+'/admin/api/'+SHOP_API+'/graphql.json';
   const productPayload=await jsonGraphql({url:endpoint,token:shopToken,query:PRODUCTS_QUERY,fetchImpl});
   const nodes=productPayload.data?.products?.edges;
   if(!Array.isArray(nodes))throw Error('SHOPIFY_PRODUCTS_SCHEMA_INVALID');
   const products=nodes.map(({node})=>({id:safe(node.id,110),title:safe(node.title,280),handle:safe(node.handle,110),
    status:safe(node.status,30),updated_at:safe(node.updatedAt,60),
    variants:(node.variants?.edges||[]).slice(0,5).map(({node:v})=>({id:safe(v.id,110),sku:safe(v.sku,80),
     selling_price:safe(v.price,30)})),
    variants_truncated:node.variants?.pageInfo?.hasNextPage===true})).slice(0,50);
   let orders=[],orders_available=false,orders_note=null,ordersDigest=null,ordersMore=false;
   try{
    const orderPayload=await jsonGraphql({url:endpoint,token:shopToken,query:ORDERS_QUERY,fetchImpl});
    const edges=orderPayload.data?.orders?.edges;
    if(!Array.isArray(edges))throw Error('SHOPIFY_ORDERS_SCHEMA_INVALID');
    orders=edges.slice(0,20).map(({node})=>({id:safe(node.id,110),name:safe(node.name,80),created_at:safe(node.createdAt,60),
     total:safe(node.totalPriceSet?.shopMoney?.amount,40),currency:safe(node.totalPriceSet?.shopMoney?.currencyCode,10)}));
    orders_available=true;ordersMore=orderPayload.data?.orders?.pageInfo?.hasNextPage===true;ordersDigest=orderPayload.digest;
   }catch(e){orders_note='Orders unavailable with current read-only permissions or API state: '+safe(e.message,160)}
   const record={source_url:endpoint,source_type:'shopify_admin_graphql',api_version:SHOP_API,
    fetched_utc:new Date().toISOString(),products_source_sha256:productPayload.digest,
    orders_source_sha256:ordersDigest,products,products_truncated:productPayload.data.products.pageInfo?.hasNextPage===true,
    orders,orders_available,orders_note,orders_truncated:ordersMore,
    supplier_cost_verified:false,profit_verified:false};
   await persist(directory,'shopify',record);
   return {state:'read_only_store_snapshot',...record};
  }finally{active=false}
 }
 return Object.freeze({status,data,refreshTrends,refreshShopify});
}
