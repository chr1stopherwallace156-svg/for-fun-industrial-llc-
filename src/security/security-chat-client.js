// FI_SECURITY_PRIMARY_CLIENT_V1 — additive chat-panel button for existing 8789.
// The operator confirms every audit. No model invocation or REA authority.
(()=>{
 "use strict";
 const eventName="FUN_ENGLISH_LOCAL_SECURITY_AUDIT_V2";
 function panel(){
  const input=document.getElementById("chat-input");
  return input?.closest(".panel")||null;
 }
 function init(){
  const parent=panel();
  if(!parent||document.getElementById("fi-security-primary-btn"))return;
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
  row.append(button,note);
  parent.append(row);
  function addResult(message){
   const history=document.getElementById("chat-history");
   if(!history){note.textContent=message.slice(0,280);return;}
   const block=document.createElement("div");
   block.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;margin-top:10px;background:#213448;border-radius:8px";
   const heading=document.createElement("strong");
   heading.textContent="Fun Industrial Security Audit";
   const pre=document.createElement("pre");
   pre.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto";
   pre.textContent=message.slice(0,14000);
   block.append(heading,pre);
   history.append(block);
   history.scrollTop=history.scrollHeight;
  }
  async function status(){
   const response=await fetch("/api/security/status",{method:"GET",cache:"no-store",redirect:"error"});
   const data=await response.json();
   if(!response.ok||data.state!=="ready"||data.mode!=="operator_approved_loopback_only")throw Error("SECURITY_TOOL_NOT_READY");
   button.disabled=false;
   note.textContent="On-demand. Loopback inspection and source review only.";
  }
  status().catch(e=>{button.disabled=true;note.textContent=String(e.message||e).slice(0,100)});
  button.addEventListener("click",async()=>{
   if(!window.confirm("Approve a bounded scan of this Windows computer's loopback services (including the primary dashboard), plus static review of Fun Industrial source files? No exploits, passwords, REA, repairs or external targets."))return;
   button.disabled=true;
   note.textContent="Performing approved local audit...";
   try{
    const response=await fetch("/api/ai/tool-call",{
     method:"POST",cache:"no-store",redirect:"error",
     headers:{"content-type":"application/json","x-fi-security-approval":"operator-reviewed"},
     body:JSON.stringify({name:"fi_security_local_audit",arguments:{}})
    });
    const data=await response.json();
    if(!response.ok)throw Error(String(data.error||"SECURITY_AUDIT_HOLD").slice(0,180));
    const report=data.result;
    if(report?.event!==eventName||report?.state!=="completed")throw Error("SECURITY_AUDIT_RESULT_INVALID");
    addResult(JSON.stringify(report,null,2));
    note.textContent="Last approved security audit completed. Review the findings in chat.";
   }catch(e){
    const msg="SECURITY_AUDIT_HOLD: "+String(e.message||e).slice(0,160);
    addResult(msg);
    note.textContent=msg;
   }finally{button.disabled=false;}
  });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();
