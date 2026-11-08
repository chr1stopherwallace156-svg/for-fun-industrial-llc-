// Fixed interpreter path and fixed Python helper; no shell or operator-supplied paths.
import {spawn} from "node:child_process";
import {existsSync,readFileSync} from "node:fs";
import {readdir,stat} from "node:fs/promises";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const dataRoot=join(process.env.LOCALAPPDATA||join(root,".runtime"),"FunIndustrial","CognitiveMemory");
const py=join(dataRoot,"venv","Scripts","python.exe");
const bridge=join(root,"cognee","memory_bridge.py");
// Status MUST stay constant-time: synchronous traversal of the Python venv
// (>1 GB, many thousands of files) previously blocked the 8789 event loop
// and caused INTELLIGENCE_STATUS_NOT_READY after the integration restart.
async function bytesUsedAsync(folder,depth=0){
 if(depth>28)return 0;
 let entries;
 try{entries=await readdir(folder,{withFileTypes:true})}
 catch(e){if(e.code==="ENOENT")return 0;throw e}
 let sum=0;
 for(const entry of entries){
  if(entry.isSymbolicLink())continue;
  const name=join(folder,entry.name);
  if(entry.isFile())sum+=(await stat(name)).size;
  else if(entry.isDirectory())sum+=await bytesUsedAsync(name,depth+1);
 }
 return sum;
}
export function parseMemorySettings(raw){
 const v=JSON.parse(String(raw).replace(/^\uFEFF/,""));
 if(!v||typeof v!=="object"||Array.isArray(v))throw Error("MEMORY_SETTINGS_OBJECT_REQUIRED");
 return v;
}
function localSettings(){
 try{
  const source=readFileSync(join(root,"src","intelligence","settings.json"),"utf8");
  return parseMemorySettings(source);
 }catch{return {}}
}
export async function memoryStorageUsage(){
 const [storageBytes,modelCacheBytes,pythonEnvironmentBytes]=await Promise.all([
  bytesUsedAsync(join(dataRoot,"storage")),
  bytesUsedAsync(join(dataRoot,"cache")),
  bytesUsedAsync(join(dataRoot,"venv"))
 ]);
 return {engine:"cognee",storagePath:dataRoot,storageBytes,
  modelCacheBytes,pythonEnvironmentBytes,
  totalBytes:storageBytes+modelCacheBytes+pythonEnvironmentBytes,
  measurement:"operator_requested_only"};
}
export function memoryStatus(){
 const available=existsSync(py)&&existsSync(bridge),settings=localSettings();
 return {engine:"cognee",versionRequested:"1.6.7",runtime:"python_venv",
  available,enabled:(process.env.FI_COGNEE_ENABLED==="true"||settings.enabled===true)&&available,
  writesEnabled:(process.env.FI_COGNEE_WRITES_ENABLED==="true"||settings.writesEnabled===true)&&available,
  storagePath:dataRoot,
  storageBytes:null,modelCacheBytes:null,pythonEnvironmentBytes:null,
  storageMeasurement:"deferred_use_api_intelligence_storage",
  modelDownloadsOnFirstUse:true,cloudLLMConfigured:false,automaticIngestion:false};
}
export async function memoryAction(action,payload){
 const state=memoryStatus();
 if(!state.enabled)throw Error("COGNEE_NOT_ENABLED");
 if(!["remember","recall"].includes(action))throw Error("COGNEE_OPERATION_NOT_ALLOWED");
 if(action==="remember"&&!state.writesEnabled)throw Error("COGNEE_WRITES_DISABLED");
 const key=action==="remember"?"text":"query";
 const value=payload?.[key];
 if(!payload||Object.keys(payload).some(k=>k!==key)||typeof value!=="string"||!value.trim()||value.length>(action==="remember"?4000:500))
  throw Error("COGNEE_INPUT_INVALID");
 const windows=process.platform==="win32";
 if(!windows)throw Error("COGNEE_WINDOWS_INSTALL_REQUIRED");
 const baseEnv={SystemRoot:process.env.SystemRoot,windir:process.env.windir,
  PATH:process.env.PATH,Path:process.env.Path,TEMP:process.env.TEMP,
  TMP:process.env.TMP,APPDATA:process.env.APPDATA,LOCALAPPDATA:process.env.LOCALAPPDATA,
  USERPROFILE:process.env.USERPROFILE,
  DATA_ROOT_DIRECTORY:join(dataRoot,"storage","data"),
  SYSTEM_ROOT_DIRECTORY:join(dataRoot,"storage","system"),
  CACHE_ROOT_DIRECTORY:join(dataRoot,"cache"),
  HF_HOME:join(dataRoot,"cache","huggingface"),
  FASTEMBED_CACHE_PATH:join(dataRoot,"cache","fastembed")};
 const env=Object.fromEntries(Object.entries(baseEnv).filter(([,v])=>typeof v==="string"&&v));
 return await new Promise((done,reject)=>{
  const child=spawn(py,["-I",bridge],{cwd:dataRoot,env,windowsHide:true,stdio:["pipe","pipe","pipe"]});
  let out="",err="",settled=false;
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else done(result)};
  const timer=setTimeout(()=>{child.kill();finish(Error("COGNEE_TIMEOUT_NO_AUTOMATIC_RETRY"))},240000);
  child.stdout.on("data",b=>{out+=(b.toString()).slice(0,24000);if(out.length>30000){child.kill();finish(Error("COGNEE_OUTPUT_TOO_LARGE"))}});
  child.stderr.on("data",b=>{err+=(b.toString()).slice(0,3000)});
  child.on("error",e=>finish(Error("COGNEE_PROCESS_UNAVAILABLE:"+e.message)));
  child.on("close",code=>{
   const line=out.split(/\r?\n/).filter(x=>x.startsWith("FI_MEMORY_RESULT=")).at(-1);
   if(!line)return finish(Error("COGNEE_FAILED:"+String(code)+":"+err.slice(0,200)));
   try{const data=JSON.parse(line.slice("FI_MEMORY_RESULT=".length));
    if(code!==0||data.ok===false)finish(Error("COGNEE_OPERATION_FAILED:"+String(data.error||code).slice(0,200)));
    else finish({engine:"cognee",action,...data});
   }catch(e){finish(Error("COGNEE_RESULT_INVALID"))}
  });
  child.stdin.end(JSON.stringify({action,[key]:value}));
 });
}
