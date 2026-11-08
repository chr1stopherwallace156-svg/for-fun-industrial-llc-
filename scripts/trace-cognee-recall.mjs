// Reproduce Cognee recall in its isolated Windows Python environment.
// NO remember(), no REA or llama.cpp interaction, no dashboard restart.
// Cognee recall can download local weights or write caches/search history.
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const user=process.env.USERPROFILE,local=process.env.LOCALAPPDATA;
if(process.platform!=="win32"||!user||!local)throw Error("WINDOWS_PROFILE_REQUIRED");
const dataRoot=join(local,"FunIndustrial","CognitiveMemory");
const exe=join(dataRoot,"venv","Scripts","python.exe");
const diag=join(root,"cognee","trace_recall_diagnostic.py");
const bridge=join(user,"FunIndustrial-REA-MCP-Activation","cognee","memory_bridge.py");
for(const path of [exe,diag,bridge])if(!existsSync(path))throw Error("DIAGNOSTIC_PREREQUISITE_MISSING:"+path);
const vars={
 SystemRoot:process.env.SystemRoot,windir:process.env.windir,
 PATH:process.env.PATH,Path:process.env.Path,
 TEMP:process.env.TEMP,TMP:process.env.TMP,APPDATA:process.env.APPDATA,
 LOCALAPPDATA:local,USERPROFILE:user,
 DATA_ROOT_DIRECTORY:join(dataRoot,"storage","data"),
 SYSTEM_ROOT_DIRECTORY:join(dataRoot,"storage","system"),
 CACHE_ROOT_DIRECTORY:join(dataRoot,"cache"),
 HF_HOME:join(dataRoot,"cache","huggingface"),
 FASTEMBED_CACHE_PATH:join(dataRoot,"cache","fastembed")
};
const env=Object.fromEntries(Object.entries(vars).filter(([,v])=>typeof v==="string"&&v));
console.log("DIRECT_RECALL_TRACE=START MEMORY_WRITE=NO REA_TOOL_CALL=NO");
console.log("LOCAL_MODEL_CACHE_DOWNLOAD_MAY_OCCUR=TRUE");
const child=spawn(exe,["-I",diag],{cwd:dataRoot,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
let bytes=0,timedOut=false;
const t=setTimeout(()=>{timedOut=true;child.kill()},230000);
for(const pipe of ["stdout","stderr"]){
 child[pipe].on("data",buf=>{
  const data=buf.toString();
  if(bytes<20000){const out=data.slice(0,20000-bytes);bytes+=out.length;process.stdout.write(out)}
 });
}
child.on("error",e=>{clearTimeout(t);console.error("DIRECT_RECALL_TRACE_ERROR="+e.message);process.exitCode=2});
child.on("close",(code,signal)=>{
 clearTimeout(t);
 if(code===0)console.log("DIRECT_RECALL_TRACE=PASS");
 else {console.log("DIRECT_RECALL_TRACE=HOLD CODE="+code+" SIGNAL="+signal+" TIMED_OUT="+timedOut);process.exitCode=code||2}
});
