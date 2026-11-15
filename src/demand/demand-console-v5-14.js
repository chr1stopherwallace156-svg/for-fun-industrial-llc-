// FIAL5.14 public purchasing evidence panel. Text only; no external
// JS, HTML injection, bids, outreach or procurement automation.
(()=>{'use strict';
 const root=document.getElementById('fi-purchase-demand');if(!root)return;
 const $=id=>document.getElementById(id);
 const summary=$('fi-demand-summary'),notice=$('fi-demand-notice'),
  requirements=$('fi-demand-gates'),health=$('fi-demand-sources');
 function line(parent,label,value){
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=label+': ';p.append(b,document.createTextNode(String(value??'UNVERIFIED')));parent.append(p)
 }
 function sourceLink(parent,title,url){
  const allowed=[
   'https://vvta.org/procurement/',
   'https://vvta.org/wp-content/uploads/2026/10/2027-01-Addendum-No.-1.pdf'
  ];
  if(!allowed.includes(url))return;
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
  a.textContent=title;parent.append(a)
 }
 (async()=>{
  try{
   const r=await fetch('/api/operator/purchase-demand/status',{
    method:'GET',credentials:'same-origin',cache:'no-store'});
   if(!r.ok)throw Error('DEMAND_HTTP_'+r.status);
   const d=await r.json();
   if(d.version!=='fial5.14-official-purchase-demand-v1')throw Error('DEMAND_VERSION_MISMATCH');
   summary.replaceChildren();notice.replaceChildren();requirements.replaceChildren();health.replaceChildren();
   line(summary,'Source evidence',d.state);
   line(summary,'Official source documents current',d.counts.current_source_docs||0);
   line(summary,'Documented future service purchasing intentions',d.counts.documented_future_service_intents||0);
   line(summary,'Open maintenance service RFPs verified',0);
   line(summary,'Qualified ELEKTRON bids / contracts','0 / 0');
   line(summary,'Verified revenue','$0');
   line(summary,'Last bounded check',d.as_of_utc||'Not activated');
   const n=d.notice;
   const h=document.createElement('h3');h.textContent=n.issuer+' — '+n.solicitation;notice.append(h);
   line(notice,'Published IFB',n.title);
   line(notice,'Published deadline',n.published_close_local);
   line(notice,'Construction deadline state',d.classification.published_construction_deadline_state);
   line(notice,'Base construction procurement',n.construction_scope);
   line(notice,'General prime license',n.prime_classification_addendum_q5);
   line(notice,'Documented addendum Q13 / A13',n.addendum_q13);
   line(notice,'Future maintenance procurement',d.classification.future_service_evidence_state);
   line(notice,'Future maintenance RFP number','NOT YET VERIFIED');
   line(notice,'Future maintenance procurement date','NOT YET VERIFIED');
   line(notice,'ELEKTRON authorization/qualifications','NOT VERIFIED');
   line(notice,'Risk','Facility gas detector calibration differs from EV fleet powertrain conversions');
   sourceLink(notice,'Original VVTA open-IFB listing',n.source_listing);
   notice.append(document.createTextNode(' · '));
   sourceLink(notice,'Original Addendum 1 (Q5 and Q13)',n.source_addendum);
   for(const g of d.qualification_gates||[]){
    const p=document.createElement('p');p.textContent='UNVERIFIED — '+g.replaceAll('_',' ');
    requirements.append(p)
   }
   for(const x of d.sources||[]){
    const p=document.createElement('p');
    p.textContent=x.id+' · '+x.display_state+
     (x.reason?' · '+x.reason:'')+' · SHA256 '+String(x.sha256||'none').slice(0,16);
    health.append(p)
   }
  }catch(e){summary.textContent='OFFICIAL_PURCHASE_DEMAND_HOLD: '+String(e.message||e).slice(0,180)}
 })();
})();
