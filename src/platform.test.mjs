import test from "node:test";
import assert from "node:assert/strict";
import {createPlatform} from "./platform.mjs";
function fixtures(){
 let exitNodeRoute=false,computeStarted=0,computeStopped=0,aiStarted=0,aiStopped=0,reaStarted=0,reaStopped=0,calls=0;
 const vpn={id:"netbird",name:"NetBird VPN",start:async()=>({state:"connected"}),connect:async()=>({state:"connected"}),health:async()=>({state:"connected",exitNodeRoute,detail:"fixture VPN"}),stop:async()=>({state:"not-controlled"})};
 const compute={id:"compute",name:"Compute",start:async()=>{computeStarted++;return {state:"running"};},health:async()=>({state:computeStarted>computeStopped?"running":"stopped"}),stop:async()=>{computeStopped++;return {state:"stopped"};}};
 const ai={id:"ai",name:"AI",start:async()=>{aiStarted++;return {state:"ready"};},health:async()=>({state:aiStarted>aiStopped?"ready":"not-configured"}),stop:async()=>{aiStopped++;return {state:"stopped"};}};
 const rea={id:"rea",name:"REA MCP",start:async()=>{reaStarted++;return {state:"ready"};},health:async()=>({state:reaStarted>reaStopped?"ready":"stopped"}),stop:async()=>{reaStopped++;return {state:"stopped"};},tools:()=>[{name:"safe_read",inputSchema:{}},{name:"unsafe_write",inputSchema:{}}],callTool:async(name,args)=>{calls++;return {name,args};}};
 const config={vpnRequired:true,vpnRequireExitNode:true,netbird:{},compute:{},ai:{},rea:{enabled:true,allowedTools:["safe_read"]}};
 return {platform:createPlatform(config,{vpn,compute,ai,rea}),setRoute:value=>{exitNodeRoute=value;},counts:()=>({computeStarted,computeStopped,aiStarted,aiStopped,reaStarted,reaStopped,calls})};
}
test("platform blocks every functional service until NetBird advertises the required exit-node route",async()=>{
 const f=fixtures();const result=await f.platform.start();
 assert.equal(result.results.find(x=>x.id==="compute").state,"blocked");
 assert.equal(result.results.find(x=>x.id==="ai").state,"blocked");
 assert.equal(result.results.find(x=>x.id==="rea").state,"blocked");
 assert.deepEqual(f.counts(),{computeStarted:0,computeStopped:0,aiStarted:0,aiStopped:0,reaStarted:0,reaStopped:0,calls:0});
});
test("REA allowlist works; status is observational and explicit VPN enforcement stops services",async()=>{
 const f=fixtures();f.setRoute(true);await f.platform.start();
 assert.deepEqual((await f.platform.reaTools()).map(x=>x.name),["safe_read"]);
 await assert.rejects(()=>f.platform.callReaTool("unsafe_write",{}),/not explicitly allowlisted/);
 await f.platform.callReaTool("safe_read",{path:"fixture"});
 assert.equal(f.counts().calls,1);
 f.setRoute(false);const status=await f.platform.status();
 assert.equal(status.services.find(x=>x.id==="compute").state,"blocked");
 assert.equal(status.services.find(x=>x.id==="ai").state,"blocked");
 assert.equal(status.services.find(x=>x.id==="rea").state,"blocked");
 assert.deepEqual(f.counts(),{computeStarted:1,computeStopped:0,aiStarted:1,aiStopped:0,reaStarted:1,reaStopped:0,calls:1});
 await f.platform.enforceVpnPolicy();
 assert.deepEqual(f.counts(),{computeStarted:1,computeStopped:1,aiStarted:1,aiStopped:1,reaStarted:1,reaStopped:1,calls:1});
});
