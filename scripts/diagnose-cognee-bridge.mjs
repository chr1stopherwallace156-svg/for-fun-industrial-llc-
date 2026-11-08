// Mirror deployed Cognee memory subprocess configuration, without invoking memory.
// Uses installed Fun Industrial bridge but diagnostic Python from checked-out GitHub.
// No 8789/8792 restart, remember, recall, download or REA calls.
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const user=process.env.USERPROFILE;
const local=process.env.LOCALAPPDATA;
if(process.platform!=="win32"||!user||!local)throw Error("WINDOWS_PROFILE_REQUIRED");
const dataRoot=join(local,"FunIndustrial","CognitiveMemory");
const py=join(dataRoot,"venv","Scripts","python.exe");
const deployedBridge=join(user,"FunIndustrial-REA-MCP-Activation","cognee","memory_bridge.py");
const diagnostic=join(root,"cognee","bridge_setup_diagnostic.py");
for(const p of [py,deployedBridge,diagnostic])if(!existsSync(p))throw Error("DIAGNOSTIC_PREREQUISITE_MISSING:"+p);
const baseEnv={
 SystemRoot:process.env.SystemRoot,windir:process.env.windir,
 PATH:process.env.PATH,Path:process.env.Path,
 TEMP:process.env.TEMP,TMP:process.env.TMP,
 APPDATA:process.env.APPDATA,LOCALAPPDATA:local,USERPROFILE:user,
 DATA_ROOT_DIRECTORY:join(dataRoot,"storage","data"),
 SYSTEM_ROOT_DIRECTORY:join(dataRoot,"storage","system"),
 CACHE_ROOT_DIRECTORY:join(dataRoot,"cache"),
 HF_HOME:join(dataRoot,"cache","huggingface"),
 FASTEMBED_CACHE_PATH:join(dataRoot,"cache","fastembed"),
 FI_COGNEE_BRIDGE_PATH:deployedBridge
};
const env=Object.fromEntries(Object.entries(baseEnv).filter(([,v])=>typeof v==="string"&&v));
console.log("DEPLOYED_BRIDGE_DIAGNOSTIC=START");
console.log("ENVIRONMENT=MEMORY_BRIDGE_WHITELIST NO_CLOUD_KEYS");
console.log("OPERATION=CONFIGURATION_ONLY MEMORY_WRITES=0 MEMORY_RECALL=0 REA_CALLS=0");
const child=spawn(py,["-I",diagnostic],{
 cwd:dataRoot,env,windowsHide:true,stdio:["ignore","pipe","pipe"]
});
const timer=setTimeout(()=>child.kill(),90000);
let output=0;
for(const name of ["stdout","stderr"]){
 child[name].on("data",buffer=>{
  const text=buffer.toString();
  if(output<16000){
   const excerpt=text.slice(0,16000-output);
   output+=excerpt.length;
   process.stdout.write(excerpt);
  }
 });
}
child.on("error",e=>{clearTimeout(timer);console.error("DEPLOYED_BRIDGE_PROBE_ERROR="+e.message);process.exitCode=2;});
child.on("close",(code,signal)=>{
 clearTimeout(timer);
 if(code===0){console.log("DEPLOYED_BRIDGE_DIAGNOSTIC=PASS");}
 else{console.log("DEPLOYED_BRIDGE_DIAGNOSTIC=HOLD CODE="+code+" SIGNAL="+signal);process.exitCode=code||2;}
});
