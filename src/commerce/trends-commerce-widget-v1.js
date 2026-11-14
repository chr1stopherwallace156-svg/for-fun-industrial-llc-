// FUN_COMMERCE_WIDGET_V1 — displays saved evidence; external fetch only after an explicit click.
(()=>{'use strict';
const byId=id=>document.getElementById(id);
const box=byId('fi-commerce-panel');if(!box)return;
const state=byId('fi-commerce-state'),contents=byId('fi-commerce-content');
const trendButton=byId('fi-commerce-refresh-trends'),shopButton=byId('fi-commerce-refresh-shopify');
let busy=false;
function message(text){state.textContent=String(text).slice(0,350)}
function renderSection(parent,title,entries,format){
 const h=document.createElement('h3');h.textContent=title;h.style.margin='12px 0 6px';parent.append(h);
 if(!entries.length){const p=document.createElement('p');p.textContent='No saved records.';parent.append(p);return}
 const list=document.createElement('ol');list.style.paddingLeft='22px';
 for(const item of entries){
  const li=document.createElement('li');li.style.marginBottom='8px';li.textContent=format(item);list.append(li);
 }
 parent.append(list);
}
async function request(path,body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),body===undefined?8000:25000);
 try{
  const response=await fetch(path,body===undefined?{cache:'no-store',signal:controller.signal}:{
   method:'POST',headers:{'content-type':'application/json','x-fi-commerce':'operator-click'},
   credentials:'same-origin',body:JSON.stringify({}),signal:controller.signal
  });
  const value=await response.json();
  if(!response.ok)throw Error(value.error||'Commerce service failed');
  return value;
 }finally{clearTimeout(timer)}
}
async function load(){
 const [status,data]=await Promise.all([request('/api/commerce/status'),request('/api/commerce/data')]);
 shopButton.disabled=!status.shopify.configured||busy;
 contents.replaceChildren();
 const meta=document.createElement('p');meta.textContent='US Trending Now: '+(status.googleTrends.refreshed_utc||'not collected')+
  ' · Shopify: '+(status.shopify.configured?'credentials configured':'not configured')+
  ' · Store snapshot: '+(status.shopify.refreshed_utc||'none');contents.append(meta);
 const disclaimer=document.createElement('p');
 disclaimer.textContent='Google trending searches are search-interest signals, NOT verified product demand, product prices, or sales.';
 contents.append(disclaimer);
 const trends=data.trends?.items||[];
 renderSection(contents,'Google US trending searches',trends,x=>x.query+(x.approx_traffic?' · approximate search traffic '+x.approx_traffic:'')+
  (x.published_utc?' · '+x.published_utc:''));
 const products=data.shopify?.products||[];
 renderSection(contents,'Read-only Shopify catalog',products,x=>x.title+' · '+x.status+
  (x.variants?.length?' · listed price '+x.variants[0].selling_price:'')+
  ' · supplier cost not verified');
 const matches=data.matches||[];
 renderSection(contents,'Title overlap (not demand verification)',matches,x=>x.product_title+' ↔ '+x.trend_query+
  ' · '+x.matched_words.join(', '));
 if(data.shopify?.orders_note){const p=document.createElement('p');p.textContent=data.shopify.orders_note;contents.append(p)}
 if(data.shopify?.products_truncated||data.shopify?.orders_truncated){const p=document.createElement('p');p.textContent='Store result truncated; only the first authorized page is shown.';contents.append(p)}
 const tail=document.createElement('p');tail.textContent='Read-only snapshots. No purchases, listings, training, or automatic polling.';
 contents.append(tail);
 message('Cached commerce intelligence loaded · '+trends.length+' trending topics · '+products.length+' catalog products');
}
async function refresh(kind){
 if(busy)return;
 const confirmed=window.confirm(kind==='trends'?
  'Fetch ONE official Google Trending Now US RSS feed, and save a local source snapshot?':
  'Read products and limited order totals from your configured Shopify store? No store modifications.');
 if(!confirmed)return;
 busy=true;trendButton.disabled=true;shopButton.disabled=true;
 message(kind==='trends'?'Fetching Google Trending Now…':'Reading Shopify data…');
 try{
  const outcome=await request(kind==='trends'?'/api/commerce/trends/refresh':'/api/commerce/shopify/refresh',{});
  message('Refresh finished: '+outcome.state);
  await load();
 }catch(error){message('Refresh hold: '+String(error.message||error).slice(0,250))}
 finally{busy=false;trendButton.disabled=false;try{await load()}catch{}}
}
trendButton.addEventListener('click',()=>refresh('trends'));
shopButton.addEventListener('click',()=>refresh('shopify'));
load().catch(e=>message('Commerce API unavailable: '+String(e.message||e).slice(0,220)));
})();
