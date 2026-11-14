import {test} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {mkdtemp,mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {FIAL5_REGISTRY} from "../src/fial/system-runtime-v5.mjs";
import {createFial51Adapters,saveIntegrationEvidence,IDS,OPERATIONS,V51} from "../src/fial/module-adapters-v5-1.mjs";
import {createFial51Hub,reconcileCore,FIAL51_HUB} from "../scripts/Run-Fun-FIAL-Integrations8805.mjs";

const schema={type:"object",properties:{path:{type:"string"}},
 required:["path"],additionalProperties:false};
const tools=[{name:"inspect_rust_binary",inputSchema:schema},
 {name:"inspect_pe_imports",inputSchema:schema},
 ...Array.from({length:227},(_,i)=>({name:"synthetic_tool_"+i,inputSchema:schema}))];
const core={version:"fial-system-runtime-v0.5",
 state:"SYSTEM_WIDE_COORDINATOR_ACTIVE_EVIDENCE_ONLY",module_count:18,
 verified_modules:7,observed_unattested:3,
 modules:FIAL5_REGISTRY.map(x=>({
  id:x.id,domain:x.domain,
  state:IDS.includes(x.id)?"NOT_INSTRUMENTED":"IDENTITY_VERIFIED",
  decision:"CONTINUE_MONITORING",summary:{}
 }))};
const jsonResponse=v=>new Response(JSON.stringify(v),{
 status:200,headers:{"content-type":"application/json"}});
const events={http:[],ops:[],audit:0,model:0,web:0,recall:0};
function freshEvents(){events.http=[];events.ops=[];events.audit=0;events.model=0;
 events.web=0;events.recall=0}
const fixtureFetch=async(url,opts)=>{
 events.http.push({url,method:opts.method});
 if(url==="http://127.0.0.1:8802/api/commerce/opportunities")
  return jsonResponse({version:"fun-commerce-opportunities-v1.1",
   state:"research_only",qualifies_as_verified_sales_opportunity:false,
   order_authority:false});
 if(url==="http://127.0.0.1:8797/api/rea229/status")
  return jsonResponse({liveMcpHealth:"ready",realReaToolCount:229});
 if(url==="http://127.0.0.1:8797/api/rea229/tools?limit=229")
  return jsonResponse({tools});
 if(url==="http://127.0.0.1:8804/api/fial/system/status")
  return jsonResponse(core);
 throw Error("UNEXPECTED_NETWORK_ACCESS_"+url);
};
async function temporary(fn){
 const d=await mkdtemp(join(tmpdir(),"fial51-"));
 try{return await fn(d)}finally{await rm(d,{recursive:true,force:true})}
}
const optimizationRunner={
 status:()=>({schema:"fun.optimization.status.v1",state:"ready",
  engines:["optuna","google-or-tools"],capabilities:["inventory","allocation","route"],
  pythonAvailable:true,sourceAvailable:true,running:false}),
 run:async(action,problem)=>{
  events.ops.push("optimization_"+action);
  return {schema:"fun.optimization.result.v1",action,problem,
   decision_support_only:true,rea_tools_executed:0,external_actions_executed:0};
 }
};
const workflowCoordinator={
 create:async spec=>{events.ops.push("workflow_create");return {status:"ready",goal:spec.goal,id:"a".repeat(8)+"-1111-4111-8111-"+"b".repeat(12)}},
 get:async id=>{events.ops.push("workflow_get");return {id,status:"ready"}},
 advance:async id=>{events.ops.push("workflow_advance");return {id,status:"awaiting_review"}},
 review:async(id,decision)=>{events.ops.push("workflow_review");return {id,status:decision}}
};
function adapters(extra={}){
 return createFial51Adapters({
  fetchImpl:fixtureFetch,
  memoryStatusFn:()=>({engine:"cognee",available:true,enabled:true,
   writesEnabled:false,automaticIngestion:false}),
  memoryActionFn:async(action,input)=>{events.recall++;assert.equal(action,"recall");
   return {ok:true,state:"retrieved",count:1,query_length:input.query.length}},
  optimizationRunner,workflowCoordinator,
  voiceEnabled:()=>false,
  commerce:{status:async()=>({version:"fun-commerce-intelligence-v1",
   shopify:{configured:false}})},
  webFetch:async url=>{events.web++;
   return {kind:"public_web_static_text",url,text:"Static page",
    sourceTrust:"untrusted",noScriptsExecuted:true,redirectsFollowed:0}},
  audit:async(root)=>{events.audit++;assert.match(root,/src$/);
   return {state:"completed",files_inspected:12,bytes_inspected:5000,indicators:[]}},
  ...extra
 });
}
test("registry fills all eight exact missing domains with real module interfaces",async()=>{
 freshEvents();const a=adapters();
 const inspected=await a.inspectAll();
 assert.equal(inspected.version,V51);assert.equal(inspected.count,8);
 assert.deepEqual(inspected.modules.map(x=>x.id),IDS);
 assert.equal(inspected.holds,0);
 assert.ok(inspected.modules.every(x=>x.integration==="REAL_MODULE_INTERFACE"));
 assert.equal(inspected.modules.find(x=>x.id==="optimization").state,"AVAILABLE_CONFIGURED");
 assert.equal(inspected.modules.find(x=>x.id==="engineering_inspection").state,"AVAILABLE_CONFIGURED");
 assert.equal(inspected.modules.find(x=>x.id==="voice").state,"NOT_ENABLED");
 assert.deepEqual(Object.keys(OPERATIONS),IDS);
 assert.equal(events.recall,0);assert.equal(events.web,0);assert.equal(events.audit,0);
 assert.ok(events.http.every(x=>x.url.includes("127.0.0.1:8802")));
});
test("whole system merges 10 existing services with exactly eight real adapters",async()=>{
 const x=await adapters().inspectAll();
 const all=reconcileCore(core,x);
 assert.equal(all.register_count,18);
 assert.equal(all.real_adapters_connected,8);
 assert.equal(all.core_identity_verified,7);
 assert.equal(all.modules.filter(x=>x.state==="NOT_INSTRUMENTED").length,0);
 assert.equal(all.modules.find(x=>x.id==="rea").state,"IDENTITY_VERIFIED");
 assert.equal(all.modules.find(x=>x.id==="persistent_memory").integration,"REAL_MODULE_INTERFACE");
 assert.equal(all.rea_tools_executed,0);
 assert.throws(()=>reconcileCore({...core,modules:[...core.modules].map(x=>
  x.id==="voice"?{...x,state:"IDENTITY_VERIFIED"}:x)},x),/OVERRIDE_CONFLICT/);
});
test("each operator-selected existing module operation invokes only its approved narrow interface",async()=>{
 freshEvents();const a=adapters();
 const memory=await a.runApproved({module:"persistent_memory",operation:"recall",
  input:{query:"What was the agreed optimization workflow?"}});
 assert.equal(memory.state,"completed");assert.equal(events.recall,1);
 const opt=await a.runApproved({module:"optimization",operation:"analyze",
  input:{request:"Optimize inventory",problem:{demand_samples:[3,4,5],
   min_stock:0,max_stock:12,holding_cost:1,shortage_cost:3,trials:20}}});
 assert.equal(opt.state,"completed");assert.equal(opt.result.state,"computed");
 assert.equal(events.ops.includes("optimization_inventory"),true);
 assert.match(opt.result.approval_ticket,/^[0-9a-f-]{36}$/);
 const flow=await a.runApproved({module:"workflows",operation:"create",
  input:{spec:{goal:"Review three numbers",steps:[{id:"stats",kind:"stats",values:[1,2,3]}]}}});
 assert.equal(flow.result.status,"ready");
 const pending=await a.runApproved({module:"workflows",operation:"advance",
  input:{id:"aaaaaaaa-1111-4111-8111-bbbbbbbbbbbb"}});
 assert.equal(pending.result.status,"awaiting_review");
 const sec=await a.runApproved({module:"security",operation:"audit_own_source",input:{}});
 assert.equal(sec.result.files_inspected,12);assert.equal(events.audit,1);
 const commerce=await a.runApproved({module:"ecommerce_operations",
  operation:"cached_opportunities",input:{}});
 assert.equal(commerce.result.order_authority,false);
 const web=await a.runApproved({module:"public_web",operation:"fetch_static_text",
  input:{url:"https://example.org/"}});
 assert.equal(web.result.sourceTrust,"untrusted");assert.equal(events.web,1);
 const eng=await a.runApproved({module:"engineering_inspection",
  operation:"file_preflight",input:{}});
 assert.equal(eng.result.approvalGranted,false);
 const pe=await a.runApproved({module:"engineering_inspection",
  operation:"pe_preflight",input:{name:"inspect_pe_imports"}});
 assert.equal(pe.result.executionCount,0);
 assert.equal(events.http.some(x=>x.url.includes("/api/rea229/call")),false);
 assert.equal(events.model,0);
});
test("invalid/unauthorized module tasks and unsafe public/private URLs fail closed",async()=>{
 const a=adapters();
 await assert.rejects(a.runApproved({module:"rea",operation:"tools_call",input:{}}),
  /UNSUPPORTED_ADAPTER_OPERATION/);
 const missing=await a.runApproved({module:"optimization",operation:"analyze",
  input:{request:"Optimize inventory",problem:{}}});
 assert.equal(missing.result.state,"needs_input");
 assert.equal(missing.result.external_actions_executed,0);
 await assert.rejects(a.runApproved({module:"persistent_memory",operation:"recall",
  input:{query:""}}),/MEMORY_RECALL_INPUT_INVALID/);
 await assert.rejects(a.runApproved({module:"voice",operation:"validate_saved_wav",
  input:{filename:"../../private.wav"}}),/VOICE_INPUT_OR_ENABLEMENT_HOLD/);
 await assert.rejects(a.runApproved({module:"public_web",operation:"fetch_static_text",
  input:{url:"http://127.0.0.1:8789/"}}),/WEB_ONLY_PUBLIC_HTTPS_HOSTNAMES/);
 await assert.rejects(a.runApproved({module:"engineering_inspection",
  operation:"pe_preflight",input:{name:"inspect_unsupported"}}),/TOOL_NOT_ALLOWLISTED/);
 assert.equal(events.http.some(x=>x.url.includes("/api/rea229/call")),false);
});
test("actual WAV validator is integrated on operator request without transcribing",async()=>temporary(async d=>{
 const folder=join(d,"recordings");await mkdir(folder);
 const filename="iphone-20261114T170000Z-012345abcdef.wav";
 const samples=32000,bytes=Buffer.alloc(44+samples*2);
 bytes.write("RIFF",0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write("WAVE",8);
 bytes.write("fmt ",12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);
 bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(16000,24);bytes.writeUInt32LE(32000,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
 bytes.write("data",36);bytes.writeUInt32LE(samples*2,40);
 for(let i=44;i<bytes.length;i+=2)bytes.writeInt16LE(1000,i);
 await writeFile(join(folder,filename),bytes);
 const a=adapters({voiceEnabled:()=>true,
  voicePaths:()=>({recordings:folder})});
 const result=await a.runApproved({module:"voice",operation:"validate_saved_wav",
  input:{filename}});
 assert.equal(result.result.seconds,2);
 assert.equal(result.result.transcribed,false);
 assert.equal(result.result.recording_written,false);
}));
test("persistent audit ledger stores metadata digests, never raw memory or web page content",async()=>temporary(async d=>{
 const value={version:V51,module:"public_web",operation:"fetch_static_text",
  state:"completed",result:{text:"confidential raw page",sourceTrust:"untrusted"}};
 const receipt=await saveIntegrationEvidence(value,{directory:d});
 assert.equal(receipt.raw_content_persisted,false);
 assert.equal(receipt.result_sha256.length,64);
 const disk=await readFile(join(d,"last-evidence.json"),"utf8");
 assert.equal(disk.includes("confidential raw page"),false);
 const db=new DatabaseSync(join(d,"integration-events.sqlite"),{readOnly:true});
 try{
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records").get().n,1);
  assert.equal(db.prepare("SELECT result_size FROM records").get().result_size>0,true);
 }finally{db.close()}
}));
test("HTTP hub reports combined coverage; actions demand same-origin exact approval",async()=>{
 freshEvents();
 let operations=0,checks=0;
 const fakeAdapters={inspectAll:async()=>{
  checks++;
  return {version:V51,count:8,ready:8,holds:0,
   modules:IDS.map(id=>({id,domain:id,integration:"REAL_MODULE_INTERFACE",
    state:"AVAILABLE_CONFIGURED",operations:OPERATIONS[id],details:{}}))};
 },runApproved:async x=>{operations++;return {version:V51,...x,state:"completed",result:{ok:true}}}};
 const app=createFial51Hub({adapters:fakeAdapters,fetchImpl:fixtureFetch,
  evidence:async()=>({raw_content_persisted:false}),
  readWidget:async()=>"(function(){})()"});
 await new Promise(r=>app.server.listen(0,"127.0.0.1",r));
 const port=app.server.address().port;
 async function request(path,{method="GET",origin=null,approve=false,
  body=null,host="127.0.0.1:8805"}={}){
  return await new Promise((resolve,reject)=>{
   const headers={host};
   if(origin)headers.origin=origin;
   if(approve)headers["x-fi-fial-operator"]="approved-exact-action";
   if(body!==null){headers["content-type"]="application/json";
    headers["content-length"]=String(Buffer.byteLength(body))}
   const req=http.request({hostname:"127.0.0.1",port,path,method,headers},res=>{
    const parts=[];res.on("data",part=>parts.push(part));
    res.on("end",()=>resolve({status:res.statusCode,
     text:Buffer.concat(parts).toString("utf8")}));
   });
   req.on("error",reject);req.end(body===null?undefined:body);
  });
 }
 try{
  const h=await request("/api/fial/modules/health");
  assert.equal(h.status,200);
  assert.match(h.text,/fial5\.1-integrated-hub-v1/);
  assert.equal((await request("/")).status,200);
  const auth={method:"POST",origin:"http://127.0.0.1:8805",approve:true};
  assert.equal((await request("/api/fial/modules/operation",{
   method:"POST",body:"{}"})).status,403);
  assert.equal((await request("/api/fial/modules/operation",{
   ...auth,origin:"https://bad.example",body:"{}"})).status,403);
  assert.equal(operations,0);
  const start=await request("/api/fial/modules/check",{...auth,body:"{}"});
  assert.equal(start.status,200);
  assert.equal(JSON.parse(start.text).real_adapters_connected,8);
  assert.equal(checks,1);assert.equal(operations,0);
  const missing=await request("/api/fial/modules/operation",{...auth,
   body:JSON.stringify({module:"security",operation:"audit_own_source",input:{}})});
  assert.equal(missing.status,422);assert.equal(operations,0);
  const clicked=await request("/api/fial/modules/operation",{...auth,
   body:JSON.stringify({approved:true,module:"security",
    operation:"audit_own_source",input:{}})});
  assert.equal(clicked.status,200);assert.equal(operations,1);
  assert.equal((await request("/api/fial/modules/status")).status,200);
  assert.equal((await request("/api/fial/modules/status",{host:"bad.example"})).status,403);
 }finally{await new Promise(r=>app.server.close(r))}
});
test("the action metadata contains all eight modules and no REA automatic permissions",()=>{
 assert.equal(IDS.length,8);
 assert.ok(!Object.values(OPERATIONS).flat().includes("rea_execute"));
 assert.ok(!Object.values(OPERATIONS).flat().includes("purchase"));
 assert.ok(!Object.values(OPERATIONS).flat().includes("send_email"));
});
