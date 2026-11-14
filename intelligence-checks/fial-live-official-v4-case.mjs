import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import http from "node:http";
import {refreshOfficialGrants,currentLiveStatus,createLiveController,
 compareCurrentRecord,LIVE_VERSION} from "../src/fial/live-official-v4.mjs";
import {createLiveDashboard,injectLivePanel} from "../scripts/Run-Fun-FIAL-Live-Dashboard8803.mjs";
import {SOURCE_CSV} from "../src/applications/opportunity-worker-v1.mjs";
const sha=x=>createHash("sha256").update(x).digest("hex");
const CASE="a".repeat(30);
const FIELDS=["PortalID","GrantID","Status","LastUpdated","AgencyDept","Title",
 "Purpose","Description","ApplicantType","Geography","EstAmounts","ApplicationDeadline","GrantURL"];
function dataset({status="Active",title="Civil Money Penalty Reinvestment Grant"}={}){
 const rows=Array.from({length:110},(_,i)=>({
  PortalID:String(10000+i),GrantID:String(190000+i),Status:"Closed",
  LastUpdated:"2026-11-13",AgencyDept:"California State Agency",
  Title:"Synthetic unrelated grant "+i,Purpose:"Synthetic unrelated purpose",
  Description:"No eligibility inference",ApplicantType:"Businesses",Geography:"California",
  EstAmounts:"Not specified",ApplicationDeadline:"2027-05-30",GrantURL:""}));
 rows.push({PortalID:"1647",GrantID:"1647",Status:status,LastUpdated:"2026-11-14",
  AgencyDept:"California Department of Public Health",Title:title,
  Purpose:"Grants support residents at skilled nursing facilities.",
  Description:"Long-term care quality of life",ApplicantType:"Businesses",
  Geography:"California",EstAmounts:"Not specified",ApplicationDeadline:"2027-08-31",GrantURL:""});
 return FIELDS.join(",")+"\n"+rows.map(row=>FIELDS.map(k=>{
  const x=String(row[k]||"");return /[",\r\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x
 }).join(",")).join("\n")+"\n";
}
async function fixture(dir){
 const baseline=join(dir,"fial","grounded-v4");
 const saved=join(dir,"fial","semantic-v2","cases");
 await mkdir(baseline,{recursive:true});await mkdir(saved,{recursive:true});
 const oldsha="b".repeat(64);
 const cas={case_id:CASE,grant_id:"1647",title:"Civil Money Penalty Reinvestment Grant",
  source_sha256:oldsha,source_fields:{purpose:"Old published purpose text",
   applicant_type:"Businesses",deadline:"2026-11-01"}};
 const receipt={version:"fial-grounded-review-v0.4",source_sha256:oldsha,
  network_requests:0,applications_submitted:0,
  cases:[{case_id:CASE,grant_id:"1647",title:cas.title}]};
 await writeFile(join(saved,CASE+".json"),JSON.stringify(cas));
 await writeFile(join(baseline,"last-run.json"),JSON.stringify(receipt));
}
async function withTemp(fn){
 const dir=await mkdtemp(join(tmpdir(),"fial4-live-"));
 try{await fixture(dir);await fn(dir)}finally{await rm(dir,{recursive:true,force:true})}
}
function sourceFetch(contents){
 return async(url,opts)=>{
  assert.equal(url,SOURCE_CSV);
  assert.equal(opts.method,"GET");
  assert.equal(opts.redirect,"manual");
  return new Response(contents,{status:200,headers:{"content-type":"text/csv"}});
 };
}
test("published official snapshot is fetched, hashed, persisted and recorded without external actions",async()=>withTemp(async dir=>{
 const csv=dataset();
 const receipt=await refreshOfficialGrants({directory:dir,fetchImpl:sourceFetch(Buffer.from(csv))});
 assert.equal(receipt.version,LIVE_VERSION);
 assert.equal(receipt.network_requests,1);
 assert.equal(receipt.rea_actions,0);
 assert.equal(receipt.submissions,0);
 assert.equal(receipt.money_spent,0);
 assert.equal(receipt.service_restarts,0);
 assert.equal(receipt.official_source_sha256,sha(Buffer.from(csv)));
 assert.equal(receipt.records_in_official_feed,111);
 assert.equal(receipt.cases[0].state,"OFFICIAL_PORTAL_RECORD_RETRIEVED");
 assert.ok(receipt.cases[0].baseline_differences.includes("deadline"));
 assert.equal((await readFile(receipt.saved_snapshot,"utf8")),csv);
 const status=await currentLiveStatus({directory:dir});
 assert.equal(status.company_eligibility,"UNKNOWN");
 assert.equal(status.matches,1);
 assert.equal(status.cases[0].state,"OFFICIAL_PORTAL_RECORD_RETRIEVED");
}));
test("subsequent daily feed change is detected without overwriting saved snapshot",async()=>withTemp(async dir=>{
 const old=await refreshOfficialGrants({directory:dir,fetchImpl:sourceFetch(dataset())});
 const changed=await refreshOfficialGrants({directory:dir,
  fetchImpl:sourceFetch(dataset({status:"Closed"}))});
 assert.equal(changed.cases[0].state,"OFFICIAL_PORTAL_RECORD_RETRIEVED");
 assert.ok(changed.cases[0].changed_fields.includes("Status"));
 assert.notEqual(old.saved_snapshot,changed.saved_snapshot);
 assert.match(await readFile(old.saved_snapshot,"utf8"),/Active/);
}));
test("official title mismatch and missing ID HOLD, never invent company eligibility",()=>{
 const live=[{GrantID:"1647",Title:"Changed grant title",AgencyDept:"Public agency"}];
 assert.equal(compareCurrentRecord({grant_id:"1647",title:"Old title"},live).state,
  "HOLD_OFFICIAL_RECORD_TITLE_CHANGED");
 assert.equal(compareCurrentRecord({grant_id:"163000",title:"Unknown"},live).state,
  "HOLD_ID_NOT_FOUND_IN_LIVE_FEED");
 const duplicate=[...live,...live];
 assert.equal(compareCurrentRecord({grant_id:"1647",title:"Old title"},duplicate).state,
  "HOLD_DUPLICATE_OFFICIAL_ID");
});
test("refuses redirect to unapproved domains and does not publish success",async()=>withTemp(async dir=>{
 const hostile=async()=>new Response(null,{status:302,
  headers:{location:"https://untrusted.example/leak"}});
 await assert.rejects(refreshOfficialGrants({directory:dir,fetchImpl:hostile}),
  /REDIRECT_REFUSED/);
 assert.equal((await currentLiveStatus({directory:dir})).state,"not_run");
}));
test("rejects truncated/invalid source rather than silently using old data",async()=>withTemp(async dir=>{
 await assert.rejects(refreshOfficialGrants({directory:dir,
  fetchImpl:sourceFetch("id,title\n1,test")}),/SOURCE_TOO_SMALL/);
 assert.equal((await currentLiveStatus({directory:dir})).state,"not_run");
}));
test("server panel is active, with same-origin click approval; host and bad methods refused",async()=>{
 let calls=0;
 const controller={
  status:async()=>({version:LIVE_VERSION,state:"not_run"}),
  refresh:async()=>{calls++;return {version:LIVE_VERSION,state:"LIVE_OFFICIAL_FEED_RETRIEVED",cases:[]}}
 };
 const server=createLiveDashboard({controller,
  readPage:async()=>({html:"<!doctype html><html><body><h1>Old hub</h1></body></html>",
   csp:"default-src 'self'; script-src 'self'; connect-src 'self'"}),
  readWidget:async()=>"(function(){})()",
  proxy:async(req,res)=>{res.end("proxied")}
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const port=server.address().port;
 async function request(path,{method="GET",origin=null,action=false,host="127.0.0.1:8803",body=null}={}){
  return new Promise((resolve,reject)=>{
   const headers={host};
   if(origin)headers.origin=origin;
   if(action)headers["x-fi-fial"]="operator-click";
   if(body!==null){headers["content-type"]="application/json";headers["content-length"]=String(Buffer.byteLength(body))}
   const req=http.request({hostname:"127.0.0.1",port,path,method,headers},res=>{
    const parts=[];res.on("data",x=>parts.push(x));
    res.on("end",()=>resolve({status:res.statusCode,
     text:Buffer.concat(parts).toString("utf8")}));
   });
   req.on("error",reject);req.end(body===null?undefined:body);
  });
 }
 try{
  const page=await request("/");
  assert.equal(page.status,200);assert.match(page.text,/fi-fial4-live-refresh/);
  assert.match(page.text,/Old hub/);
  const blocked=await request("/api/fial/live/refresh",{method:"POST",body:"{}"});
  assert.equal(blocked.status,403);assert.equal(calls,0);
  const denied=await request("/api/fial/live/refresh",{
   method:"POST",origin:"https://evil.example",action:true,body:"{}"});
  assert.equal(denied.status,403);assert.equal(calls,0);
  const allowed=await request("/api/fial/live/refresh",{
   method:"POST",origin:"http://127.0.0.1:8803",action:true,body:"{}"});
  assert.equal(allowed.status,200);assert.equal(calls,1);
  const status=await request("/api/fial/live/status");
  assert.equal(status.status,200);assert.match(status.text,/not_run/);
  const badHost=await request("/api/fial/live/status",{host:"evil.example"});
  assert.equal(badHost.status,403);
 }finally{await new Promise(r=>server.close(r))}
});
test("HTML insertion rejects malformed pages",()=>{
 assert.throws(()=>injectLivePanel("<html><head></head></html>"),/HTML_INVALID/);
 assert.match(injectLivePanel("<html><body>Hello</body></html>"),/fi-fial4-live/);
});
test("single-flight controller does not launch overlapping live refreshes",async()=>{
 let release,started;
 const startedPromise=new Promise(r=>started=r);
 const hold=new Promise(r=>release=r);
 const controller=createLiveController({refresh:async()=>{
  started();await hold;return {version:LIVE_VERSION,verified_at_utc:new Date().toISOString(),
   state:"LIVE_OFFICIAL_FEED_RETRIEVED",official_source:"https://publish.data.ca.gov",
   official_source_sha256:"a".repeat(64),records_in_official_feed:111,
   official_feed_record_matches:0,cases:[]};
 },status:async()=>({version:LIVE_VERSION,state:"not_run"})});
 const first=controller.refresh();await startedPromise;
 const second=await controller.refresh();
 assert.equal(second.state,"busy");release();
 assert.equal((await first).state,"LIVE_OFFICIAL_FEED_RETRIEVED");
});
