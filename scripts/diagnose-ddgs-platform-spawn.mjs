// FI_DDGS_SPAWN_DIAGNOSTIC_V1 — reproduces the controller's fixed DDGS launch
// without changing dashboard sources, REA, llama.cpp, compute, VPN or gateways.
// A healthy existing server is adopted; an unrelated listener is never replaced.
import {spawn} from "node:child_process";
import {createConnection} from "node:net";
import {existsSync,openSync,closeSync,mkdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import os from "node:os";
const BASE="http://127.0.0.1:4479";
const REQUIRED=["/health","/search/text","/search/images","/search/news","/search/videos","/search/books","/extract"];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function check(){
 const h=await fetch(BASE+"/health",{signal:AbortSignal.timeout(2200),redirect:"error"});
 if(!h.ok)throw Error("HEALTH_HTTP_"+h.status);
 const body=await h.json();
 if(body?.status!=="ok")throw Error("HEALTH_STATUS_INVALID");
 const r=await fetch(BASE+"/openapi.json",{signal:AbortSignal.timeout(2200),redirect:"error"});
 if(!r.ok)throw Error("SCHEMA_HTTP_"+r.status);
 const api=await r.json();
 if(!api.paths||REQUIRED.some(p=>!Object.hasOwn(api.paths,p)))throw Error("SCHEMA_ROUTES_INVALID");
 return true;
}
async function occupied(){
 return new Promise(resolve=>{
  const sock=createConnection({host:"127.0.0.1",port:4479});
  const finish=v=>{sock.removeAllListeners();sock.destroy();resolve(v)};
  sock.setTimeout(1500,()=>finish(true));
  sock.once("connect",()=>finish(true));
  sock.once("error",e=>finish(e.code!=="ECONNREFUSED"));
 });
}
if(process.platform!=="win32")throw Error("WINDOWS_ONLY");
const folder=join(os.homedir(),"FunIndustrial-WebResearch");
const exe=join(folder,".venv-search","Scripts","ddgs.exe");
if(!existsSync(exe))throw Error("DDGS_EXE_NOT_FOUND "+exe);
try{
 await check();console.log("FUN_WEB_SPAWN_DIAG=ALREADY_HEALTHY PORT=4479");process.exit(0);
}catch(e){console.log("FUN_WEB_SPAWN_EXISTING_CHECK="+String(e.message).slice(0,160))}
if(await occupied())throw Error("FUN_WEB_PORT_4479_OCCUPIED_UNVERIFIED_STOP");
const logs=join(process.env.LOCALAPPDATA||join(os.homedir(),"AppData","Local"),"FunIndustrial","WebDiagnostics");
mkdirSync(logs,{recursive:true});
const logfile=join(logs,"web-spawn-"+new Date().toISOString().replace(/[:.]/g,"-")+".log");
const fd=openSync(logfile,"a",0o600);
let child,spawnError=null,exitInfo="";
try{
 child=spawn(exe,["api","--host","127.0.0.1","--port","4479"],{
  cwd:folder,shell:false,windowsHide:true,detached:true,stdio:["ignore",fd,fd]
 });
 child.on("error",e=>{spawnError=e.message});
 child.on("exit",(code,signal)=>{exitInfo="EXIT_CODE="+code+" SIGNAL="+signal});
}finally{closeSync(fd)}
let okay=false,healthError="not checked";
for(let i=0;i<60;i++){
 await pause(500);
 try{await check();okay=true;break}
 catch(e){healthError=e.message}
 if(spawnError||exitInfo)break;
}
console.log("FUN_WEB_SPAWN_EXE="+exe);
console.log("FUN_WEB_SPAWN_PID="+String(child?.pid??"none"));
console.log("FUN_WEB_SPAWN_LOG="+logfile);
if(okay){
 console.log("FUN_WEB_SPAWN_DIAG=PASS PORT=4479 SERVICE=RUNNING");
 child?.unref();
}else{
 console.log("FUN_WEB_SPAWN_DIAG=HOLD SPAWN_ERROR="+String(spawnError||"none")+" "+exitInfo+" HEALTH_ERROR="+healthError);
 if(child?.pid){try{child.kill()}catch{}}
 try{console.log("FUN_WEB_SPAWN_LOG_TAIL="+readFileSync(logfile,"utf8").slice(-3000))}catch{}
 process.exitCode=1;
}
