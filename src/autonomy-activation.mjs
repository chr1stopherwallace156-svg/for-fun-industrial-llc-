// FUN_INDUSTRIAL_AUTONOMY_ACTIVATOR_V1
// Local-only recovery for the fixed Autonomy V2 service. Never executes REA, Aider,
// arbitrary shell commands, or scripts chosen by an HTTP request.
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {existsSync} from "node:fs";
import path from "node:path";
const execFileAsync=promisify(execFile);
const HEALTH="http://127.0.0.1:8792/api/status";
async function liveHealth(){
 const res=await fetch(HEALTH,{signal:AbortSignal.timeout(3500),redirect:"error"});
 if(!res.ok)throw Error("AUTONOMY_HTTP_"+res.status);
 const body=await res.json();
 if(body?.state!=="running"||body?.application!=="Fun Industrial Autonomous Workers"||!Number.isSafeInteger(body.pid)||body.pid<1)
  throw Error("AUTONOMY_HEALTH_IDENTITY_MISMATCH");
 return {state:"running",pid:body.pid};
}
async function launchVerifiedScript(script){
 // The script path is determined exclusively by the trusted Windows installation,
 // never by a caller, query argument or model response.
 await execFileAsync("powershell.exe",
  ["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",script],
  {timeout:60000,windowsHide:true,maxBuffer:60000});
}
export function createAutonomyActivator({
 health=liveHealth,
 launch=launchVerifiedScript,
 fileExists=existsSync,
 os=process.platform,
 localAppData=process.env.LOCALAPPDATA
}={}){
 let pending=null;
 async function status(){
  try{
   const r=await health();
   if(r?.state!=="running"||!Number.isSafeInteger(r.pid)||r.pid<1)throw Error("AUTONOMY_HEALTH_INVALID");
   return {state:"running",pid:r.pid};
  }catch(e){return {state:"unavailable",detail:String(e?.message||"AUTONOMY_OFFLINE").slice(0,180)}}
 }
 async function recover(){
  const before=await status();
  if(before.state==="running")return {...before,action:"already_running"};
  if(os!=="win32")return {state:"unavailable",action:"not_supported",detail:"Windows activation required"};
  if(!localAppData)return {state:"unavailable",action:"not_configured",detail:"LOCALAPPDATA is not set"};
  const script=path.join(localAppData,"FunIndustrial","AutonomyLab","autonomy-v2-github","Start.ps1");
  if(!fileExists(script))return {state:"unavailable",action:"not_installed",detail:"Autonomy V2 Start.ps1 not found in the fixed installation"};
  try{await launch(script)}
  catch(e){
   const after=await status(); // recover safely if another authorized process started it.
   if(after.state==="running")return {...after,action:"already_running"};
   return {state:"unavailable",action:"start_failed",detail:String(e?.message||"START_FAILED").slice(0,180)};
  }
  const after=await status();
  return {...after,action:after.state==="running"?"started":"start_unverified"};
 }
 function activate(){
  if(!pending)pending=recover().finally(()=>{pending=null});
  return pending;
 }
 return {activate,status};
}
