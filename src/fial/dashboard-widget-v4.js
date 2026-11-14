// Read-only FIAL 4 panel: textContent only. Never treats grant text as HTML.
(async()=>{
 const target=document.getElementById("fi-fial4-summary");
 if(!target)return;
 try{
  const result=await fetch("/api/fial/v4/status",{method:"GET",cache:"no-store"});
  if(!result.ok)throw Error("Status endpoint unavailable");
  const s=await result.json();
  if(s.state!=="local_review_complete"){
   target.textContent="FIAL 4: "+(s.state||"hold")+
    ". Run the separate approved local audit; no external action is started here.";
   return;
  }
  target.textContent="Saved snapshot review only; current official grant pages NOT rechecked.\n"+
   "Company eligibility UNKNOWN; proven semantic entailments: 0.\n"+
   s.cases.map(x=>String(x.grant_id)+" — "+String(x.outcome)+
    " (held "+String(x.claims_held)+")").join("\n");
 }catch{
  target.textContent="FIAL 4 status unavailable. Existing services are unaffected.";
 }
})();
