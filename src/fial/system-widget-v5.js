// FIAL 5 -- system-wide dashboard. Every module has transparent coverage.
(()=>{"use strict";
 const out=document.getElementById("fi-fial5-status"),
  button=document.getElementById("fi-fial5-check");
 if(!out||!button)return;
 function show(s){
  if(!s||!Array.isArray(s.modules)){
   out.textContent="FIAL: "+String(s?.state||"unavailable")+
    "\n"+String(s?.reason||s?.last_error||"No completed system cycle yet.");
   return;
  }
  out.textContent="Whole-system registry: "+String(s.module_count)+
   "\nLast completed: "+String(s.utc)+
   "\nIdentity-verified services: "+String(s.verified_modules)+
   "\nObserved but not fully attested: "+String(s.observed_unattested)+
   "\nRegistered capabilities without runtime instrumentation: "+String(s.uninstrumented)+
   "\nPending review/integration: "+String(s.pending)+
   "\nChanged evidence signals: "+String(s.change_events)+
   "\nExecution authority: unchanged — operator review required\n\n"+
   s.modules.map(m=>String(m.domain).toUpperCase()+" / "+String(m.id)+
    " — "+String(m.state)+"\n  Decision: "+String(m.decision)+
    (m.reason?"\n  Evidence: "+String(m.reason):"")).join("\n\n");
 }
 async function status(){
  const r=await fetch("/api/fial/system/status",{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  show(await r.json());
 }
 button.addEventListener("click",async()=>{
  button.disabled=true;out.textContent="Checking registered Fun Industrial modules…";
  try{
   const r=await fetch("/api/fial/system/run",{method:"POST",headers:{
    "content-type":"application/json","x-fi-fial-system":"operator-click"},body:"{}"});
   if(!r.ok)throw Error("HTTP "+r.status);
   const x=await r.json();
   if(x.state==="busy"||x.state==="hold"){show(x)}
   else await status();
  }catch(e){out.textContent="FIAL system cycle HOLD: "+String(e.message||e)}
  finally{button.disabled=false}
 });
 status().catch(()=>{out.textContent="FIAL system status not available.";});
})();
