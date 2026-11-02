import {spawn} from "node:child_process";
import {openSync,closeSync} from "node:fs";
import {mkdir,open,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const runtime=path.join(root,".runtime","supervisor"),logs=path.join(root,"reports");
await mkdir(runtime,{recursive:true});await mkdir(logs,{recursive:true});
const children=new Map(),restarts=[];
const targets=[{name:"dashboard",script:path.join(root,"src","server.mjs")},{name:"https-gateway",script:path.join(root,"src","gateway.mjs")}];
let stopping=false;
async function manifest(state){
 const data={application:"Fun Industrial",supervisor_pid:process.pid,state,updated_at:new Date().toISOString(),children:[...children.values()].map(x=>({name:x.name,pid:x.child.pid,script:x.script,state:x.child.exitCode===null?"running":"exited"}))};
 const tmp=path.join(runtime,"processes.json.tmp");await writeFile(tmp,JSON.stringify(data,null,2));const h=await open(tmp,"r");await h.sync();await h.close();await writeFile(path.join(runtime,"processes.json"),JSON.stringify(data,null,2));
}
function start(target){
 const out=path.join(logs,target.name+".out.log"),err=path.join(logs,target.name+".err.log");
 const outFd=openSync(out,"a"),errFd=openSync(err,"a");
 const child=spawn(process.execPath,[target.script],{cwd:root,windowsHide:true,stdio:["ignore",outFd,errFd]});
 const entry={...target,child,outFd,errFd};children.set(target.name,entry);
 child.on("exit",async(code,signal)=>{closeSync(outFd);closeSync(errFd);if(children.get(target.name)?.child===child)children.delete(target.name);await manifest(stopping?"stopping":"child-exited");});
 return entry;
}
for(const t of targets)start(t);
async function activateDashboard(){
 for(let attempt=0;attempt<30;attempt++){
  try{
   const response=await fetch("http://127.0.0.1:8787/api/start",{method:"POST",headers:{"content-type":"application/json"},body:"{}",signal:AbortSignal.timeout(5000)});
   if(response.ok){const body=await response.text();await writeFile(path.join(logs,"supervisor-activation.json"),body);return;}
  }catch{}
  await new Promise(r=>setTimeout(r,1000));
 }
 throw new Error("Dashboard did not become ready within 30 seconds; see dashboard logs.");
}
await manifest("starting");
try{await activateDashboard();await manifest("running");}
catch(error){await writeFile(path.join(logs,"supervisor-startup-error.log"),String(error.stack||error));for(const e of children.values())try{e.child.kill();}catch{};process.exit(1);}

const shutdown=async()=>{if(stopping)return;stopping=true;await manifest("stopping");for(const e of children.values())try{e.child.kill();}catch{};setTimeout(()=>process.exit(0),1500).unref();};
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
while(!stopping){
 await new Promise(r=>setTimeout(r,2000));
 const now=Date.now();while(restarts.length&&now-restarts[0]>600000)restarts.shift();
 for(const t of targets){
  if(children.has(t.name))continue;
  if(restarts.length>=3){await manifest("restart-budget-exhausted");await shutdown();process.exitCode=1;process.exit(); }
  restarts.push(now);start(t);if(t.name==="dashboard"){try{await activateDashboard();}catch(error){await writeFile(path.join(logs,"supervisor-startup-error.log"),String(error.stack||error));await shutdown();process.exitCode=1;process.exit();}}await manifest("restarted");
 }
}
