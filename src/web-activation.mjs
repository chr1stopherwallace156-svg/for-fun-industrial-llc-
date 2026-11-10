// FI_WEB_ACTIVATION_V1 — fixed local DDGS service for Platform Control.
// The only permitted launch is the known venv executable on loopback:4479.
// Never starts a model, REA tool, arbitrary shell or user-supplied command.
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE="http://127.0.0.1:4479";
const REQUIRED=["/health","/search/text","/search/images","/search/news","/search/videos","/search/books","/extract"];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function readJson(url,fetchImpl,timeout=3000){
 const response=await fetchImpl(url,{signal:AbortSignal.timeout(timeout),redirect:"error"});
 if(!response.ok)throw Error("WEB_HTTP_"+response.status);
 return response.json();
}
export function createWebResearchActivator({
 fetchImpl=fetch,spawnProcess=spawn,
 exists=existsSync,osName=process.platform,
 userHome=os.homedir(),delay=wait
}={}){
 const folder=path.join(userHome,"FunIndustrial-WebResearch");
 const executable=path.join(folder,".venv-search","Scripts","ddgs.exe");
 let inFlight=null,ownedChild=null;
 async function check(){
  const health=await readJson(BASE+"/health",fetchImpl);
  if(!health||health.status!=="healthy"||health.service!=="DDGS API"||typeof health.version!=="string")throw Error("WEB_HEALTH_IDENTITY_HOLD");
  const api=await readJson(BASE+"/openapi.json",fetchImpl);
  if(!api?.paths||REQUIRED.some(route=>!Object.hasOwn(api.paths,route)))
   throw Error("WEB_API_IDENTITY_HOLD");
  return {state:"running",detail:"DDGS web research ready on 127.0.0.1:4479",endpoint:BASE,mode:"local_first"};
 }
 async function status(){
  try{return await check();}
  catch(error){return {state:"stopped",detail:String(error.message||error).slice(0,180),endpoint:BASE};}
 }
 async function recover(){
  try{return {...await check(),action:"already_running"};}catch{}
  if(osName!=="win32")return {state:"unavailable",action:"unsupported",detail:"Windows DDGS installation required"};
  if(!exists(executable))return {state:"unavailable",action:"missing",detail:"Existing DDGS venv executable is missing"};
  // A different service or an unverified DDGS response must never be displaced.
  try{
   const response=await fetchImpl(BASE+"/openapi.json",{signal:AbortSignal.timeout(2500),redirect:"error"});
   if(response.status>0)return {state:"unavailable",action:"identity_hold",detail:"Port 4479 responded but DDGS identity verification failed"};
  }catch{}
  let child;
  try{
   child=spawnProcess(executable,["api","--host","127.0.0.1","--port","4479"],{
    cwd:folder,shell:false,windowsHide:true,detached:true,
    stdio:["ignore","ignore","ignore"]
   });
   ownedChild=child;
   child.on("error",()=>{if(ownedChild===child)ownedChild=null;});
   child.unref();
  }catch(error){return {state:"unavailable",action:"launch_failed",detail:String(error.message).slice(0,180)};}
  for(let i=0;i<40;i++){
   if(child.exitCode!==null||child.signalCode!==null)break;
   await delay(500);
   try{return {...await check(),action:"started"};}catch{}
  }
  return {state:"unavailable",action:"start_unverified",detail:"DDGS did not pass health and API identity checks; no other services were changed"};
 }
 function activate(){
  if(!inFlight)inFlight=recover().finally(()=>{inFlight=null});
  return inFlight;
 }
 async function stop(){
  if(!ownedChild)return {state:"not-managed",detail:"Pre-existing DDGS service preserved"};
  const child=ownedChild;
  ownedChild=null;
  if(child.exitCode!==null||child.signalCode!==null)return {state:"stopped",detail:"Managed DDGS child already exited"};
  try{child.kill();return {state:"stopping",detail:"Controller-owned DDGS child was signaled; unrelated services preserved"};}
  catch(error){return {state:"unavailable",detail:String(error.message).slice(0,180)};}
 }
 return {activate,status,stop};
}
