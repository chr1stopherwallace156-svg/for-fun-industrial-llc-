import test from "node:test";import assert from "node:assert/strict";import {loadConfig} from "../src/config.mjs";import {createPlatform} from "../src/platform.mjs";
test("defaults are loopback and integrations disabled",()=>{const c=loadConfig({});assert.equal(c.host,"127.0.0.1");assert.equal(c.rea.enabled,false);assert.equal(c.netbird.enabled,false);});
test("rejects wildcard binding",()=>{assert.throws(()=>loadConfig({HOST:"0.0.0.0"}),/loopback-only/);});
test("disabled adapters do not imply external service readiness",async()=>{const p=createPlatform(loadConfig({}));const x=await p.start();assert.equal(x.status.lifecycle,"ready");assert.ok(x.status.services.every(s=>s.state==="disabled"));const y=await p.stop();assert.equal(y.status.lifecycle,"stopped");});
