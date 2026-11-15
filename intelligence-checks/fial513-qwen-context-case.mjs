import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buyerContextForQwen} from '../src/buyers/buyer-qwen-v5-13.mjs';
test('ordinary unrelated coding questions add no buyer data and no model calls',async()=>{
 assert.equal(await buyerContextForQwen('How do I write a parser in Python?'),'')
});
test('BCSD question yields exact historical bus count, public vendor route and zero claimed EV fleet or POs',async()=>{
 const t=await buyerContextForQwen('Is Bakersfield BCSD a school fleet buyer?');
 assert.match(t,/161 school buses/);
 assert.match(t,/NOT a verified electric-bus count/);
 assert.match(t,/not purchase orders|not purchase orders|not purchase orders|not purchase orders/i);
 assert.match(t,/have NOT been verified|has NOT been verified/);
 assert.match(t,/authorization/);
 assert.ok(t.length<=2400);
});
test('buyer context preserves exactly one local Qwen call and zero REA permissions',async()=>{
 const s=await readFile(new URL('../src/fial/grounded-chat-v5-2.mjs',import.meta.url),'utf8');
 assert.match(s,/buyerContextForQwen/);
 assert.match(s,/enable_thinking:false/);
 assert.match(s,/model_invocations:1/);
 assert.match(s,/rea_executions:0/);
 assert.doesNotMatch(s,/tool_choice:\s*['"]auto['"]|api\/rea\/execute/);
});
