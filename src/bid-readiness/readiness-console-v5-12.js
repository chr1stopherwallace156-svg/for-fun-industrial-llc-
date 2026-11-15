// Read-only FIAL5.12 buyer qualification panel; all text as textContent.
(()=>{'use strict';const root=document.getElementById('fi-bid-readiness');if(!root)return;
 const $=id=>document.getElementById(id),
 summary=$('fi-bid-summary'),cards=$('fi-bid-leads'),sources=$('fi-bid-sources');
 const line=(parent,k,v)=>{
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=String(k)+': ';p.append(b,document.createTextNode(String(v??'UNVERIFIED')));parent.append(p)
 };
 function link(parent,label,url){
  const allowed=['https://longbeachbuys.buyspeed.com/bso/external/',
   'https://californiazesbi.org/applicants/','https://web.cslb.ca.gov/About_Us/'];
  if(typeof url!=='string'||!allowed.some(x=>url.startsWith(x)))return;
  const a=document.createElement('a');a.href=url;a.target='_blank';
  a.rel='noopener noreferrer';a.textContent=label;parent.append(a)
 }
 (async()=>{
  try{
   const r=await fetch('/api/operator/bid-readiness/status',{method:'GET',
    credentials:'same-origin',cache:'no-store'});
   if(!r.ok)throw Error('HTTP_'+r.status);
   const d=await r.json();
   if(d.version!=='fial5.12-bid-readiness-v1')throw Error('UNVERIFIED_VERSION');
   summary.replaceChildren();cards.replaceChildren();sources.replaceChildren();
   line(summary,'Research state',d.state);
   line(summary,'Commercial pathways',d.counts.lead_paths);
   line(summary,'Official documents current',d.counts.source_documents_current||0);
   line(summary,'Verified bid-ready opportunities',0);
   line(summary,'Confirmed revenue','$0');
   line(summary,'Company credentials','Unverified until independently documented');
   line(summary,'Last local source cycle',d.as_of_utc||'Not yet executed');
   for(const l of d.leads||[]){
    const div=document.createElement('article');div.className='item';
    const h=document.createElement('h3');h.textContent=l.title;div.append(h);
    line(div,'Buyer / funding context',l.buyer);
    line(div,'Identifier',l.solicitation_number);
    line(div,'Published deadline',l.deadline_local);
    line(div,'Fit decision',l.fit_state);
    line(div,'Current evidence state',l.candidate_status);
    line(div,'Direct bid ready','NO');
    line(div,'Verified scope',l.source_scope);
    line(div,'Mandatory attendance',l.mandatory_prebid_local||'Not applicable');
    line(div,'Blocking requirements',l.requirement_evidence.join('; '));
    line(div,'Next research step',l.next_action);
    link(div,'Original official source',l.source_url);
    cards.append(div)
   }
   for(const x of d.sources||[]){
    const p=document.createElement('p');
    p.textContent=x.id+' · '+x.display_state+' · '+String(x.reason||'No reported hold')+
     ' · hash '+String(x.sha256||'unavailable').slice(0,16);
    sources.append(p)
   }
  }catch(e){summary.textContent='FIAL512_SOURCE_OR_POLICY_HOLD: '+String(e?.message||e).slice(0,180)}
 })();
})();
