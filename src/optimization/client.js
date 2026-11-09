/* FI_OPTIMIZATION_PHASE23_CLIENT_V1: existing private gateway, no automation. */
(()=>{
"use strict";
const root=document.getElementById("fi-optimization");if(!root)return;
const el=id=>document.getElementById("fi-opt-"+id);
const samples={
 inventory:{demand_samples:[3,4,3,6,7,4,5,8,5,4],min_stock:0,max_stock:12,holding_cost:1,shortage_cost:3,trials:48},
 allocation:{budget:20,labor_capacity:12,projects:[
  {id:"repair",cost:6,labor:4,value:15,max_units:2},
  {id:"inspection",cost:4,labor:2,value:8,max_units:3},
  {id:"upgrade",cost:10,labor:6,value:22,max_units:1}
 ]},
 route:{depot:0,cost_matrix:[[0,4,7,5],[4,0,2,9],[7,2,0,3],[5,9,3,0]]}
};
let busy=false,lastResult=null,draftText=null;
function setBusy(value){
 busy=value;
 for(const id of ["run","ai-draft","ai-explain","refresh"])el(id).disabled=busy;
 el("review-draft").disabled=busy||draftText===null;
}
async function api(path,{data=null,approval=false}={}){
 const options={method:data===null?"GET":"POST",headers:{}};
 if(data!==null){
  options.headers["content-type"]="application/json";
  if(approval)options.headers["x-fi-optimization-approval"]="operator-reviewed";
  options.body=JSON.stringify(data);
 }
 const response=await fetch(path,options);
 let body;
 try{body=await response.json()}catch{throw Error("Invalid local service response")}
 if(!response.ok)throw Error(String(body.error||body.detail||"Operation rejected").slice(0,300));
 return body;
}
function selected(){return el("action").value;}
function clearDraft(){
 draftText=null;el("review-draft").disabled=true;el("ai-result").textContent="No AI suggestion yet.";
}
el("action").addEventListener("change",()=>{
 el("problem").value=JSON.stringify(samples[selected()],null,2);
 lastResult=null;el("result").textContent="No optimizer run yet.";clearDraft();
});
el("problem").value=JSON.stringify(samples[selected()],null,2);
async function refresh(){
 try{
  const status=await api("/api/optimization/status");
  el("status").textContent="Optimizer: "+status.state+" · Optuna + Google OR-Tools · approval required · REA 0 tools";
  el("run").disabled=status.state!=="ready";
 }catch(error){el("status").textContent="Optimizer status unavailable: "+error.message;el("run").disabled=true;}
}
el("refresh").addEventListener("click",refresh);
el("run").addEventListener("click",async()=>{
 if(busy)return;
 let problem;try{problem=JSON.parse(el("problem").value);if(!problem||typeof problem!=="object"||Array.isArray(problem))throw Error("Expected JSON object");}
 catch(error){el("result").textContent="Invalid optimization JSON: "+error.message;return;}
 const action=selected();
 if(!window.confirm("Approve ONE local "+action+" optimization run using the JSON shown? This computes recommendations only and takes no business actions."))return;
 setBusy(true);el("result").textContent="Running bounded local solver…";
 try{
  const result=await api("/api/optimization/run",{data:{action,problem},approval:true});
  lastResult=result;el("result").textContent=JSON.stringify(result,null,2);
 }catch(error){lastResult=null;el("result").textContent="Optimization held: "+error.message;}
 finally{setBusy(false);}
});
function relevantTemplate(action){
 if(action==="inventory")return "JSON fields: demand_samples (list of 2–300 integers), min_stock, max_stock, holding_cost, shortage_cost and trials (4–128).";
 if(action==="allocation")return "JSON fields: budget and labor_capacity (integers); projects is 1–30 objects each with id, cost, labor, value, max_units (numeric fields integers).";
 return "JSON fields: depot (zero-based integer) and cost_matrix (2–12 by 2–12 square matrix of nonnegative integer costs, diagonal zero).";
}
async function askAI(userText,maxTokens=650){
 const result=await api("/api/ai/chat",{data:{
  messages:[{role:"user",content:userText.slice(0,9000)}],
  tools:[],max_tokens:maxTokens,temperature:0.2
 }});
 if(result.tool_calls&&result.tool_calls.length)throw Error("AI returned tool calls; no actions permitted here");
 if(typeof result.reply!=="string"||!result.reply.trim())throw Error("Local AI returned no text");
 return result.reply.slice(0,12000);
}
el("ai-draft").addEventListener("click",async()=>{
 if(busy)return;
 const request=el("request").value.trim();
 if(!request){el("ai-result").textContent="Describe the problem and constraints first.";return;}
 const action=selected();
 setBusy(true);clearDraft();el("ai-result").textContent="Asking local llama.cpp AI (advisory only)…";
 try{
  const prompt=[
   "You are a local decision-support planning assistant. You are NOT authorized to run tools or optimizers.",
   "Draft one JSON object for the specified optimization schema based only on information supplied by the operator.",
   "Do not invent budgets, labor, costs, demand or travel times. If essential numeric inputs are missing,",
   "explain exactly what is missing instead of manufacturing sample numbers.",
   "Return only a JSON object with the problem fields if enough numbers are provided; otherwise plain-language questions.",
   "Optimization type: "+action+". "+relevantTemplate(action),
   "Operator request: "+request
  ].join("\n");
  const answer=await askAI(prompt);
  draftText=answer;
  el("ai-result").textContent=answer+"\n\nAI suggestions are not authoritative. Check all quantities before use.";
 }catch(error){el("ai-result").textContent="AI drafting unavailable: "+error.message;}
 finally{setBusy(false);}
});
el("review-draft").addEventListener("click",()=>{
 if(!draftText)return;
 let json;try{
  const clean=draftText.trim().replace(/^\x60{3}(?:json)?\s*/i,"").replace(/\s*\x60{3}$/,"");
  json=JSON.parse(clean);
  if(!json||typeof json!=="object"||Array.isArray(json))throw Error("Expected an object");
 }catch{el("ai-result").textContent="AI did not return strict JSON. Review the explanation instead. No solver was run.\n\n"+draftText;return;}
 if(!window.confirm("Copy UNTRUSTED AI draft into the editor for manual review? It will NOT run the solver."))return;
 el("problem").value=JSON.stringify(json,null,2);
 el("ai-result").textContent="Draft copied into editor. Verify every number; separately approve the solver to run.";
 draftText=null;el("review-draft").disabled=true;
});
el("ai-explain").addEventListener("click",async()=>{
 if(!lastResult){el("ai-result").textContent="Run an approved solver job first.";return;}
 if(busy)return;
 setBusy(true);el("ai-result").textContent="Asking local llama.cpp to explain existing solver output…";
 try{
  const resultText=JSON.stringify(lastResult).slice(0,9000);
  const prompt="Explain this bounded optimization result in plain English. "+
   "Do not invent benefits or claim decisions were executed. Mention objective limits, assumptions, "+
   "uncertainty and whether mathematical optimality was proven. No tools or solver runs. "+
   "Untrusted solver response:\n"+resultText;
  el("ai-result").textContent=await askAI(prompt,450);
 }catch(error){el("ai-result").textContent="AI explanation unavailable: "+error.message;}
 finally{setBusy(false);}
});
refresh();
})();