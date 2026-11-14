// FIAL 5.1 unified module interface. One explicit operator approval per operation.
(()=>{
 "use strict";
 const byId=id=>document.getElementById(id);
 const overview=byId("fi51-overview"),modules=byId("fi51-modules"),
  moduleSelect=byId("fi51-module"),operationSelect=byId("fi51-operation"),
  input=byId("fi51-input"),consent=byId("fi51-consent"),
  result=byId("fi51-result"),run=byId("fi51-run"),check=byId("fi51-check");
 if(!overview||!modules||!run)return;
 let available={};
 const present=x=>JSON.stringify(x,null,2);
 function options(select,choices){
  select.replaceChildren();
  for(const value of choices){const o=document.createElement("option");
   o.value=value;o.textContent=value;select.appendChild(o)}
 }
 const examples={
  persistent_memory:{recall:{query:"Summarize a previously discussed project topic"}},
  optimization:{analyze:{request:"Optimize inventory",problem:{
   demand_samples:[3,4,6],min_stock:0,max_stock:12,holding_cost:1,shortage_cost:3,trials:24}},save_report:{ticket:""}},
  workflows:{create:{spec:{goal:"Review a small synthetic measurement",steps:[
   {id:"calc",kind:"stats",values:[1,2,3]},{id:"operator",kind:"review"}]}},
   get:{id:""},advance:{id:""},review:{id:"",decision:"approve"}},
  voice:{validate_saved_wav:{filename:""}},
  security:{audit_own_source:{}},
  engineering_inspection:{pe_preflight:{name:"inspect_pe_imports"},file_preflight:{}},
  ecommerce_operations:{cached_opportunities:{}},
  public_web:{fetch_static_text:{url:"https://example.org/"}}
 };
 function refreshInput(){const m=moduleSelect.value,o=operationSelect.value;
  input.value=present(examples[m]?.[o]||{});consent.checked=false;
 }
 function refreshOperation(){
  options(operationSelect,available[moduleSelect.value]||[]);
  refreshInput();
 }
 async function status(){
  const r=await fetch("/api/fial/modules/status",{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const data=await r.json();
  if(data.state!=="SYSTEM_WIDE_ADAPTERS_CONNECTED"){
   overview.textContent="Status: "+String(data.state)+
    "\n"+String(data.reason||data.last_error||"Initialization in progress");
   return;
  }
  overview.textContent="18-module core registry: "+data.register_count+
   "\nEight real adapters connected: "+data.real_adapters_connected+
   "\nConfigured adapters: "+data.real_adapters_configured+
   "\nCore identity-verified services: "+data.core_identity_verified+
   "\nUnavailable or unconfigured capabilities: "+data.missing_or_unconfigured+
   "\nNo automatic module operations, no new REA authority.";
  modules.textContent=data.modules.map(m=>String(m.id)+
   " ["+String(m.domain)+"] — "+String(m.state)+
   "\n  Integration: "+String(m.integration)+
   "\n  Next: "+String(m.decision)+
   (m.reason?"\n  Reason: "+String(m.reason):"")).join("\n\n");
  const a=data.configured_operations||{};
  if(Object.keys(a).length){
   const prev=moduleSelect.value;
   available=a;
   options(moduleSelect,Object.keys(a));
   if(Object.hasOwn(a,prev))moduleSelect.value=prev;
   refreshOperation();
  }
 }
 const headers={"content-type":"application/json","x-fi-fial-operator":"approved-exact-action"};
 check.addEventListener("click",async()=>{
  check.disabled=true;
  overview.textContent="Checking the FIAL core and eight real adapters…";
  try{
   const r=await fetch("/api/fial/modules/check",{method:"POST",
    headers,body:"{}"});
   if(!r.ok)throw Error("HTTP "+r.status);
   const data=await r.json();
   if(data.state==="hold")overview.textContent="CHECK HOLD: "+String(data.reason);
   else await status();
  }catch(e){overview.textContent="CHECK HOLD: "+String(e.message||e)}
  finally{check.disabled=false}
 });
 moduleSelect.addEventListener("change",refreshOperation);
 operationSelect.addEventListener("change",refreshInput);
 run.addEventListener("click",async()=>{
  if(!consent.checked){result.textContent="HOLD: confirm exact operation approval";return}
  let payload;
  try{payload=JSON.parse(input.value);if(!payload||typeof payload!=="object"||
   Array.isArray(payload))throw Error("JSON object required")}
  catch(e){result.textContent="INPUT HOLD: "+String(e.message||e);return}
  run.disabled=true;result.textContent="Running only this approved operation…";
  try{
   const r=await fetch("/api/fial/modules/operation",{method:"POST",headers,
    body:JSON.stringify({approved:true,module:moduleSelect.value,
     operation:operationSelect.value,input:payload})});
   const data=await r.json();
   const unsafeRepeat=["OUTCOME_UNKNOWN_DO_NOT_RETRY","HOLD_REVIEW_BEFORE_RETRY"].includes(data.state);
   result.textContent=(unsafeRepeat?"DO NOT REPEAT THIS OPERATION WITHOUT REVIEW\n":
    r.ok?"OPERATION RESULT\n":"OPERATION HOLD\n")+present(data);
  }catch(e){result.textContent="OPERATION HOLD: "+String(e.message||e)}
  finally{run.disabled=false;consent.checked=false}
 });
 status().catch(e=>{overview.textContent="FIAL status unavailable: "+String(e.message||e)});
})();
