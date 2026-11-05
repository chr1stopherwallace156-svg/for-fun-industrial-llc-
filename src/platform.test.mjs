import test from "node:test";
import assert from "node:assert/strict";
import {createPlatform} from "./platform.mjs";
import {parseNetbirdStatus} from "./adapters/netbird.mjs";
import {loadConfig} from "./config.mjs";
function fixtures(options={}){
 let exitNodeRoute=false,vpnConnected=options.vpnConnected!==false,computeStarted=0,computeStopped=0,aiStarted=0,aiStopped=0,reaStarted=0,reaStopped=0,calls=0;
 const vpn={id:"netbird",name:"NetBird VPN",start:async()=>({state:"connected"}),connect:async()=>({state:"connected"}),health:async()=>({state:vpnConnected?"connected":"disconnected",exitNodeRoute,detail:"fixture VPN"}),stop:async()=>({state:"not-controlled"})};
 const compute={id:"compute",name:"Compute",start:async()=>{computeStarted++;return {state:"running"};},health:async()=>({state:computeStarted>computeStopped?"running":"stopped"}),stop:async()=>{computeStopped++;return {state:"stopped"};}};
 const ai={id:"ai",name:"AI",start:async()=>{aiStarted++;return {state:"ready"};},health:async()=>({state:aiStarted>aiStopped?"ready":"not-configured"}),stop:async()=>{aiStopped++;return {state:"stopped"};}};
 const rea={id:"rea",name:"REA MCP",start:async()=>{reaStarted++;return {state:"ready"};},health:async()=>({state:reaStarted>reaStopped?"ready":"stopped"}),stop:async()=>{reaStopped++;return {state:"stopped"};},tools:()=>[{name:"safe_read",inputSchema:{}},{name:"unsafe_write",inputSchema:{}}],callTool:async(name,args)=>{calls++;return {name,args};}};
 const config={localFirstMode:options.localFirst===true,vpnRequired:options.localFirst?false:true,vpnRequireExitNode:options.localFirst?false:true,vpnExitNodeRole:options.role||"consumer",netbirdProviderConfigConfirmed:options.providerConfirmed===true,netbirdIphoneRouteVerified:options.iphoneVerified===true,netbird:{},compute:{},ai:{},rea:{enabled:true,allowedTools:["safe_read"]}};
 return {platform:createPlatform(config,{vpn,compute,ai,rea}),setRoute:value=>{exitNodeRoute=value;},counts:()=>({computeStarted,computeStopped,aiStarted,aiStopped,reaStarted,reaStopped,calls})};
}
test("LOCAL_FIRST_MODE defaults on and overrides legacy VPN exit-node requirements",()=>{const config=loadConfig({VPN_REQUIRED:"true",VPN_REQUIRE_EXIT_NODE:"true"});assert.equal(config.localFirstMode,true);assert.equal(config.vpnRequired,false);assert.equal(config.vpnRequireExitNode,false);assert.equal(config.rea.requiresVpn,false);const strict=loadConfig({LOCAL_FIRST_MODE:"false",VPN_REQUIRED:"true",VPN_REQUIRE_EXIT_NODE:"true"});assert.equal(strict.localFirstMode,false);assert.equal(strict.vpnRequired,true);assert.equal(strict.vpnRequireExitNode,true);});
test("local-first starts REA and compute without a connected NetBird route",async()=>{const f=fixtures({localFirst:true,vpnConnected:false});const result=await f.platform.start();assert.equal(result.results.find(x=>x.id==="compute").state,"running");assert.equal(result.results.find(x=>x.id==="ai").state,"ready");assert.equal(result.results.find(x=>x.id==="rea").state,"ready");assert.equal(result.status.vpn_policy.required,false);assert.equal(result.status.vpn_policy.state,"independent");assert.equal(result.status.lifecycle,"ready");assert.equal((await f.platform.reaCatalog()).length,2);assert.deepEqual(await f.platform.reaTools(),["safe_read"].map(name=>({name,description:undefined,inputSchema:{}})));assert.deepEqual(await f.platform.reaTools().then(x=>x.map(t=>t.name)),["safe_read"]);});
test("consumer role blocks every functional service until NetBird advertises the required exit-node route",async()=>{
 const f=fixtures();const result=await f.platform.start();
 assert.equal(result.results.find(x=>x.id==="compute").state,"blocked");
 assert.equal(result.results.find(x=>x.id==="ai").state,"blocked");
 assert.equal(result.results.find(x=>x.id==="rea").state,"blocked");
 assert.deepEqual(f.counts(),{computeStarted:0,computeStopped:0,aiStarted:0,aiStopped:0,reaStarted:0,reaStopped:0,calls:0});
});
test("provider role requires both confirmations and does not require Windows to consume its own default route",async()=>{const unconfirmed=fixtures({role:"provider",providerConfirmed:true,iphoneVerified:false});const blocked=await unconfirmed.platform.start();assert.equal(blocked.results.find(x=>x.id==="compute").state,"blocked");assert.equal(blocked.status.vpn_policy.exit_node_role,"provider");assert.equal(blocked.status.vpn_policy.iphone_route_operator_verified,false);const confirmed=fixtures({role:"provider",providerConfirmed:true,iphoneVerified:true});const ready=await confirmed.platform.start();assert.equal(ready.results.find(x=>x.id==="compute").state,"running");assert.equal(ready.results.find(x=>x.id==="ai").state,"ready");assert.equal(ready.results.find(x=>x.id==="rea").state,"ready");assert.equal(ready.status.vpn_policy.state,"connected");});
test("NetBird parser recognizes hostname-style and legacy peer blocks",()=>{const hostname="Daemon status: Connected\nPeers detail:\n iphone.example.net:\n  Status: Connected\n  Networks: 0.0.0.0/0\n";assert.deepEqual(parseNetbirdStatus(hostname),{connected:true,exitNodeRoute:true});const legacy="Daemon status: Connected\nPeer: iphone.example.net\n Status: Connected\n Networks: 0.0.0.0/0\n";assert.deepEqual(parseNetbirdStatus(legacy),{connected:true,exitNodeRoute:true});});
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
