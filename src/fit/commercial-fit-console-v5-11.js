// FIAL5.11 read-only commercial-fit panel on original 8802 Operations page.
// No arbitrary source HTML or license claims are rendered as markup.
(()=>{'use strict';const root=document.getElementById('fi-commercial-fit');
 if(!root)return;
 const $=id=>document.getElementById(id);
 const summary=$('fi-fit-summary'),queue=$('fi-fit-queue'),health=$('fi-fit-sources');
 function item(parent,k,v){const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=k+': ';p.append(b,document.createTextNode(String(v??'unverified')));parent.append(p)}
 function source(parent,label,url){
  const allowed=['https://www.morganhill.ca.gov/DocumentCenter/View/58391/',
   'https://www.energy.ca.gov/solicitations/2026-02/',
   'https://www.scaqmd.gov/nav/grants-bids'];
  if(typeof url!=='string'||!allowed.some(x=>url.startsWith(x)))return;
  const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';
  a.rel='noopener noreferrer';parent.append(a)
 }
 (async()=>{
  try{
   const r=await fetch('/api/operator/fit/status',{method:'GET',cache:'no-store',credentials:'same-origin'});
   if(!r.ok)throw Error('FIT_STATUS_HTTP_'+r.status);
   const d=await r.json();
   if(d.version!=='fial5.11-commercial-fit-v1')throw Error('FIT_VERSION_MISMATCH');
   summary.replaceChildren();queue.replaceChildren();health.replaceChildren();
   item(summary,'Commercial qualification',d.state);
   item(summary,'Named opportunities',d.counts.named_programs);
   item(summary,'Sources currently retrieved',d.counts.source_docs_current||0);
   item(summary,'Directly qualified bids',d.counts.directly_qualified_bids);
   item(summary,'Verified awards / revenue','$0 / 0 contracts');
   item(summary,'Last evidence check',d.as_of_utc||'Not yet performed');
   item(summary,'Business credentials','No verified electrical PE, insurance or EVITP claims');
   for(const p of d.opportunities||[]){
    const box=document.createElement('article');box.className='item';
    const h=document.createElement('h3');h.textContent=p.issuer+' — '+p.program_id;
    box.append(h);
    item(box,'Work type',p.kind);
    item(box,'Project',p.name);
    item(box,'Published deadline',p.deadline_local);
    item(box,'Official source state',p.current_published_document_state);
    item(box,'Commercial-fit decision',p.readiness_state);
    item(box,'Potential role',p.fit);
    item(box,'ELEKTRON qualified to bid','NOT VERIFIED');
    item(box,'Technical requirements',p.technical_scope);
    item(box,'Requirements still to verify',p.eligibility_gates.join('; '));
    item(box,'Next step',p.follow_up);
    source(box,'Original government document',p.official_document);
    queue.append(box)
   }
   for(const s of d.sources||[]){
    const p=document.createElement('p');
    p.textContent=s.id+' · '+s.live_state+' · '+String(s.reason||'No source hold')+
     ' · SHA256 '+String(s.sha256||'none').slice(0,16);health.append(p)
   }
  }catch(e){summary.textContent='COMMERCIAL_FIT_HOLD: '+String(e?.message||e).slice(0,180)}
 })();
})();
