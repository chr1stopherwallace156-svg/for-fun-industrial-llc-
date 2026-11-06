// Optional, operator-reviewed Aider adapter for Fun Industrial's existing chat.
// Changes are confined to a disposable local Git clone. Never writes to the live checkout.
// This is process isolation by workspace, NOT an OS security sandbox.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {randomBytes,createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const exec=promisify(execFile);
const EXT=new Set([".js",".jsx",".mjs",".cjs",".ts",".tsx",".py",".rs",".go",".java",".c",".cpp",".h",".hpp",".json",".md"]);
const PART=/^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SECRET=/(?:^|[._-])(env|secret|secrets|credential|credentials|password|token|private|key)(?:[._-]|$)/i;
const CONTROL=/(?:^|\n)\s*\/(?:run|git|test|lint|load|add|commit|apply|exit|shell)\b/i;
const MAX_LOG=16000;
export function validateCodingPaths(paths){
  if(!Array.isArray(paths)||paths.length<1||paths.length>2)throw Error("one or two tracked files required");
  const selected=[];
  for(const item of paths){
    if(typeof item!=="string"||item.length>180||item.includes("\\")||path.posix.isAbsolute(item))throw Error("invalid relative file path");
    const bits=item.split("/");
    if(bits.some(x=>x==="."||x===".."||!PART.test(x))||bits.some(x=>SECRET.test(x)||["node_modules",".git",".runtime","dist","build","coverage"].includes(x.toLowerCase())))throw Error("protected or invalid file path");
    if(!EXT.has(path.posix.extname(item).toLowerCase()))throw Error("unsupported source file extension");
    if(selected.includes(item))throw Error("duplicate file");
    selected.push(item);
  }
  return selected;
}
export function validateCodingTask(task){
  if(typeof task!=="string"||task.trim().length<15||task.length>800||CONTROL.test(task))throw Error("invalid or command-style coding task");
  if(/\b(?:password|secret|api[_-]?key|bearer)\s*[:=]\s*\S+/i.test(task))throw Error("secrets cannot be submitted to coding agent");
  return task.trim();
}
export function codingEvidenceRecord({files,task,baseCommit,sessionId}){
  return {kind:"isolated-coding-candidate-v1",task:task.slice(0,240),files,
    base_commit:baseCommit,session_id:sessionId,approval:"operator-approved",
    candidate_status:"not_qualified",tests_run:false,
    created_at:new Date().toISOString()};
}
function send(res,code,body){res.writeHead(code,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(body))}
function safeError(e){return String(e?.message||e).slice(0,340)}
function token(){return randomBytes(16).toString("hex")}
function isWithin(root,file){const rel=path.relative(root,file);return !!rel&&!rel.startsWith(".."+path.sep)&&!path.isAbsolute(rel)}
export function createCodingAgent({root,modelPort,baseDir,aiderPath,execFile=exec}){
  if(!path.isAbsolute(root))throw Error("coding root must be absolute");
  if(!Number.isInteger(modelPort)||modelPort<1024||modelPort>65535)throw Error("invalid model port");
  const home=baseDir||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),"AppData","Local"),"FunIndustrial","CodingAgent");
  const aider=aiderPath||path.join(home,"venv",process.platform==="win32"?"Scripts/aider.exe":"bin/aider");
  const pending=new Map(),sessions=new Map();
  let busy=false;
  async function call(file,args,options={}){
    const result=await execFile(file,args,{windowsHide:true,timeout:options.timeout||15000,maxBuffer:MAX_LOG*8,cwd:options.cwd||root,env:options.env||process.env});
    return String(result.stdout||"");
  }
  async function checkFiles(files){
    const rootReal=await fs.realpath(root);
    if(!rootReal||!await fs.stat(path.join(rootReal,".git")).then(s=>s.isDirectory()).catch(()=>false))throw Error("coding root is not a Git checkout");
    for(const file of files){
      const full=path.resolve(rootReal,file);
      if(!isWithin(rootReal,full))throw Error("path escaped repository");
      const stat=await fs.lstat(full);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size>48000)throw Error("source file unavailable or too large");
      const actual=await fs.realpath(full);
      if(!isWithin(rootReal,actual))throw Error("source symlink escape");
      // Active dashboard source may be uncommitted or untracked by Git; copy the
      // operator-selected snapshot into the isolated clone, not the active files.
    }
    return rootReal;
  }
  async function status(){
    const installed=await fs.stat(aider).then(s=>s.isFile()).catch(()=>false);
    const model_ready=await fetch("http://127.0.0.1:"+modelPort+"/health",{signal:AbortSignal.timeout(2000)}).then(r=>r.ok).catch(()=>false);
    return {provider:"Aider",installed,model_ready,available:installed&&model_ready,mode:"on-demand",authority:"operator-approval-isolated-clone-only",model:"openai/local-model",model_port:modelPort,active_sessions:sessions.size,executing:busy};
  }
  function cleanPending(){for(const [id,p] of pending)if(Date.now()-p.created>300000)pending.delete(id)}
  async function intent(data){
    const task=validateCodingTask(data?.task),files=validateCodingPaths(data?.files);
    await checkFiles(files);
    cleanPending();
    if(pending.size>=6)throw Error("too many pending coding requests");
    const id=token(),nonce=token();
    pending.set(id,{task,files,nonce,created:Date.now()});
    return {state:"approval_required",intent_id:id,approval_token:nonce,review:{task,files,action:"Run Aider against a disposable local clone; no active source edits",model:"local Qwen3 via llama.cpp",auto_tests:false,auto_commits:false,auto_merge:false},expires_seconds:300};
  }
  async function prepare(data){
    if(data?.approve!==true||!(/^[0-9a-f]{32}$/).test(data?.intent_id||"")||!(/^[0-9a-f]{32}$/).test(data?.approval_token||""))throw Error("explicit approval required");
    const p=pending.get(data.intent_id);
    if(!p||p.nonce!==data.approval_token||Date.now()-p.created>300000)throw Error("approval expired or invalid");
    if(busy)throw Error("another coding operation is active");
    if(sessions.size>=10)throw Error("maximum retained sessions reached; review prior evidence before restart");
    pending.delete(data.intent_id);
    const rootReal=await checkFiles(p.files);
    if(!await fs.stat(aider).then(s=>s.isFile()).catch(()=>false))throw Error("Aider is not installed in the dedicated local environment");
    const id=token(),dir=path.join(home,"Sessions",id),clone=path.join(dir,"worktree");
    await fs.mkdir(dir,{recursive:true});
    busy=true;
    let output="",agentFailed=false;
    try{
      const original=(await call("git",["-C",rootReal,"rev-parse","HEAD"])).trim();
      await call("git",["clone","--no-local","--no-hardlinks","--no-tags",rootReal,clone],{timeout:90000});
      // Establish an exact source snapshot inside the clone so edits compare
      // against the selected ACTIVE file even when it was not committed to Git.
      const emptyHooks=path.join(dir,"no-hooks");
      await fs.mkdir(emptyHooks);
      for(const file of p.files){
        const destination=path.join(clone,file);
        await fs.mkdir(path.dirname(destination),{recursive:true});
        await fs.copyFile(path.join(rootReal,file),destination);
      }
      await call("git",["-C",clone,"add","--",...p.files]);
      const staged=await call("git",["-C",clone,"diff","--cached","--name-only"]);
      if(staged.trim()){
        await call("git",["-c","user.name=Fun Industrial Coding Snapshot","-c","user.email=coding-snapshot@localhost","-c","core.hooksPath="+emptyHooks,"-C",clone,"commit","-m","Snapshot approved source files for isolated coding"],{timeout:30000});
      }
      const base=(await call("git",["-C",clone,"rev-parse","HEAD"])).trim();
      const modelUrl="http://127.0.0.1:"+modelPort+"/v1";
      const health=await fetch("http://127.0.0.1:"+modelPort+"/health",{signal:AbortSignal.timeout(2500)}).then(r=>r.ok).catch(()=>false);
      if(!health)throw Error("existing local llama.cpp model is not ready");
      const taskFile=path.join(dir,"task.txt");
      await fs.writeFile(path.join(dir,"empty-config.yml"),"{}\n");
      await fs.writeFile(path.join(dir,"empty.env"),"");
      await fs.writeFile(taskFile,"Task: "+p.task+"\n\nEdit only the explicitly supplied files. Never run shell commands, tests, or git commits. Do not add dependencies. Write the smallest reviewable change.\n",{mode:0o600});
      const args=["--model","openai/local-model","--chat-mode","code","--message-file",taskFile,
        "--no-auto-commits","--no-dirty-commits","--no-auto-lint","--no-auto-test","--no-gitignore",
        "--no-check-update","--no-analytics","--no-suggest-shell-commands","--no-stream",
        "--no-pretty","--no-restore-chat-history","--no-watch-files","--no-detect-urls","--no-auto-accept-architect",
        "--no-show-model-warnings","--no-check-model-accepts-settings","--map-tokens","0",
        "--input-history-file",path.join(dir,"input.history"),"--chat-history-file",path.join(dir,"chat.history"),
        "--llm-history-file",path.join(dir,"llm.history"),"--config",path.join(dir,"empty-config.yml"),"--env-file",path.join(dir,"empty.env")];
      for(const f of p.files)args.push("--file",f);
      const env={...process.env,OPENAI_API_BASE:modelUrl,OPENAI_API_KEY:"local-only",NO_PROXY:"127.0.0.1,localhost",no_proxy:"127.0.0.1,localhost",
        AIDER_ANALYTICS:"false",AIDER_CHECK_UPDATE:"false",AIDER_AUTO_COMMITS:"false",
        AIDER_AUTO_TEST:"false",AIDER_AUTO_LINT:"false",AIDER_GITIGNORE:"false"};
      try{output=await call(aider,args,{cwd:clone,env,timeout:175000})}
      catch(e){agentFailed=true;output=String(e?.stdout||"")+"\n"+String(e?.stderr||"")+"\nERROR "+safeError(e)}
      const changed=(await call("git",["-C",clone,"diff","--name-only","--no-ext-diff"])).trim().split(/\r?\n/).filter(Boolean);
      const extra=(await call("git",["-C",clone,"ls-files","--others","--exclude-standard"])).trim().split(/\r?\n/).filter(Boolean);
      const outOfScope=[...changed,...extra].filter(x=>!p.files.includes(x));
      const diff=await call("git",["-C",clone,"diff","--no-ext-diff","--",...p.files],{timeout:10000});
      const diffPath=path.join(dir,"candidate.patch");
      await fs.writeFile(diffPath,diff);
      const sourceFiles=changed.filter(x=>p.files.includes(x));
      const result={state:outOfScope.length?"hold_scope_violation":agentFailed?"hold_agent_failed":diff.trim()?"candidate_ready":"no_patch",
        session_id:id,source_commit:base,original_commit:original,changed_files:sourceFiles,out_of_scope:outOfScope,workspace:clone,
        diff_path:diffPath,diff_sha256:createHash("sha256").update(diff).digest("hex"),
        diff_preview:diff.slice(0,20000),agent_log:output.slice(-6000),tests_run:false,
        evidence:codingEvidenceRecord({files:p.files,task:p.task,baseCommit:base,sessionId:id})};
      await fs.writeFile(path.join(dir,"receipt.json"),JSON.stringify({...result,diff_preview:undefined},null,2));
      sessions.set(id,{...result,clone,files:p.files,created:Date.now(),tested:false});
      return result;
    }finally{busy=false}
  }
  async function testClone(data){
    if(data?.approve!==true||!(/^[0-9a-f]{32}$/).test(data?.session_id||""))throw Error("explicit test approval required");
    if(busy)throw Error("another coding operation is active");
    const s=sessions.get(data.session_id);
    if(!s||s.state!=="candidate_ready")throw Error("no approved candidate session");
    if(s.tested)throw Error("session tests already attempted");
    s.tested=true;
    const packagePath=path.join(s.clone,"package.json");
    const pkg=await fs.readFile(packagePath,"utf8").then(JSON.parse).catch(()=>null);
    if(!pkg||pkg.scripts?.test!=="node --test")throw Error("test command not on fixed allowlist");
    busy=true;
    try{
      let passed=false,log="";
      try{log=await call(process.execPath,["--test"],{cwd:s.clone,timeout:120000});passed=true}
      catch(e){log=String(e?.stdout||"")+"\n"+String(e?.stderr||"")+"\n"+safeError(e)}
      const result={state:passed?"tests_pass":"tests_fail",session_id:data.session_id,tests_run:true,
        test_command:"node --test",test_log:log.slice(-9000),workspace:s.clone,source_commit:s.source_commit};
      await fs.writeFile(path.join(path.dirname(s.clone),"test-receipt.json"),JSON.stringify(result,null,2));
      return result;
    }finally{busy=false}
  }
  return async function coding(req,res,endpoint,data={}){
    try{
      if(req.method==="GET"&&endpoint==="/api/unified/coding/status")return send(res,200,await status());
      if(req.method!=="POST")return send(res,405,{error:"method not allowed"});
      if(endpoint==="/api/unified/coding/intent")return send(res,200,await intent(data));
      if(endpoint==="/api/unified/coding/approve")return send(res,200,await prepare(data));
      if(endpoint==="/api/unified/coding/test")return send(res,200,await testClone(data));
      return send(res,404,{error:"unknown coding endpoint"});
    }catch(e){
      return send(res,400,{error:"coding agent request rejected",detail:safeError(e),executed_tools:0});
    }
  };
}
