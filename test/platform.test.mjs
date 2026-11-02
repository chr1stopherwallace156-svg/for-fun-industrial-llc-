import test from "node:test";
import assert from "node:assert/strict";
import {loadConfig} from "../src/config.mjs";
import {createPlatform} from "../src/platform.mjs";
import {createNetbirdAdapter} from "../src/adapters/netbird.mjs";

test("defaults are loopback and integrations disabled",()=>{
 const config=loadConfig({});
 assert.equal(config.host,"127.0.0.1");
 assert.equal(config.rea.enabled,false);
 assert.equal(config.netbird.enabled,false);
 assert.equal(config.netbird.autoConnect,false);
 assert.equal(config.compute.enabled,false);
 assert.equal(config.compute.port,8790);
});
test("rejects wildcard binding",()=>assert.throws(()=>loadConfig({HOST:"0.0.0.0"}),/loopback-only/));
test("rejects invalid port values",()=>assert.throws(()=>loadConfig({PORT:"70000"}),/valid TCP port/));
test("disabled integrations do not imply platform readiness",async()=>{
 const platform=createPlatform(loadConfig({}));
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
 const runner=async(command,args)=>{calls.push(args);if(args[0]==="status")return {ok:true,stdout:"Daemon status: Connected"};return {ok:true,stdout:""};};
 const adapter=createNetbirdAdapter({enabled:true,autoConnect:false,command:"netbird"},runner);
 const connected=await adapter.connect();
 assert.equal(connected.state,"connected");
 assert.deepEqual(calls,[["up"],["status","-d"]]);
 const disconnected=await adapter.disconnect();
 assert.equal(disconnected.state,"disconnected");
 assert.deepEqual(calls[2],["down"]);
});

test("NetBird status parser recognizes a disconnected daemon",async()=>{
 const adapter=createNetbirdAdapter({enabled:true,autoConnect:false,command:"netbird"},async()=>({ok:true,stdout:"Daemon status: Disconnected"}));
 assert.equal((await adapter.health()).state,"disconnected");
});
