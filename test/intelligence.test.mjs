import test from "node:test";
import assert from "node:assert/strict";
import {evaluateSituation,normalizeFacts,policySummary} from "../src/intelligence/rules.mjs";
import {memoryStatus,memoryAction} from "../src/intelligence/memory.mjs";
const ready={mode:"propose",risk_level:"low",emergency_stop:false,source_trusted:true,context_complete:true,service_ready:true,evidence_verified:true};
test("situational engine truly uses json-rules-engine and is independent of LLM",async()=>{
 const s=policySummary();assert.equal(s.engine,"json-rules-engine");assert.equal(s.sideEffects,false);
 const result=await evaluateSituation(ready);
 assert.equal(result.decision,"PROPOSE_FOR_OPERATOR_REVIEW");
 assert.equal(result.executeAuthorized,false);
});
test("safe observation does not permit action even with operator_approved claim",async()=>{
 const result=await evaluateSituation({...ready,mode:"observe",operator_approved:true});
 assert.equal(result.decision,"OBSERVE_BOUNDED");
 assert.equal(result.executeAuthorized,false);assert.equal(result.reaToolsExecuted,0);
});
test("all execution attempts are held, including REA",async()=>{
 for(const facts of [{...ready,mode:"execute"},{...ready,mode:"execute",rea_tool_requested:true}]){
  const r=await evaluateSituation(facts);
  assert.match(r.decision,/^HOLD_/);assert.equal(r.executeAuthorized,false);
 }
});
test("unknown risk, untrusted sources and missing evidence fail closed",async()=>{
 for(const facts of [{},{...ready,risk_level:"unknown"},{...ready,source_trusted:false},{...ready,evidence_verified:false},{...ready,context_complete:false},{...ready,service_ready:false},{...ready,emergency_stop:true}]){
  const r=await evaluateSituation(facts);assert.match(r.decision,/^HOLD_/);
 }
});
test("inputs reject nonboolean, arbitrary variables and invalid mode",()=>{
 assert.throws(()=>normalizeFacts({source_trusted:"yes"}),/BOOLEAN_FACT/);
 assert.throws(()=>normalizeFacts({script:"open shell"}),/UNKNOWN_FACTS/);
 assert.throws(()=>normalizeFacts({mode:"admin"}),/MODE_NOT_ALLOWED/);
 assert.throws(()=>normalizeFacts(null),/FACTS_OBJECT_REQUIRED/);
});
test("Cognee defaults off and never starts its Python process during status",async()=>{
 const s=memoryStatus();assert.equal(s.engine,"cognee");assert.equal(s.automaticIngestion,false);assert.equal(s.cloudLLMConfigured,false);
 if(!s.enabled)await assert.rejects(memoryAction("remember",{text:"hello"}),/COGNEE_NOT_ENABLED/);
});
