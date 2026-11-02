import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
export function createComputeAdapter(config){
 let child=null;
 async function health(){
  if(!config.enabled)return {state:"disabled",detail:"Compute adapter disabled by configuration."};
  try{const r=await fetch("http://127.0.0.1:"+config.port+"/health",{signal:AbortSignal.timeout(1500)});if(!r.ok)return {state:"unavailable",detail:"Compute API HTTP "+r.status};const b=await r.json();return {state:"running",detail:"Graph: "+b.graph_engine+"; tensor: "+b.tensor_engine+"; neural: "+b.neural_engine+"; model trained: "+b.model_trained};}
  catch{return {state:"stopped",detail:"Compute API not responding on loopback."};}
 }
 return {id:"compute",name:"Graph / Tensor / Neural Compute",
  async start(){if(!config.enabled)return {state:"disabled",detail:"Set COMPUTE_ENABLED=true to activate compute."};const current=await health();if(current.state==="running")return current;if(!existsSync(config.python))return {state:"unavailable",detail:"Python environment not found: "+config.python};try{child=spawn(config.python,["-m","uvicorn","compute_service.app:app","--host","127.0.0.1","--port",String(config.port),"--no-access-log"],{cwd:config.cwd,shell:false,windowsHide:true,stdio:["ignore","ignore","pipe"]});child.stderr.on("data",()=>{});child.on("exit",()=>{child=null;});}catch(e){return {state:"failed",detail:e.message};}for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,500));const h=await health();if(h.state==="running")return h;}return {state:"starting",detail:"Compute service did not become healthy within 15 seconds."};},
  async stop(){if(child&&child.exitCode===null)child.kill();child=null;return {state:"stopped",detail:"Compute service process stopped."};},
  async health(){return health();}
 };
}
