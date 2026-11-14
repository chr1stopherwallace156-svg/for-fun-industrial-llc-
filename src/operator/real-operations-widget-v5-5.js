// FIAL5.5 real work panel in the EXISTING 8802 operations console.
// No personal contact details transmitted to the browser.
(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const region=byId('fi-real-work');
 if(!region)return;
 const text=(parent,label,value)=>{
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=label+': ';p.append(b,document.createTextNode(String(value??'Unknown')));parent.append(p)
 };
 const render=async()=>{
  region.replaceChildren();
  const p=document.createElement('p');p.textContent='Checking real local actions and official-source monitor…';region.append(p);
  try{
   const res=await fetch('/api/operator/real/status',{method:'GET',cache:'no-store'});
   if(!res.ok)throw Error('HTTP '+res.status);
   const r=await res.json();
   if(r.version!=='fial5.5-real-business-operations-v1')throw Error('UNVERIFIED_REAL_STATUS');
   region.replaceChildren();
   if(r.state==='NOT_ACTIVATED'){text(region,'Status','No FIAL5.5 cycle completed yet');return}
   text(region,'Software','Fun Industrial — software workspace');
   text(region,'Supported business','ELEKTRON INDUSTRIAL LLC');
   text(region,'Business identity','Operator provided; official verification pending');
   text(region,'Last actual local cycle',r.when_utc||'unknown');
   text(region,'New local evidence packets',Number(r.new_local_artifacts||0));
   text(region,'Official pages fetched or checked',Number(r.official_sources?.fetched||0));
   text(region,'Official source changes detected',Number(r.official_sources?.changed||0));
   text(region,'Official-source access holds',Number(r.official_sources?.errors||0));
   text(region,'Approved local configuration inspection',r.config_source?.status||'not configured');
   text(region,'Government submissions',r.government_filings===0?'NONE':'UNVERIFIED');
   text(region,'External email sends',r.emails_sent===0?'NONE':'UNVERIFIED');
   const heading=document.createElement('h3');heading.textContent='Prepared work packets';region.append(heading);
   for(const packet of (Array.isArray(r.artifacts)?r.artifacts:[]).slice(0,12)){
    const li=document.createElement('p');
    li.textContent=String(packet.id||'Unidentified')+' · '+String(packet.state||'not verified')+' · sha256 '+String(packet.sha256||'not checked').slice(0,16);
    region.append(li)
   }
  }catch(e){region.replaceChildren();text(region,'Real operations status','HOLD: '+String(e.message||e).slice(0,160))}
 };
 void render();
})();
