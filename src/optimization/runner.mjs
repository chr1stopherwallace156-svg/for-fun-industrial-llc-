// FI_OPTIMIZATION_PHASE23_V1 — isolated one-shot optimization subprocess.
// The existing Fun Industrial dashboard is the only transport; no port opens.
// No REA authority, no AI-triggered execution, no subprocess shell and no
// interaction with llama.cpp, Cognee, voice or other running services.
import {spawn} from "node:child_process";
import {existsSync,lstatSync} from "node:fs";
import {join,resolve} from "node:path";
import os from "node:os";

const ROOT=join(process.env.USERPROFILE||os.homedir(),"FunIndustrial-Optimization-20261109");
const PYTHON=join(process.env.LOCALAPPDATA||join(os.homedir(),"AppData","Local"),
 "FunIndustrial","OptimizationRuntime","venv","Scripts","python.exe");
const INPUT_MAX=32768,OUTPUT_MAX=32768;
const ACTIONS=new Set(["inventory","allocation","route"]);
function safeFile(path){
 try{return existsSync(path)&&lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink();}catch{return false;}
}
function safeDirectory(path){
 try{return existsSync(path)&&lstatSync(path).isDirectory()&&!lstatSync(path).isSymbolicLink();}catch{return false;}
}
export function createOptimizationRunner({checkout=ROOT,python=PYTHON,spawnProcess=spawn}={}){
 const cwd=resolve(checkout);
 const py=resolve(python);
 let running=false,lastStart=0;
 function status(){
  const source=safeDirectory(cwd)&&
    safeFile(join(cwd,"fun_optimization","__init__.py"))&&
    safeFile(join(cwd,"fun_optimization","bridge.py"))&&
    safeFile(join(cwd,"fun_optimization","core.py"));
  const ready=safeFile(py)&&source;
  return {schema:"fun.optimization.status.v1",state:ready?"ready":"not-configured",
   capabilities:["inventory","allocation","route"],
   engines:["optuna","google-or-tools"],
   mode:"operator_approved_bounded_offline",
   decisionSupportOnly:true,
   aiDraftExecutes:false,reaToolsExecuted:0,
   pythonAvailable:safeFile(py),sourceAvailable:Boolean(source),
   running,networkListenerStarted:false};
 }
 async function run(action,problem){
  if(!ACTIONS.has(action)||!problem||typeof problem!=="object"||Array.isArray(problem))
   throw Error("OPTIMIZATION_INPUT_HOLD");
  if(status().state!=="ready")throw Error("OPTIMIZATION_RUNTIME_MISSING");
  if(running)throw Error("OPTIMIZATION_ALREADY_RUNNING");
  if(Date.now()-lastStart<1500)throw Error("OPTIMIZATION_COOLDOWN");
  const input=JSON.stringify({action,problem});
  if(Buffer.byteLength(input,"utf8")>INPUT_MAX)throw Error("OPTIMIZATION_INPUT_TOO_LARGE");
  running=true;lastStart=Date.now();
  try{
   const output=await new Promise((resolvePromise,rejectPromise)=>{
    let proc,out="",err="",settled=false;
    const done=(error,value)=>{
     if(settled)return;settled=true;clearTimeout(timeout);
     if(error)rejectPromise(error);else resolvePromise(value);
    };
    const env={
     SystemRoot:process.env.SystemRoot||"C:\\Windows",
     WINDIR:process.env.WINDIR||"C:\\Windows",
     PATH:process.env.PATH||"",
     TEMP:process.env.TEMP||os.tmpdir(),
     TMP:process.env.TMP||os.tmpdir(),
     PYTHONNOUSERSITE:"1",PYTHONDONTWRITEBYTECODE:"1",
     OMP_NUM_THREADS:"1",OPENBLAS_NUM_THREADS:"1",
    };
    try{proc=spawnProcess(py,["-m","fun_optimization.bridge"],{
     cwd,shell:false,windowsHide:true,env,stdio:["pipe","pipe","pipe"],
    });}catch{rejectPromise(Error("OPTIMIZATION_PROCESS_START_HOLD"));return;}
    const timeout=setTimeout(()=>{
      try{proc.kill()}catch{}
      done(Error("OPTIMIZATION_TIME_LIMIT"));
    },20000);
    proc.on("error",()=>done(Error("OPTIMIZATION_PROCESS_START_HOLD")));
    proc.stdout.on("data",chunk=>{
      out+=chunk.toString("utf8");if(Buffer.byteLength(out)>OUTPUT_MAX){
       try{proc.kill()}catch{}
       done(Error("OPTIMIZATION_OUTPUT_LIMIT"));
      }
    });
    proc.stderr.on("data",chunk=>{
      err+=chunk.toString("utf8");if(Buffer.byteLength(err)>OUTPUT_MAX){
       try{proc.kill()}catch{}
       done(Error("OPTIMIZATION_DIAGNOSTIC_LIMIT"));
      }
    });
    proc.on("close",code=>{
      if(code!==0)return done(Error("OPTIMIZATION_SOLVER_HOLD:"+String(err).slice(0,250)));
      let parsed;try{parsed=JSON.parse(out.trim())}catch{return done(Error("OPTIMIZATION_RESPONSE_NOT_JSON"))}
      if(parsed?.schema!=="fun.optimization.result.v1"||
         parsed.action!==action||parsed.decision_support_only!==true||
         parsed.rea_tools_executed!==0||parsed.external_actions_executed!==0||
         !parsed.result||typeof parsed.result!=="object")
        return done(Error("OPTIMIZATION_RESULT_SCHEMA_HOLD"));
      done(null,parsed);
    });
    proc.stdin.on("error",()=>{});
    try{proc.stdin.end(input)}catch{try{proc.kill()}catch{};done(Error("OPTIMIZATION_STDIN_HOLD"))}
   });
   return output;
  }finally{running=false;}
 }
 return {status,run};
}
