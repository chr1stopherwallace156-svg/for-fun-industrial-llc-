import test from "node:test";
import assert from "node:assert/strict";
import {createAutonomyActivator} from "../src/autonomy-activation.mjs";

const fixed="C:\\Users\\test\\AppData\\Local\\FunIndustrial\\AutonomyLab\\autonomy-v2-github\\Start.ps1";
const offline=async()=>{throw Error("ECONNREFUSED")};

test("running worker is not launched again", async()=>{
 let launches=0;
 const activator=createAutonomyActivator({health:async()=>({state:"running",pid:24044}),launch:async()=>{launches++},os:"win32",localAppData:"C:\\Users\\test\\AppData\\Local"});
 const r=await activator.activate();
 assert.deepEqual(r,{state:"running",pid:24044,action:"already_running"});
 assert.equal(launches,0);
});
test("recover a stopped installed worker using only the fixed script",async()=>{
 let running=false,called;
 const a=createAutonomyActivator({
  health:async()=>{if(!running)return offline();return {state:"running",pid:9820}},
  fileExists:p=>p===fixed,
  launch:async p=>{called=p;running=true},
  os:"win32",localAppData:"C:\\Users\\test\\AppData\\Local"
 });
 const r=await a.activate();
 assert.equal(called,fixed);
 assert.deepEqual(r,{state:"running",pid:9820,action:"started"});
});
test("missing installation cannot launch a command",async()=>{
 let launches=0;
 const a=createAutonomyActivator({health:offline,fileExists:()=>false,launch:async()=>{launches++},os:"win32",localAppData:"C:\\Users\\test\\AppData\\Local"});
 const r=await a.activate();
 assert.equal(r.state,"unavailable");assert.equal(r.action,"not_installed");assert.equal(launches,0);
});
test("failed launch reports partial failure rather than a false success",async()=>{
 const a=createAutonomyActivator({health:offline,fileExists:()=>true,launch:async()=>{throw Error("SIMULATED_LAUNCH_FAILURE")},os:"win32",localAppData:"C:\\Users\\test\\AppData\\Local"});
 const r=await a.activate();
 assert.equal(r.state,"unavailable");assert.equal(r.action,"start_failed");assert.match(r.detail,/SIMULATED_LAUNCH_FAILURE/);
});
test("concurrent clicks launch only once",async()=>{
 let launches=0,running=false;
 const a=createAutonomyActivator({
  health:async()=>running?{state:"running",pid:22000}:offline(),
  fileExists:()=>true,
  launch:async()=>{launches++;await new Promise(resolve=>setTimeout(resolve,25));running=true},
  os:"win32",localAppData:"C:\\Users\\test\\AppData\\Local"
 });
 const [one,two,three]=await Promise.all([a.activate(),a.activate(),a.activate()]);
 assert.equal(launches,1);
 assert.equal(one.state,"running");assert.deepEqual(one,two);assert.deepEqual(two,three);
});
test("invalid health payload never claims availability",async()=>{
 const a=createAutonomyActivator({health:async()=>({state:"running",pid:0}),fileExists:()=>false,os:"win32",localAppData:"C:\\Users\\test\\AppData\\Local"});
 const r=await a.status();assert.equal(r.state,"unavailable");
});
