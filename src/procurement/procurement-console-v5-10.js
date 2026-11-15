// FIAL5.10 operator read-only notice view; textContent only.
(()=>{'use strict';
 const root=document.getElementById('fi-procurement');if(!root)return;
 const status=document.getElementById('fi-procurement-status');
 const box=document.getElementById('fi-procurement-notices');
 const health=document.getElementById('fi-procurement-sources');
 function line(parent,key,value){
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=key+': ';p.append(b,document.createTextNode(String(value??'unknown')));parent.append(p)
 }
 function link(parent,label,url){
  if(!['https://jurupausd.org/our-district/BizServ/css/',
   'https://pbsystem.planetbids.com/portal/60604/'].some(x=>url.startsWith(x)))return;
  const a=document.createElement('a');a.textContent=label;a.href=url;a.rel='noopener noreferrer';
  a.target='_blank';parent.append(a);
 }
 async function render(){
  try{
   const resp=await fetch('/api/operator/procurement/status',{method:'GET',
    credentials:'same-origin',cache:'no-store'});
   if(!resp.ok)throw Error('STATUS_HTTP_'+resp.status);
   const d=await resp.json();
   if(d.version!=='fial5.10-published-procurement-v1')throw Error('VERSION_MISMATCH');
   status.replaceChildren();box.replaceChildren();health.replaceChildren();
   line(status,'Procurement state',d.state);
   line(status,'Officially listed notice with future deadline',
    d.counts.verified_current_published_notices);
   line(status,'Verified qualified ELEKTRON bid opportunities',0);
   line(status,'Awarded work / realized revenue','0 / $0');
   line(status,'Last local evidence check',d.as_of_utc||'Not activated');
   line(status,'Program constraints','No bids, filings, emails, payments or model execution');
   const n=d.notice;
   if(n){
    const article=document.createElement('section');article.className='item';
    const h=document.createElement('h3');h.textContent=n.issuer+' — '+n.solicitation_id;article.append(h);
    line(article,'Title',n.title);
    line(article,'Published deadline',n.due_local);
    line(article,'Procurement scope',n.scope);
    line(article,'Buyer/portal live status verified','NO — verify in PlanetBids');
    line(article,'ELEKTRON direct-vendor fit','UNVERIFIED — qualified transportation operator required');
    line(article,'Electric conversion requirement','NOT STATED');
    line(article,'Opportunity status',d.state);
    link(article,'Issuer listing',n.source_listing_url);
    article.append(document.createTextNode(' · '));
    link(article,'Official one-page notice',n.source_notice_url);
    article.append(document.createTextNode(' · '));
    link(article,'Submission portal (review only)',n.submission_url);
    box.append(article);
   }
   for(const s of d.sources||[]){
    const p=document.createElement('p');
    p.textContent=s.id+' · '+s.state+' · checked '+String(s.last_checked_utc||'unknown')+
     (s.reason?' · '+s.reason:'')+
     (s.sha256?' · SHA256 '+s.sha256.slice(0,16):'');
    health.append(p)
   }
   for(const note of d.review_notes||[])line(health,'Review required',note);
  }catch(e){status.textContent='PROCUREMENT_EVIDENCE_HOLD: '+String(e.message||e).slice(0,180)}
 }
 render();
})();
