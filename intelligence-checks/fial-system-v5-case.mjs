import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import http from "node:http";
import {DatabaseSync} from "node:sqlite";
import {compileFialSystem,Fial5SyntaxError,FIAL5_BYTECODE} from "../src/fial/system-compiler-v5.mjs";
import {FIAL5_REGISTRY,FIAL5_RUNTIME,observeModules,runFialSystem,decideModule,
 fialSystemStatus,createFialSystemController} from "../src/fial/system-runtime-v5.mjs";
import {createFialSystemDashboard,injectSystemPanel} from "../scripts/Run-Fun-FIAL-System8804.mjs";
const source=await readFile(new URL("../src/fial/programs/system-coordination.fial",import.meta.url),"utf8");
const fetchAll=async url=>{
 const u=new URL(url);
 const byPort=Number(u.port);
 const vals={
  8088:{status:"ok"},8791:{status:"ready"},
  8789:{lifecycle:"running"},8796:{sidecar:true,port:8796},
  8797:{realReaToolCount:229,liveMcpHealth:"ready"},
  8798:{version:"fi-unified-task-chat-8798-v1",state:"ready"},
  8801:{version:"fun-qwen-scikit-v2",externalActions:0},
  8802:u.pathname==="/api/fun/hub/status"?
   {version:"fi-ml-hub-v3",state:"ready"}:{state:"ready"},
  8803:{version:"fi-fial4-live-hub-v1",state:"ready"}
 };
 assert.equal(u.hostname,"127.0.0.1");
 assert.ok(Object.hasOwn(vals,byPort));
 return new Response(JSON.stringify(vals[byPort]),{status:200,
  headers:{"content-type":"application/json"}});
};
async function temporary(cb){
 const root=await mkdtemp(join(tmpdir(),"fial5-system-"));
 try{await cb(root)}finally{await rm(root,{force:true,recursive:true})}
}
test("new FIAL language compiles system-wide, not SOURCE GRANTS",()=>{
 const compiled=compileFialSystem(source);
 assert.equal(compiled.bytecode,FIAL5_BYTECODE);
 assert.equal(compiled.scope,"FUN_INDUSTRIAL");
 assert.ok(Object.values(compiled.permissions).every(x=>x===false));
 for(const [a,b] of [["SCOPE FUN_INDUSTRIAL","SCOPE GRANTS"],
  ["AUTHORITY OBSERVE_AND_RECORD_ONLY","AUTHORITY ALL_TOOLS"],
  ["POLICY UNKNOWN_IS_HOLD","POLICY AUTO_RUN"],
  ["OBSERVE REGISTERED_MODULES","OBSERVE INTERNET"]]){
  assert.throws(()=>compileFialSystem(source.replace(a,b)),Fial5SyntaxError);
 }
});
test("registry covers multiple domains and excludes arbitrary external URLs",async()=>{
 assert.ok(FIAL5_REGISTRY.length>=18);
 const domains=new Set(FIAL5_REGISTRY.map(x=>x.domain));
 for(const d of ["ai","compute","tools","ml","commerce","voice","memory",
  "workflows","security","engineering","optimization","public_data","platform"])
  assert.ok(domains.has(d),d);
 const observed=await observeModules({fetchImpl:fetchAll});
 assert.equal(observed.length,FIAL5_REGISTRY.length);
 assert.equal(observed.find(x=>x.id==="rea").state,"IDENTITY_VERIFIED");
 assert.equal(observed.find(x=>x.id==="official_grants").state,"IDENTITY_VERIFIED");
 assert.equal(observed.find(x=>x.id==="persistent_memory").state,"NOT_INSTRUMENTED");
 assert.equal(observed.find(x=>x.id==="compute").state,
  "OBSERVED_ENDPOINT_IDENTITY_NOT_ATTESTED");
 await assert.rejects(observeModules({registry:[
  {id:"qwen",domain:"ai",kind:"loopback",port:1337,path:"/unsafe"}
 ],fetchImpl:fetchAll}),/UNAUTHORIZED_TARGET/);
});
test("failed health, spoofed identity and unavailable endpoints are conservatively reported",async()=>{
 const fake=async url=>{
  if(url.includes(":8797/"))return new Response(JSON.stringify({
   realReaToolCount:1}),{status:200,headers:{"content-type":"application/json"}});
  throw Error("OFFLINE");
 };
 const selected=FIAL5_REGISTRY.filter(x=>["rea","qwen","voice"].includes(x.id));
 const observed=await observeModules({fetchImpl:fake,registry:selected});
 assert.equal(observed.find(x=>x.id==="rea").state,"HOLD_IDENTITY_UNVERIFIED");
 assert.equal(observed.find(x=>x.id==="qwen").state,"UNAVAILABLE_OR_UNVERIFIED");
 assert.equal(observed.find(x=>x.id==="voice").state,"NOT_INSTRUMENTED");
 assert.ok(observed.every(x=>!Object.hasOwn(x,"execute")));
});
test("evidence changes create decisions, without granting tool authority",()=>{
 const module={id:"machine_learning",domain:"ml",kind:"loopback",
  state:"IDENTITY_VERIFIED",evidence_hash:"b"};
 const d=decideModule(module,{state:"IDENTITY_VERIFIED",evidence_hash:"a"});
 assert.equal(d.action,"REVIEW_OBSERVED_CHANGE");
 assert.equal(d.execution_authorized,false);
 assert.equal(d.changed,true);
 const lost=decideModule({...module,state:"UNAVAILABLE_OR_UNVERIFIED",evidence_hash:null},
  {state:"IDENTITY_VERIFIED",evidence_hash:"a"});
 assert.equal(lost.action,"INVESTIGATE_LOCAL_DEPENDENCY");
 assert.equal(lost.regressed,true);
});
test("cross-system runtime persists independent SQLite and JSON evidence across cycles",async()=>temporary(async d=>{
 const a=await runFialSystem({source,directory:d,fetchImpl:fetchAll});
 assert.equal(a.version,FIAL5_RUNTIME);
 assert.equal(a.module_count,FIAL5_REGISTRY.length);
 assert.equal(a.verified_modules,7);
 assert.equal(a.uninstrumented,8);
 assert.equal(a.external_tool_executions,0);
 assert.equal(a.rea_actions,0);
 assert.equal(a.model_calls,0);
 assert.equal(a.process_restarts,0);
 const b=await runFialSystem({source,directory:d,fetchImpl:fetchAll});
 assert.equal(b.change_events,0);
 assert.notEqual(a.run_id,b.run_id);
 const db=new DatabaseSync(join(d,"fial-system-memory-v5.sqlite"),{readOnly:true});
 try{assert.equal(db.prepare("SELECT COUNT(*) AS n FROM runs").get().n,2);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM observations").get().n,
  FIAL5_REGISTRY.length*2)}
 finally{db.close()}
 const s=await fialSystemStatus({directory:d});
 assert.equal(s.state,"SYSTEM_WIDE_COORDINATOR_ACTIVE_EVIDENCE_ONLY");
 assert.equal(s.module_count,FIAL5_REGISTRY.length);
 assert.equal(s.execution_authority,"UNCHANGED_OPERATOR_REVIEW_REQUIRED");
}));
test("server exposes active system cycle only to same-origin operator clicks",async()=>{
 let called=0;
 const ctrl={status:async()=>({state:"ready"}),
  run:async()=>{called++;return {state:"SYSTEM_WIDE_COORDINATOR_ACTIVE_EVIDENCE_ONLY"}}};
 const server=createFialSystemDashboard({controller:ctrl,
  getPage:async()=>({html:"<html><body><p>Existing hub</p></body></html>",
   csp:"default-src 'self'; script-src 'self'; connect-src 'self'"}),
  readWidget:async()=>"(function(){})()",
  proxy:async(req,res)=>{res.end("proxied");}
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const port=server.address().port;
 async function call(path,{method="GET",origin=null,approve=false,body=null,host="127.0.0.1:8804"}={}){
  return new Promise((resolve,reject)=>{
   const headers={host};
   if(origin)headers.origin=origin;
   if(approve)headers["x-fi-fial-system"]="operator-click";
   if(body!==null){
    headers["content-type"]="application/json";
    headers["content-length"]=Buffer.byteLength(body);
   }
   const req=http.request({hostname:"127.0.0.1",port,path,method,headers},res=>{
    const parts=[];res.on("data",x=>parts.push(x));
    res.on("end",()=>resolve({status:res.statusCode,
     content:Buffer.concat(parts).toString("utf8")}));
   });
   req.on("error",reject);req.end(body===null?undefined:body);
  });
 }
 try{
  const page=await call("/");
  assert.equal(page.status,200);assert.match(page.content,/Entire Fun Industrial System/);
  assert.match(page.content,/Existing hub/);
  assert.equal((await call("/api/fial/system/run",{method:"POST",body:"{}"})).status,403);
  assert.equal((await call("/api/fial/system/run",{method:"POST",body:"{}",
   origin:"https://evil.example",approve:true})).status,403);
  assert.equal(called,0);
  assert.equal((await call("/api/fial/system/run",{method:"POST",body:"{}",
   origin:"http://127.0.0.1:8804",approve:true})).status,200);
  assert.equal(called,1);
  assert.equal((await call("/api/fial/system/status",{host:"other.example"})).status,403);
 }finally{await new Promise(r=>server.close(r))}
});
test("system panel refuses malformed upstream HTML",()=>{
 assert.throws(()=>injectSystemPanel("<html><head></head></html>"),/BAD_UPSTREAM_HTML/);
 assert.match(injectSystemPanel("<html><body>Safe</body></html>"),/fi-fial5-system/);
});
test("active controller rejects overlapping cycles and does not execute extra work",async()=>{
 let release,started;
 const firstStart=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 let count=0;
 const controller=createFialSystemController({source,
  cycle:async()=>{count++;started();await gate;return {
   state:"SYSTEM_WIDE_COORDINATOR_ACTIVE_EVIDENCE_ONLY",utc:"2026-11-14T00:00:00Z",
   module_count:18,verified_modules:0,uninstrumented:8,held_or_pending_modules:18,
   change_events:0}},
  status:async()=>({state:"not_run"})});
 const first=controller.run();await firstStart;
 assert.equal((await controller.run()).state,"busy");
 release();assert.equal((await first).state,"SYSTEM_WIDE_COORDINATOR_ACTIVE_EVIDENCE_ONLY");
 assert.equal(count,1);
});
