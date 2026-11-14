// Active FIAL4 official-source view: fetches status and initiates a bounded official refresh.
(()=>{"use strict";
 const output=document.getElementById("fi-fial4-live-output");
 const button=document.getElementById("fi-fial4-live-refresh");
 if(!output||!button)return;
 function line(c){
  const fields=c.published||{};
  const changed=(c.changed_fields||[]).join(", ")||"No differences since prior live check";
  const original=(c.baseline_differences||[]).join(", ")||"None recorded";
  return String(c.grant_id)+" — "+String(c.state)+
   "\n"+String(c.title||"")+
   "\nPublished status: "+String(fields.Status||"unavailable")+
   "\nDeadline: "+String(fields.ApplicationDeadline||"unavailable")+
   "\nApplicant types: "+String(fields.ApplicantType||"unavailable")+
   "\nFunding amounts: "+String(fields.EstAmounts||"unavailable")+
   "\nChanged since last live check: "+changed+
   "\nChanged versus saved FIAL2 evidence: "+original+
   "\nOfficial details: "+String(c.official_page||"unavailable");
 }
 function display(s){
  if(s.state==="not_run"){
   output.textContent="First live official verification will run at startup. Use Verify official source now to retry.";
   return;
  }
  if(s.state==="hold"||s.state==="busy"){
   output.textContent="FIAL 4 live verification: "+String(s.state)+
    "\nReason: "+String(s.reason||s.last_error||"another check is in progress")+
    "\nCompany eligibility remains UNKNOWN.";
   return;
  }
  output.textContent="Verification: "+String(s.state)+
   "\nFeed freshness: "+String(s.freshness||"unknown")+
   "\nOfficial source last fetched: "+String(s.verified_at_utc||"not recorded")+
   "\nPublished records: "+String(s.rows||0)+
   "\nSelected records matched: "+String(s.matches||0)+
   "\nCompany eligibility: UNKNOWN; published records are not full program rules.\n\n"+
   (Array.isArray(s.cases)?s.cases.map(line).join("\n\n"):"No cases");
 }
 async function status(){
  const r=await fetch("/api/fial/live/status",{cache:"no-store"});
  if(!r.ok)throw Error("Status HTTP "+r.status);
  display(await r.json());
 }
 button.addEventListener("click",async()=>{
  button.disabled=true;output.textContent="Contacting official California government dataset…";
  try{
   const r=await fetch("/api/fial/live/refresh",{method:"POST",headers:{
    "content-type":"application/json","x-fi-fial":"operator-click"},body:"{}"});
   if(!r.ok)throw Error("Refresh HTTP "+r.status);
   display(await r.json());
  }catch(e){output.textContent="Verification HOLD: "+String(e.message||e)}
  finally{button.disabled=false}
 });
 status().catch(()=>{output.textContent="Live grant status unavailable; existing services remain unchanged."});
})();
