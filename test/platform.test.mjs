import test from "node:test";
import assert from "node:assert/strict";
import {loadConfig} from "../src/config.mjs";
import {createPlatform} from "../src/platform.mjs";
import {createNetbirdAdapter} from "../src/adapters/netbird.mjs";

test("defaults are loopback and VPN-gated integrations fail closed",()=>{
 const config=loadConfig({});
 assert.equal(config.host,"127.0.0.1");
 assert.equal(config.vpnRequired,true);
 assert.equal(config.vpnRequireExitNode,true);
 assert.equal(config.rea.enabled,false);
 assert.equal(config.netbird.enabled,true);
 assert.equal(config.netbird.autoConnect,true);
 assert.equal(config.compute.enabled,false);
 assert.equal(config.compute.port,8790);
});
test("rejects wildcard binding",()=>assert.throws(()=>loadConfig({HOST:"0.0.0.0"}),/loopback-only/));
test("rejects invalid port values",()=>assert.throws(()=>loadConfig({PORT:"70000"}),/valid TCP port/));
test("disabled integrations remain idle and do not imply readiness",async()=>{
 const platform=createPlatform(loadConfig({NETBIRD_ENABLED:"false",NETBIRD_AUTOCONNECT:"false",COMPUTE_ENABLED:"false",AI_ENABLED:"false",REA_ENABLED:"false"}));
 const started=await platform.start();
 assert.equal(started.status.lifecycle,"idle");
 assert.ok(started.status.services.every(service=>service.state==="disabled"));
 const stopped=await platform.stop();
 assert.equal(stopped.status.lifecycle,"stopped");
});
test("disabled NetBird adapter never attempts VPN mutation",async()=>{
 const adapter=createNetbirdAdapter({enabled:false,autoConnect:false,command:"netbird"});
 assert.equal((await adapter.start()).state,"disabled");
 assert.equal((await adapter.connect()).state,"disabled");
 assert.equal((await adapter.disconnect()).state,"disabled");
 assert.equal((await adapter.health()).state,"disabled");
});

test("NetBird VPN connect and disconnect use explicit CLI commands",async()=>{
 const calls=[];
 let statusCalls=0;const runner=async(command,args)=>{calls.push(args);if(args[0]==="status"){statusCalls++;return {ok:true,stdout:statusCalls===1?"Daemon status: Disconnected":"Daemon status: Connected"};}return {ok:true,stdout:""};};
 const adapter=createNetbirdAdapter({enabled:true,autoConnect:false,command:"netbird"},runner);
 const connected=await adapter.connect();
 assert.equal(connected.state,"connected");
 assert.deepEqual(calls,[["status","-d"],["up"],["status","-d"]]);
 const disconnected=await adapter.disconnect();
 assert.equal(disconnected.state,"disconnected");
 assert.deepEqual(calls[3],["down"]);
});

test("NetBird startup observes status without issuing an up command",async()=>{
 const calls=[];
 const adapter=createNetbirdAdapter({enabled:true,autoConnect:true,command:"netbird"},async(command,args)=>{calls.push(args);return {ok:true,stdout:"Daemon status: Disconnected"};});
 assert.equal((await adapter.start()).state,"disconnected");
 assert.deepEqual(calls,[["status","-d"]]);
});

test("NetBird status parser recognizes a disconnected daemon",async()=>{
 const adapter=createNetbirdAdapter({enabled:true,autoConnect:false,command:"netbird"},async()=>({ok:true,stdout:"Daemon status: Disconnected"}));
 assert.equal((await adapter.health()).state,"disconnected");
});
