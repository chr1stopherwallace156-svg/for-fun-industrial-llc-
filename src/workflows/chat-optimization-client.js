/* FI_CHAT_OPTIMIZATION_CLIENT_V1 — explicit optimization requests in existing Fun Industrial chat.
   Intercepts only clear optimization commands; ordinary chat is untouched. Never auto-runs. */
(()=>{
"use strict";
const input=document.getElementById("chat-input");
const send=document.getElementById("chat-send");
const host=document.getElementById("chat-proposals");
if(!input||!send||!host)return;
const BASE="/api/ai/chat-optimization/";
let busy=false,proposal=null,workflowId=null;
const intent=s=>/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+|i\s+want\s+(?:to\s+|you\s+to\s+)|help\s+me\s+(?:to\s+)?)?(?:optimi[sz]e\b|run\s+(?:an?\s+)?optimi[sz]ation\b|find\s+(?:the\s+)?optimal\b)/i.test(s.trim());
function node(tag,value=""){const x=document.createElement(tag);if(value)x.textContent=value;return x;}
function btn(label,callback){
 const b=node("button",label);b.type="button";b.className="secondary";
 b.addEventListener("click",()=>{Promise.resolve().then(callback).catch(e=>notice("Operation held: "+String(e.message||e)));});
 return b;
}
function notice(message){
 const p=document.getElementById("fi-chat-opt-status");
 if(p)p.textContent=message;
}
async function post(route,payload,approve=false){
 const r=await fetch(BASE+route,{method:"POST",headers:{"content-type":"application/json",
  ...(approve?{"x-fi-optimization-approval":"operator-reviewed"}:{})},
  body:JSON.stringify(payload),credentials:"same-origin",cache:"no-store"});
 let j;try{j=await r.json();}catch{throw Error("Non-JSON local response");}
 if(!r.ok)throw Error(String(j.detail||j.error||r.status).slice(0,240));
 return j;
}
function renderOutput(data){
 const box=document.getElementById("fi-chat-opt-output");
 if(box)box.textContent=JSON.stringify(data,null,2);
}
function setBusy(value){busy=value;const p=document.getElementById("fi-chat-opt-panel");
 if(p)for(const b of p.querySelectorAll("button"))b.disabled=value;
}
function addActionRow(root,items){const row=node("div");row.className="actions";
 for(const item of items)row.appendChild(item);root.appendChild(row);}
function show(goal){
 if(busy)return;
 proposal=null;workflowId=null;
 const panel=node("section");panel.className="panel";panel.id="fi-chat-opt-panel";
 panel.style.marginTop="10px";
 panel.appendChild(node("h3","Optimization proposal (local, approval required)"));
 panel.appendChild(node("p","Your chat request was recognized as an optimization request. Provide verified numeric candidate problems. Qwen will select one; it cannot invent values or execute it without a separate approval."));
 const label=node("label","Goal from chat");label.htmlFor="fi-chat-opt-goal";panel.appendChild(label);
 const goalText=node("textarea");goalText.id="fi-chat-opt-goal";goalText.maxLength=500;goalText.value=goal.slice(0,500);panel.appendChild(goalText);
 const cLabel=node("label","Verified candidate JSON array (1-3 candidates)");cLabel.htmlFor="fi-chat-opt-candidates";panel.appendChild(cLabel);
 const candidates=node("textarea");candidates.id="fi-chat-opt-candidates";candidates.rows=7;
 candidates.placeholder='[{"action":"inventory","problem":{"demand_samples":[3,4,5],"min_stock":0,"max_stock":9,"holding_cost":1,"shortage_cost":3,"trials":16}}]';
 panel.appendChild(candidates);
 const status=node("p","No solver has been run.");status.id="fi-chat-opt-status";
 status.className="muted small";status.setAttribute("aria-live","polite");
 panel.appendChild(status);
 const output=node("pre","Waiting for a verified candidate proposal.");output.id="fi-chat-opt-output";panel.appendChild(output);
 const makeDraft=btn("Ask Qwen to select (no solver)",async()=>{
  if(busy)return;
  let list;
  try{list=JSON.parse(candidates.value);}catch{notice("Candidate array must be valid JSON; numeric inputs are never guessed.");return;}
  if(!Array.isArray(list)||list.length<1||list.length>3){notice("Provide 1 to 3 candidate objects.");return;}
  setBusy(true);notice("Requesting a bounded candidate selection from local llama.cpp...");
  try{
   const p=await post("draft",{goal:goalText.value.trim(),candidates:list});
   proposal=p;workflowId=null;
   renderOutput({action:p.action,problem:p.problem,sha256:p.sha256,proposal_id:p.proposal_id,
    model_reason_untrusted:p.model_reason_untrusted,model_usage:p.model_usage,
    state:p.state,solver_runs_in_draft:0});
   notice("Proposal saved. Check the action and every numeric parameter, then explicitly approve one solve.");
  }finally{setBusy(false);}
 });
 const inspect=btn("Inspect saved proposal",async()=>{
  if(busy||!proposal)return notice("Draft a proposal first.");
  setBusy(true);
  try{const p=await post("inspect",{id:proposal.proposal_id});renderOutput(p);
    notice(p.claimed?"This proposal has already been claimed for one run. Do not repeat.":"Proposal stored; no solver run claimed.");
  }finally{setBusy(false);}
 });
 const run=btn("Approve ONE local solver run",async()=>{
  if(busy||!proposal)return notice("Draft and inspect the proposal first.");
  const p=proposal;
  const message="Authorize one bounded "+p.action+" solver run using exactly the displayed JSON?\n"+
   "Proposal ID: "+p.proposal_id+"\nSHA256: "+p.sha256+"\n"+
   JSON.stringify(p.problem,null,2)+"\n\nNo REA or business actions will be executed.";
  if(!window.confirm(message))return;
  setBusy(true);notice("Submitting single-use operator approval; do not retry after an interruption.");
  try{
   // A claimed run is not replayable; a timeout requires manual checkpoint inspection.
   const result=await post("run",{id:p.proposal_id,sha256:p.sha256},true);
   workflowId=result.workflow_id||null;renderOutput(result);
   notice(result.state==="ready"?"Solver completed. Review the result separately.":"Solver held. Inspect the workflow; never blindly retry.");
  }finally{setBusy(false);}
 });
 const review=btn("Enter final review (no approval)",async()=>{
  if(busy||!proposal||!workflowId)return notice("No completed solver workflow in this panel.");
  setBusy(true);
  try{const result=await post("enter-review",{id:proposal.proposal_id,sha256:proposal.sha256,workflow_id:workflowId});
   renderOutput(result);notice("Review state: "+result.state+". Approve or reject only after examining the result.");
  }finally{setBusy(false);}
 });
 const approve=btn("Approve result ONLY",async()=>{
  if(busy||!proposal||!workflowId)return notice("No reviewable workflow.");
  if(!window.confirm("Acknowledge this solver result only? This does not change inventory, dispatch, spend money, or grant REA tools."))return;
  setBusy(true);
  try{const result=await post("decide",{id:proposal.proposal_id,sha256:proposal.sha256,workflow_id:workflowId,decision:"approve"},true);
   renderOutput(result);notice("Result review: "+result.state+". No external business action.");
  }finally{setBusy(false);}
 });
 const reject=btn("Reject result",async()=>{
  if(busy||!proposal||!workflowId)return notice("No reviewable workflow.");
  if(!window.confirm("Reject this recorded solver result?"))return;
  setBusy(true);
  try{const result=await post("decide",{id:proposal.proposal_id,sha256:proposal.sha256,workflow_id:workflowId,decision:"reject"},true);
   renderOutput(result);notice("Result review: "+result.state+". No external business action.");
  }finally{setBusy(false);}
 });
 addActionRow(panel,[makeDraft,inspect,run]);
 addActionRow(panel,[review,approve,reject]);
 host.replaceChildren(panel);
 input.value="";
}
send.addEventListener("click",e=>{
 const text=input.value.trim();
 if(text&&intent(text)){
  e.preventDefault();e.stopImmediatePropagation();show(text);
 }
},true);
input.addEventListener("keydown",e=>{
 if(e.key==="Enter"&&!e.shiftKey&&intent(input.value)){
  e.preventDefault();e.stopImmediatePropagation();show(input.value.trim());
 }
},true);
})();
