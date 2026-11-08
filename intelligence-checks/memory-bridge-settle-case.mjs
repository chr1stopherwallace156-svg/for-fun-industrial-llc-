import test from "node:test";
import assert from "node:assert/strict";
import {settleMemoryBridgeResult} from "../src/intelligence/memory.mjs";

test("successful Python bridge message resolves result as second callback argument",async()=>{
 const actual=await new Promise((resolve,reject)=>{
  const finish=(error,result)=>error?reject(error):resolve(result);
  settleMemoryBridgeResult(finish,"recall",0,{ok:true,state:"retrieved",results:["note"],generatedAnswer:false});
 });
 assert.deepEqual(actual,{engine:"cognee",action:"recall",ok:true,state:"retrieved",results:["note"],generatedAnswer:false});
});

test("successful remember response resolves instead of becoming a plain-object rejection",async()=>{
 const actual=await new Promise((resolve,reject)=>{
  const finish=(error,result)=>error?reject(error):resolve(result);
  settleMemoryBridgeResult(finish,"remember",0,{ok:true,state:"stored",dataset:"fun_industrial_operator_memory"});
 });
 assert.equal(actual.state,"stored");
 assert.equal(actual.action,"remember");
});

test("Python error result rejects with native Error rather than plain object",async()=>{
 await assert.rejects(
  new Promise((resolve,reject)=>settleMemoryBridgeResult((error,result)=>error?reject(error):resolve(result),"recall",1,{ok:false,error:"ValueError: model not ready"})),
  error=>error instanceof Error&&error.message.includes("COGNEE_OPERATION_FAILED:ValueError:")
 );
});

test("nonzero exit code rejects even if payload claimed success",async()=>{
 await assert.rejects(
  new Promise((resolve,reject)=>settleMemoryBridgeResult((error,result)=>error?reject(error):resolve(result),"recall",9,{ok:true})),
  /COGNEE_OPERATION_FAILED:9/
 );
});
