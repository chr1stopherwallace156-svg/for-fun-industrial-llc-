// FIAL5.14 — source-linked research only, no login, bid or refresh action.
(()=>{'use strict';const root=document.getElementById('fi-purchase-demand');if(!root)return;
 const $=id=>document.getElementById(id);
 const status=$('fi-demand-status'),buyer=$('fi-demand-buyer'),
 funding=$('fi-demand-funding'),sources=$('fi-demand-sources'),hints=$('fi-demand-hints');
 function field(parent,label,value){
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=label+': ';p.append(b,document.createTextNode(String(value??'UNVERIFIED')));parent.append(p)
 }
 function official(parent,label,url){
  const allow=['https://www.bcsd.com/business-services/purchasing/bids',
  'https://www.energy.ca.gov/solicitations/2026-11/',
  'https://californiazesbi.org/applicants/'];
  if(typeof url!=='string'||!allow.some(x=>url.startsWith(x)))return;
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
  a.textContent=label;parent.append(a)
 }
 (async()=>{
  try{
   const res=await fetch('/api/operator/demand/status',{method:'GET',credentials:'same-origin',cache:'no-store'});
   if(!res.ok)throw Error('STATUS_HTTP_'+res.status);
   const d=await res.json();
   if(d.version!=='fial5.14-real-purchase-demand-v1')throw Error('VERSION_INVALID');
   status.replaceChildren();buyer.replaceChildren();funding.replaceChildren();
   sources.replaceChildren();hints.replaceChildren();
   field(status,'Research mode',d.state);
   field(status,'Official sources currently checked',d.counts.current_sources||0);
   field(status,'Title-only possible matches for human review',d.counts.titles_for_manual_review||0);
   field(status,'Verified open EV maintenance RFPs',0);
   field(status,'Verified current customer service orders',0);
   field(status,'Verified revenue','$0');
   field(status,'Local evidence date',d.as_of_utc||'Not yet activated');
   field(buyer,'Buyer',d.buyer.name);
   field(buyer,'Published district school buses',d.buyer.publicly_reported_school_buses);
   field(buyer,'Verified electric school bus count','NOT VERIFIED');
   field(buyer,'Buyer demand',d.decision.bcsd_current_ev_service_requirement_verified?'REVIEW':'NOT VERIFIED');
   field(buyer,'Solicitation status','Index listing is not an official open bid package');
   official(buyer,'Official buyer bid index',d.buyer.buyer_bid_list);
   field(funding,'Program',d.program.name);
   field(funding,'Officially announced available funding','At least $55 million, for eligible LEAs');
   field(funding,'Published application acceptance start','November 17, 2026, 10:00 a.m. Pacific');
   field(funding,'Program event',d.program_event_state);
   field(funding,'Elektron direct grant eligibility','NOT VERIFIED; not an eligible LEA');
   field(funding,'District awarded funding','NOT VERIFIED');
   field(funding,'Research-only service categories',d.program.eligible_service_categories.join('; '));
   official(funding,'CEC official funding announcement',d.program.source);
   for(const x of d.active_bid_review.possible_relevant_titles||[]){
    const p=document.createElement('p');
    p.textContent=x.title+' — TITLE ONLY; deadline, source package, EV scope and vendor eligibility unverified';
    hints.append(p)
   }
   if(!(d.active_bid_review.possible_relevant_titles||[]).length){
    const p=document.createElement('p');p.textContent='No validated matching title in the last retrieved public index; PlanetBids requires separate review.';hints.append(p)
   }
   for(const src of d.sources||[]){
    const p=document.createElement('p');
    p.textContent=src.id+' · '+src.display_state+(src.reason?' · '+src.reason:'')+
     ' · SHA256 '+String(src.sha256||'missing').slice(0,16);
    sources.append(p)
   }
  }catch(err){status.textContent='DEMAND_EVIDENCE_HOLD: '+String(err?.message||err).slice(0,150)}
 })();
})();
