// FUN_COMMERCE_WIDGET_V1 — focus V1.2: filter raw search topics, preserve evidence and explicit operator refresh.
(()=>{'use strict';
const byId=id=>document.getElementById(id);
const box=byId('fi-commerce-panel');if(!box)return;
const state=byId('fi-commerce-state'),contents=byId('fi-commerce-content');
const trendButton=byId('fi-commerce-refresh-trends'),shopButton=byId('fi-commerce-refresh-shopify');
if(!state||!contents||!trendButton||!shopButton)return;
const caButton=document.createElement('button');
caButton.type='button';caButton.id='fi-commerce-refresh-california';
caButton.textContent='Refresh California trends';
caButton.style.cssText='padding:10px 12px;margin:5px 8px 5px 0;background:#a2e7e2;border:0;border-radius:7px;color:#09202c;font-weight:700';
contents.before(caButton);
let busy=false;
let viewScope='all';
let selectedCounty='';
const mk=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el};
function message(text){state.textContent=String(text).slice(0,350)}
function renderSection(parent,title,entries,format){
 const h=mk('h3',title);h.style.margin='14px 0 6px';parent.append(h);
 if(!entries.length){parent.append(mk('p','No matching records in the captured sources. This is not a technical failure.'));return}
 const list=mk('ol');list.style.paddingLeft='22px';
 for(const item of entries){
  const li=mk('li');li.style.marginBottom='8px';li.textContent=format(item);list.append(li);
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
function scopeName(scope){return scope==='US-CA'?'California statewide':scope==='US'?'United States':'Unknown scope'}
function filterScope(items){return viewScope==='all'?items:items.filter(x=>x.scope===viewScope)}
function renderFocus(parent,focus){
 const head=mk('h3','Google Trends · product and service search interests');
 head.style.margin='12px 0 6px';parent.append(head);
 const sub=mk('p','Names, entertainment, sports, weather, and unrelated news are hidden from this default view. Only explicitly recognized product/service terms are shown. An empty list is valid.');
 parent.append(sub);
 const row=mk('div');row.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:10px 0 13px';
 const label=mk('label','Market');
 label.htmlFor='fi-commerce-market';label.style.cssText='font-weight:700;font-size:13px';
 const choice=mk('select');choice.id='fi-commerce-market';
 choice.style.cssText='padding:10px;border-radius:9px;background:#102333;color:#eaf8ff;border:1px solid #52718a;min-width:185px;max-width:100%';
 for(const [value,text] of [['all','All verified markets'],['US-CA','California statewide'],['US','United States']]){
  const opt=mk('option',text);opt.value=value;choice.append(opt)
 }
 choice.value=viewScope;choice.addEventListener('change',()=>{viewScope=choice.value;renderResults()});
 row.append(label,choice);parent.append(row);
 const snap=mk('p');snap.textContent='US: '+String(focus.markets?.US?.state||'not collected')+
  ' · California: '+String(focus.markets?.['US-CA']?.state||'not collected')+
  ' · County-level Google measurements: NOT AVAILABLE';
 parent.append(snap);
 const results=mk('div');results.id='fi-commerce-focus-results';parent.append(results);
 const countyTitle=mk('h3','California county directory · 58 counties');
 parent.append(countyTitle);
 parent.append(mk('p','County names are geographic references for future localized research. Google Trending Now does not provide one search-count feed per county. County matches below mean only that a query explicitly mentions that county.'));
 const countyRow=mk('div');countyRow.style.cssText='display:flex;gap:9px;align-items:center;flex-wrap:wrap';
 const countyLabel=mk('label','Select county');countyLabel.htmlFor='fi-commerce-county';
 const countySelect=mk('select');countySelect.id='fi-commerce-county';
 countySelect.style.cssText='padding:10px;border-radius:9px;background:#102333;color:#eaf8ff;border:1px solid #52718a;max-width:100%;min-width:180px';
 const empty=mk('option','Choose a California county');empty.value='';countySelect.append(empty);
 for(const county of focus.counties||[]){const option=mk('option',county.name+' County');option.value=county.name;countySelect.append(option)}
 countySelect.value=selectedCounty;
 const countyBody=mk('div');countyBody.id='fi-commerce-county-evidence';
 function renderCounty(){
  countyBody.replaceChildren();
  if(!selectedCounty){countyBody.append(mk('p','Choose a county to see source-qualified query text mentions; no county-level measurements are available.'));return}
  const county=(focus.counties||[]).find(x=>x.name===selectedCounty);
  const matches=county?.matching_queries||[];
  countyBody.append(mk('p',selectedCounty+' County · '+matches.length+' explicit query-name mentions in California statewide RSS · not evidence of searches originating in this county.'));
  if(matches.length)renderSection(countyBody,'Matching title mentions only',matches,x=>x);
 }
 countySelect.addEventListener('change',()=>{selectedCounty=countySelect.value;renderCounty()});
 countyRow.append(countyLabel,countySelect);parent.append(countyRow,countyBody);renderCounty();
 const excluded=mk('details');excluded.id='fi-commerce-filter-audit';excluded.style.cssText='border-top:1px solid #334b61;margin-top:20px;padding-top:8px';
 const summary=mk('summary','Show excluded topics for review ('+String(focus.excluded_count||0)+')');
 summary.style.cssText='cursor:pointer;font-weight:700;padding:8px 0';excluded.append(summary);
 excluded.append(mk('p','Exclusions are retained in the original source snapshot. Classification uses transparent keywords, not a verified named-entity model.'));
 const audit=mk('div');excluded.append(audit);parent.append(excluded);
 function renderResults(){
  results.replaceChildren();audit.replaceChildren();
  const filtered=filterScope(focus.relevant||[]);
  renderSection(results,'Product-related topics ('+filtered.length+')',filtered,x=>
   scopeName(x.scope)+' · '+x.query+
   (x.approx_traffic?' · approximate search traffic '+x.approx_traffic:'')+
   ' · categories '+x.category_hints.join(', '));
  const hidden=filterScope(focus.excluded_preview||[]);
  renderSection(audit,'Filtered-out examples',hidden,x=>scopeName(x.scope)+' · '+x.query+' · '+x.screening_reason);
  audit.append(mk('p','Only the first '+(focus.excluded_preview||[]).length+
   ' exclusion records are displayed. The original US/CA RSS source files remain preserved with SHA-256 hashes.'));
 }
 renderResults();
}
async function load(){
 const [status,data,report,focus]=await Promise.all([
  request('/api/commerce/status'),request('/api/commerce/data'),
  request('/api/commerce/opportunities'),request('/api/commerce/focus')]);
 shopButton.disabled=!status.shopify.configured||busy;
 contents.replaceChildren();
 const caSource=status.californiaTrends||{};
 const meta=mk('p','US snapshot: '+(status.googleTrends.refreshed_utc||'not collected')+
  ' · California snapshot: '+(caSource.refreshed_utc||'not collected')+
  ' · Shopify: '+(status.shopify.configured?'configured locally':'PC credentials required'));
 contents.append(meta);
 renderFocus(contents,focus);
 const products=data.shopify?.products||[];
 renderSection(contents,'Shopify product catalog · read-only',products,x=>x.title+' · '+x.status+
  (x.variants?.length?' · listed price '+x.variants[0].selling_price:'')+
  ' · supplier cost not verified');
 const review=mk('section');review.id='fi-commerce-opportunity-report';
 review.style.cssText='border-top:1px solid #52718a;margin-top:16px;padding-top:8px';
 contents.append(review);
 const title=mk('h3','V1.1 · catalog product research queue');review.append(title);
 review.append(mk('p','Legacy V1.1 catalog matches are exploratory. V1.2 separately screens Google topics for commercial relevance; neither measures sales, demand, or profit.'));
 review.append(mk('p','Research state: '+String(report.state||'unavailable')+
  ' · US Google source: '+(report.source_status?.google?.sha256||'missing')+
  ' · source age: '+(report.source_status?.google?.age_hours??'unknown')+' hours'));
 renderSection(review,'Catalog title overlap (not demand validation)',report.matches||[],x=>
  x.product_title+' ↔ '+x.search_query+' · matched '+x.matched_terms.join(', ')+
  ' · research priority '+x.research_priority+
  (x.listed_price_min===null?' · price unavailable':' · listed price '+x.listed_price_min+' (currency unverified)')+
  ' · missing '+x.next_evidence_needed.join('; '));
 renderSection(review,'Unmatched product research leads',report.research_leads||[],x=>
  x.search_query+' · categories '+x.category_hints.join(', ')+
  ' · next '+x.next_evidence_needed.join('; '));
 review.append(mk('p','County metrics: unavailable · verified sales opportunities: NO · orders and publishing: DISABLED'));
 if(data.shopify?.orders_note)contents.append(mk('p',data.shopify.orders_note));
 if(data.shopify?.products_truncated||data.shopify?.orders_truncated)
  contents.append(mk('p','Store snapshot is truncated: only authorized first-page records are shown.'));
 contents.append(mk('p','No background polling, tool execution, Shopify mutation, training or buying.'));
 message('Commercial focus loaded · '+(focus.relevant_count||0)+' related topics · '+(focus.excluded_count||0)+' excluded · California '+String(focus.markets?.['US-CA']?.state||'not collected'));
}
async function refresh(kind){
 if(busy)return;
 const config={
  us:['/api/commerce/trends/refresh','Fetch ONE official Google US Trending Now RSS feed? Source bytes and hash will be stored locally.'],
  california:['/api/commerce/california/refresh','Fetch ONE Google California statewide Trending Now RSS feed? Not county-level metrics.'],
  shopify:['/api/commerce/shopify/refresh','Read only the authorized Shopify catalog and limited order totals? No store modifications.']
 }[kind];
 if(!config)return;
 if(!window.confirm(config[1]))return;
 busy=true;trendButton.disabled=true;caButton.disabled=true;shopButton.disabled=true;
 message('Refreshing '+kind+' data from its authorized source…');
 try{
  const outcome=await request(config[0],{});
  message('Source captured: '+String(outcome.state||'done'));
  await load();
 }catch(error){message('Refresh hold: '+String(error.message||error).slice(0,250))}
 finally{busy=false;trendButton.disabled=false;caButton.disabled=false;try{await load()}catch{}}
}
trendButton.addEventListener('click',()=>refresh('us'));
caButton.addEventListener('click',()=>refresh('california'));
shopButton.addEventListener('click',()=>refresh('shopify'));
load().catch(error=>message('Commerce API unavailable: '+String(error.message||error).slice(0,220)));
})();
