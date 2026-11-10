/* FI_OPTIMIZATION_AGENT_CLIENT_V1: explicit local computation and single-use approved export. */
(()=>{
"use strict";
const root=document.getElementById("fi-opt-agent");if(!root)return;
const el=id=>document.getElementById("fi-opt-agent-"+id);
let ticket=null,busy=false;
function setBusy(value){busy=value;el("run").disabled=value;el("status-btn").disabled=value;el("save").disabled=value||!ticket;}
async function api(url,body=null){
 const opts={method:body===null?"GET":"POST",headers:{}};
 if(body!==null){
  opts.headers["content-type"]="application/json";
  opts.headers["x-fi-optimization-approval"]="operator-reviewed";
  opts.body=JSON.stringify(body);
 }
 const response=await fetch(url,opts);
 let data;try{data=await response.json()}catch{throw Error("Agent returned non-JSON data");}
 if(!response.ok)throw Error(String(data.error||data.detail||"Agent request rejected").slice(0,300));
 return data;
}
async function refresh(){
 try{
  const s=await api("/api/optimization/agent/status");
  el("status").textContent="Agent: "+s.state+" · automatic local solver selection · approved export only · REA disabled";
  if(s.state!=="ready"){el("run").disabled=true;ticket=null;el("save").disabled=true;}
 }catch(error){el("status").textContent="Agent unavailable: "+error.message;el("run").disabled=true;}
}
el("status-btn").addEventListener("click",refresh);
el("run").addEventListener("click",async()=>{
 if(busy)return;
 let problem=null;
 const raw=el("input").value.trim();
 if(raw){try{problem=JSON.parse(raw);if(!problem||typeof problem!=="object"||Array.isArray(problem))throw Error("JSON object required");}
  catch(error){el("result").textContent="Invalid verified input: "+error.message;return;}}
 const request=el("request").value.trim();
 if(!request){el("result").textContent="Describe what to optimize first.";return;}
 if(!window.confirm("Run ONE offline mathematical optimizer using the verified inputs shown? It will not make purchases, change business data, dispatch vehicles or execute REA."))return;
 ticket=null;setBusy(true);el("result").textContent="Selecting solver and executing bounded local computation…";
 try{
  const data=await api("/api/optimization/agent/analyze",{request,problem});
  if(data.state==="computed"&&data.approval_ticket){ticket=data.approval_ticket;}
  el("result").textContent=JSON.stringify(data,null,2);
 }catch(error){el("result").textContent="Optimization held: "+error.message;}
 finally{setBusy(false);}
});
el("save").addEventListener("click",async()=>{
 if(busy||!ticket)return;
 if(!window.confirm("Approve saving this particular computed optimization plan as a local JSON report? No external actions will execute."))return;
 const token=ticket;ticket=null;setBusy(true);
 try{
  const report=await api("/api/optimization/agent/approve",{action:"save-report",ticket:token});
  el("result").textContent+="\n\nApproved local action:\n"+JSON.stringify(report,null,2);
 }catch(error){el("result").textContent+="\n\nReport save held: "+error.message;}
 finally{setBusy(false);}
});
refresh();
})();