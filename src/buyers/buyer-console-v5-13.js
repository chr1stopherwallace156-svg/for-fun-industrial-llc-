// FIAL5.13 — original Operations console, read-only public buyer pathway.
// All untrusted text via textContent; links pinned to reviewed official sites.
(()=>{'use strict';const root=document.getElementById('fi-fleet-buyer');if(!root)return;
 const $=id=>document.getElementById(id);
 const summary=$('fi-buyer-summary'),detail=$('fi-buyer-details'),
  review=$('fi-buyer-gates'),sources=$('fi-buyer-sources');
 function line(parent,label,value){
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=label+': ';p.append(b,document.createTextNode(String(value??'not verified')));
  parent.append(p)
 }
 function link(parent,label,url){
  if(typeof url!=='string'||![
    'https://www.bcsd.com/business-services/',
    'https://californiazesbi.org/applicants/'
  ].some(s=>url.startsWith(s)))return;
  const a=document.createElement('a');a.href=url;a.textContent=label;a.target='_blank';
  a.rel='noopener noreferrer';parent.append(a)
 }
 (async()=>{
  try{
   const r=await fetch('/api/operator/buyer/status',{method:'GET',
    credentials:'same-origin',cache:'no-store'});
   if(!r.ok)throw Error('BUYER_STATUS_HTTP_'+r.status);
   const d=await r.json();
   if(d.version!=='fial5.13-verified-fleet-buyer-v1')throw Error('BUYER_VERSION_UNEXPECTED');
   summary.replaceChildren();detail.replaceChildren();review.replaceChildren();sources.replaceChildren();
   line(summary,'Research state',d.state);
   line(summary,'Current verified public buyer pathway',d.counts.verified_public_buyer_pathways);
   line(summary,'Public sources current',d.counts.current_sources);
   line(summary,'Verified open EV bus repair bids',0);
   line(summary,'Verified customer revenue','$0');
   line(summary,'Last source observation',d.as_of_utc||'Not activated');
   const buyer=d.buyer;
   const h=document.createElement('h3');h.textContent=buyer.name;detail.append(h);
   line(detail,'Location',buyer.area);
   line(detail,'Officially published school bus fleet',buyer.published_total_school_buses);
   line(detail,'Published maintenance arrangements',buyer.publicly_stated_maintenance);
   line(detail,'Buyer pathway',d.decision.buyer_evidence_state);
   line(detail,'Specific present EV maintenance need','NOT VERIFIED');
   line(detail,'Electric buses in district','NOT VERIFIED');
   line(detail,'ZESBI awarded recipient','NOT VERIFIED');
   line(detail,'Elektron vendor eligibility','NOT VERIFIED');
   line(detail,'Site access','Prior authorization required');
   line(detail,'Purchase authority','District purchasing staff issue purchase orders');
   line(detail,'Possible work scope (research only)',buyer.target_services.join('; '));
   link(detail,'Official transportation fleet source',buyer.published_operating_fleet_source);
   detail.append(document.createTextNode(' · '));
   link(detail,'Official purchasing portal instructions',buyer.purchasing_bid_source);
   detail.append(document.createTextNode(' · '));
   link(detail,'Official vendor policy',buyer.vendor_policy_source);
   for(const gate of d.requirements||[]){
    const p=document.createElement('p');p.textContent='UNVERIFIED — '+gate.replaceAll('_',' ');
    review.append(p)
   }
   for(const src of d.sources||[]){
    const p=document.createElement('p');
    p.textContent=src.id+' · '+src.display_state+
     (src.reason?' · '+src.reason:'')+
     ' · SHA256 '+String(src.sha256||'unavailable').slice(0,16);
    sources.append(p)
   }
  }catch(e){summary.textContent='FLEET_BUYER_EVIDENCE_HOLD: '+String(e?.message||e).slice(0,170)}
 })();
})();
