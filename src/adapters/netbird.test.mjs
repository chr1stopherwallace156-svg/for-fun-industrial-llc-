import test from "node:test";
import assert from "node:assert/strict";
import {parseNetbirdStatus,createNetbirdAdapter} from "./netbird.mjs";
const disconnectedExitPeer="Peers detail:\nPeer:\n  IP: 100.64.0.1\n  Status: Connected\n  Routes: 10.0.0.0/24\nPeer:\n  IP: 100.64.0.2\n  Status: Disconnected\n  Routes: 0.0.0.0/0\n";
const connectedExitPeer="Peers detail:\nPeer:\n  IP: 100.64.0.2\n  Status: Connected\n  Routes: 0.0.0.0/0\n";
test("exit-node route must belong to a connected NetBird peer",()=>{
 assert.deepEqual(parseNetbirdStatus(disconnectedExitPeer),{connected:true,exitNodeRoute:false});
 assert.deepEqual(parseNetbirdStatus(connectedExitPeer),{connected:true,exitNodeRoute:true});
});
test("NetBird adapter exposes a connected route only from its own peer block",async()=>{
 const adapter=createNetbirdAdapter({enabled:true,command:"netbird",autoConnect:false},async()=>({ok:true,stdout:disconnectedExitPeer}));
 const health=await adapter.health();
 assert.equal(health.state,"connected");
 assert.equal(health.exitNodeRoute,false);
});
