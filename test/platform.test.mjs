import test from "node:test";
import assert from "node:assert/strict";
import {loadConfig} from "../src/config.mjs";
import {createPlatform} from "../src/platform.mjs";

test("defaults are loopback and integrations disabled",()=>{
  const config=loadConfig({});
  assert.equal(config.host,"127.0.0.1");
  assert.equal(config.rea.enabled,false);
  assert.equal(config.netbird.enabled,false);
});

test("rejects wildcard binding",()=>{
  assert.throws(()=>loadConfig({HOST:"0.0.0.0"}),/loopback-only/);
});

test("does not claim ready when all integrations are disabled",async()=>{
  const platform=createPlatform(loadConfig({}));
  const started=await platform.start();
  assert.equal(started.status.lifecycle,"idle");
  assert.ok(started.status.services.every(service=>service.state==="disabled"));
  const stopped=await platform.stop();
  assert.equal(stopped.status.lifecycle,"stopped");
});

test("rejects invalid port values",()=>{
  assert.throws(()=>loadConfig({PORT:"70000"}),/valid TCP port/);
});
