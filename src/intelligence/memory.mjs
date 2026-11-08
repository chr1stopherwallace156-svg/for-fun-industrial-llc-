// Fixed interpreter path and fixed Python helper; no shell or operator-supplied paths.
import {spawn} from "node:child_process";
import {existsSync,statSync,readdirSync,readFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const dataRoot=join(process.env.LOCALAPPDATA||join(root,".runtime"),"FunIndustrial","CognitiveMemory");
const py=join(dataRoot,"venv","Scripts","python.exe");
const bridge=join(root,"cognee","memory_bridge.py");
function bytesUsed(folder,depth=0){
 if(depth>8||!existsSync(folder))return 0;
 try{return readdirSync(folder,{withFileTypes:true}).reduce((sum,item)=>{
  const name=join(folder,item.name);
  if(item.isSymbolicLink())return sum;
  if(item.isFile())return sum+statSync(name).size;
  if(item.isDirectory())return sum+bytesUsed(name,depth+1);
  return sum;
 },0)}catch{return 0}
}
function localSettings(){try{const v=JSON.parse(readFileSync(join(root,"src","intelligence","settings.json"),"utf8"));return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}catch{return {}}}
export function memoryStatus(){
 const available=existsSync(py)&&existsSync(bridge),settings=localSettings();
 return {engine:"cognee",versionRequested:"1.6.7",runtime:"python_venv",
  available,enabled:(process.env.FI_COGNEE_ENABLED==="true"||settings.enabled===true)&&available,
  writesEnabled:(process.env.FI_COGNEE_WRITES_ENABLED==="true"||settings.writesEnabled===true)&&available,
  storagePath:dataRoot,storageBytes:bytesUsed(join(dataRoot,"storage"))+bytesUsed(join(dataRoot,"cache")),
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
