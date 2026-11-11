// FI_SECURITY_PRIMARY_CLIENT_V2 — additive security audit in the existing 8789 UI.
// Original English implementation. No remote targets, model/tool autonomy or REA.
// The deployed dashboard may not have the old sample #chat-input ID.
(()=>{
 "use strict";
 const expectedEvent="FUN_ENGLISH_LOCAL_SECURITY_AUDIT_V2";
 function panel(){
  for(const id of ["chat-input","chat-send","chat-history","fi-voice-conversation"]){
   const item=document.getElementById(id);
   if(item)return item.closest(".panel")||item.closest("section")||item.parentElement;
  }
  for(const heading of document.querySelectorAll("h2,h3,[role='heading']")){
   const label=(heading.textContent||"").replace(/\s+/g," ").trim();
   if(/(?:local|fun industrial).*(?:ai|chat|conversation)|(?:ai|chat).*conversation/i.test(label)){
    const holder=heading.closest(".panel")||heading.closest("section");
    if(holder&&holder.querySelector("textarea,input,[contenteditable='true']"))return holder;
   }
  }
  // Fallback is an existing, verified installed voice panel. Never fabricate
  // an unrelated dashboard or silently skip the entire UI integration.
  const voice=document.getElementById("fi-voice-mobile");
  return voice?.closest(".panel")||voice?.closest("section")||voice||null;
 }
 function init(){
  if(document.getElementById("fi-security-primary-btn"))return;
  const parent=panel();
  if(!parent)return;
  const section=document.createElement("section");
  section.id="fi-security-primary";
  section.style.cssText="margin-top:16px;padding:12px;border:1px solid #52677b;border-radius:9px";
  const title=document.createElement("h3");
  title.textContent="Fun Industrial Security — local AI tools";
  const explanation=document.createElement("p");
  explanation.textContent="English-only defensive audit; requires separate operator approval. No external network scanning, exploits, passwords, or REA execution.";
  explanation.style.cssText="font-size:12px;opacity:.8";
  const row=document.createElement("div");
  row.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:10px";
  const button=document.createElement("button");
  button.id="fi-security-primary-btn";
  button.type="button";
  button.textContent="Approve local security audit";
  button.disabled=true;
  const note=document.createElement("span");
  note.style.cssText="font-size:12px;opacity:.8";
  note.setAttribute("aria-live","polite");
  note.textContent="Checking local security tool...";
  const results=document.createElement("pre");
  results.id="fi-security-primary-results";
  results.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto;display:none;margin-top:12px";
  row.append(button,note);
  section.append(title,explanation,row,results);
  parent.append(section);
  function addResult(message){
   const text=String(message||"").slice(0,16000);
   results.style.display="block";
   results.textContent=text;
   // Only mirror the result into a known existing chat history if one is
   // present; otherwise the result always remains visible in this panel.
   const history=document.getElementById("chat-history");
   if(history&&history!==parent&&history.isConnected){
    const block=document.createElement("div");
    block.style.cssText="padding:10px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere";
    block.textContent="Fun Industrial Security Audit:\n"+text;
    history.append(block);
    history.scrollTop=history.scrollHeight;
   }
  }
  async function status(){
   const response=await fetch("/api/security/status",{
    method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error"
   });
   const data=await response.json();
   if(!response.ok||data.state!=="ready"||data.mode!=="operator_approved_loopback_only"||data.port!==8789)
    throw Error("SECURITY_PRIMARY_8789_NOT_READY");
   button.disabled=false;
   note.textContent="On demand; localhost ports and bounded code review only.";
  }
  status().catch(error=>{button.disabled=true;note.textContent=String(error.message||error).slice(0,100)});
  button.addEventListener("click",async()=>{
   if(!window.confirm("Approve a bounded local-only scan of the Fun Industrial Windows host, including the primary dashboard, and a static source review? No external targets, exploits, credentials, REA, or repairs."))return;
   button.disabled=true;
   note.textContent="Running approved local audit...";
   try{
    const response=await fetch("/api/ai/tool-call",{
     method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
     headers:{"content-type":"application/json","x-fi-security-approval":"operator-reviewed"},
     body:JSON.stringify({name:"fi_security_local_audit",arguments:{}})
    });
    const data=await response.json();
    if(!response.ok)throw Error(String(data.error||"SECURITY_AUDIT_HOLD").slice(0,180));
    const report=data.result;
    if(report?.event!==expectedEvent||report?.state!=="completed")throw Error("SECURITY_AUDIT_RESULT_INVALID");
    addResult(JSON.stringify(report,null,2));
    note.textContent="Security audit completed. Review indicators; these are not confirmed vulnerabilities.";
   }catch(error){
    const message="SECURITY_AUDIT_HOLD: "+String(error.message||error).slice(0,180);
    addResult(message);
    note.textContent=message;
   }finally{button.disabled=false;}
  });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();
