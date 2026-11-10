import test from "node:test";
import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {readFileSync,writeFileSync,rmSync,mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createWebResearchActivator} from "../src/web-activation.mjs";
import {patchWebPlatform} from "../scripts/patch-web-platform.mjs";

const routes=["/health","/search/text","/search/images","/search/news","/search/videos","/search/books","/extract"];
const response=data=>({ok:true,status:200,json:async()=>data});
const network=state=>async url=>{
 if(!state.alive)throw Error("offline");
 if(url.endsWith("/health"))return response({status:"healthy",version:"1.0.0",service:"DDGS API"});
 if(url.endsWith("/openapi.json"))return response({paths:Object.fromEntries(routes.map(r=>[r,{}]))});
 throw Error("unknown url");
};
function child(){const c=new EventEmitter();c.exitCode=null;c.signalCode=null;c.unref=()=>{};c.kill=()=>{c.exitCode=0;return true};return c;}
const source=[
 'import {createAutonomyActivator} from "./autonomy-activation.mjs";',
 'const autonomyActivator=createAutonomyActivator();',
 'const FI_OPTIMIZATION_AGENT_V1=true;',
 'const FI_OPTIMIZATION_PHASE23_V1=true;',
 'const FI_AUTO_COGNEE_CHAT_V1=true;',
 'const FI_VOICE_MOBILE_DASHBOARD_V1=true;',
 'const FI_SOURCING_RETIRED_V1=true;',
 'const csp="script-src \'self\'; frame-ancestors \'none\';";',
 'const server=http.createServer(async(req,res)=>{try{',
 'if(req.method==="GET"&&req.url==="/api/status"){const status=await platform.status();return json(res,200,{...status,services:[...(status.services||[]),{id:"autonomy"}]});}',
 'if(req.url==="/api/stop")return json(res,200,await platform.stop());',
 'if(req.url==="/api/start"||req.url==="/api/activate"){let result={},platform_error=null;try{result=await platform.start()}catch(error){platform_error=String(error.message||error).slice(0,180)}const autonomy=await autonomyActivator.activate();return json(res,200,{...result,...(platform_error?{platform_error}:{}),autonomy});}',
 '/api/rea/call','/api/ai/chat','/api/optimization/agent/analyze'
].join("\n");

test("adopts running DDGS without spawning or stopping an external service",async()=>{
 let spawned=false;
 const a=createWebResearchActivator({fetchImpl:network({alive:true}),spawnProcess:()=>{spawned=true},osName:"win32"});
 assert.equal((await a.activate()).action,"already_running");
 assert.equal((await a.status()).state,"running");
 assert.equal((await a.stop()).state,"not-managed");
 assert.equal(spawned,false);
});
test("missing executable cannot run a shell or launch any process",async()=>{
 let spawned=false;
 const a=createWebResearchActivator({fetchImpl:network({alive:false}),exists:()=>false,spawnProcess:()=>{spawned=true},osName:"win32"});
 assert.equal((await a.activate()).action,"missing");assert.equal(spawned,false);
});
test("fixed DDGS executable launched once and only controller-owned process stops",async()=>{
 const state={alive:false},calls=[],proc=child();
 const a=createWebResearchActivator({fetchImpl:network(state),exists:()=>true,osName:"win32",userHome:"C:\\Users\\fixture",
  spawnProcess:(exe,args,opts)=>{calls.push({exe,args,opts});state.alive=true;return proc},delay:async()=>{}});
 const [first,second]=await Promise.all([a.activate(),a.activate()]);
 assert.equal(first.action,"started");assert.equal(second.state,"running");assert.equal(calls.length,1);
 assert.ok(calls[0].exe.includes("FunIndustrial-WebResearch"));
 assert.deepEqual(calls[0].args,["api","--host","127.0.0.1","--port","4479"]);
 assert.equal(calls[0].opts.shell,false);assert.equal(calls[0].opts.detached,true);
 assert.equal((await a.stop()).state,"stopping");
});
test("port 4479 identity mismatch fails closed",async()=>{
 const wrong=async u=>u.endsWith("/health")?response({status:"healthy",version:"1.0.0",service:"Unrelated service"}):response({paths:{"/health":{}}});
 let spawned=false;
 const a=createWebResearchActivator({fetchImpl:wrong,exists:()=>true,osName:"win32",spawnProcess:()=>{spawned=true}});
 assert.equal((await a.activate()).action,"identity_hold");assert.equal(spawned,false);
});
test("patch preserves original control routes and rejects unexpected baselines",()=>{
 const modified=patchWebPlatform(source);
 assert.match(modified,/FI_WEB_PLATFORM_ACTIVATION_V1/);
 assert.match(modified,/webResearchActivator.activate\(\)/);
 assert.match(modified,/webResearchActivator.stop\(\)/);
 assert.match(modified,/Web Research \/ DDGS/);
 assert.match(modified,/api\/web\/status/);
 for(const mark of ["/api/rea/call","/api/ai/chat","/api/optimization/agent/analyze","FI_AUTO_COGNEE_CHAT_V1"])assert.ok(modified.includes(mark));
 assert.throws(()=>patchWebPlatform(modified),/ALREADY_PATCHED/);
 assert.throws(()=>patchWebPlatform(source.replace("FI_OPTIMIZATION_AGENT_V1","UNKNOWN")),/BASELINE_MISSING/);
 assert.throws(()=>patchWebPlatform(source.replace("script-src 'self'","script-src 'nonce-only'")),/CSP/);
 assert.throws(()=>patchWebPlatform(source.replace("const autonomy=await autonomyActivator.activate();","const autonomy={};")),/WEB_PATCH_ANCHOR_HOLD/);
});
test("actual CLI staging writes output without modifying the original",()=>{
 const dir=mkdtempSync(path.join(tmpdir(),"fi-web-stage-"));
 try{
  const src=path.join(dir,"server.mjs"),out=path.join(dir,"staged.mjs"),script=fileURLToPath(new URL("../scripts/patch-web-platform.mjs",import.meta.url));
  writeFileSync(src,source);
  const staged=spawnSync(process.execPath,[script,src,out],{encoding:"utf8",timeout:10000});
  assert.equal(staged.status,0,staged.stderr);assert.match(staged.stdout,/FUN_WEB_PLATFORM_PATCH=PASS/);
  assert.equal(readFileSync(src,"utf8"),source);
  assert.match(readFileSync(out,"utf8"),/FI_WEB_PLATFORM_ACTIVATION_V1/);
  const denied=spawnSync(process.execPath,[script,src,src],{encoding:"utf8",timeout:10000});
  assert.equal(denied.status,1);assert.match(denied.stderr,/WEB_STAGE_PATHS_INVALID/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test("offline port 4479 is recoverable by installed Platform Control Activate, not a preflight blocker",()=>{
 const installer=readFileSync(new URL("../Activate-Fun-Web-Platform.ps1",import.meta.url),"utf8");
 assert.match(installer,/foreach\(\$port in @\(8088,8791,8443\)\)/);
 assert.match(installer,/\$webBefore=Snapshot 4479/);
 assert.match(installer,/FUN_WEB_PLATFORM_EXISTING_WEB=OFFLINE_WILL_START_ON_ACTIVATE/);
 assert.match(installer,/Invoke-RestMethod "\$Base\/api\/activate" -Method POST/);
 assert.match(installer,/FUN_WEB_PLATFORM_ACTIVATE_BUTTON=PASS/);
 assert.match(installer,/WEB_PORT_4479_NOT_STARTED/);
 assert.doesNotMatch(installer,/PROTECTED_SERVICE_OFFLINE_4479/);
});

test("DDGS health contract is healthy + DDGS API, not ok",async()=>{
 const source=readFileSync(new URL("../src/web-activation.mjs",import.meta.url),"utf8");
 const diagnostic=readFileSync(new URL("../scripts/diagnose-ddgs-platform-spawn.mjs",import.meta.url),"utf8");
 const installer=readFileSync(new URL("../Activate-Fun-Web-Platform.ps1",import.meta.url),"utf8");
 assert.match(source,/health\.status!=="healthy"/);
 assert.match(source,/health\.service!=="DDGS API"/);
 assert.match(diagnostic,/body\?\.status!=="healthy"/);
 assert.match(installer,/\$ddgs\.status -ne "healthy"/);
 assert.match(installer,/\$ddgs\.service -ne "DDGS API"/);
 const invalid=async url=>url.endsWith("/health")?response({status:"ok",version:"1.0.0",service:"DDGS API"}):response({paths:Object.fromEntries(routes.map(r=>[r,{}]))});
 const a=createWebResearchActivator({fetchImpl:invalid,exists:()=>true,osName:"win32"});
 assert.equal((await a.status()).state,"stopped");
 assert.equal((await a.activate()).action,"identity_hold");
});
