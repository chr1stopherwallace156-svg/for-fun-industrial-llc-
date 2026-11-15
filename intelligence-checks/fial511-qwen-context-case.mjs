import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {commercialFitContextForQwen} from '../src/fit/commercial-fit-qwen-v5-11.mjs';
test('unrelated request produces zero fit retrieval context',async()=>{
 assert.equal(await commercialFitContextForQwen('How to parse a regular expression in Python?'),'')
});
test('real EV charging context discloses original sources, licensing gap and no awarded contract',async()=>{
 const r=await commercialFitContextForQwen('Is Morgan Hill EV charging contract a commercial fit?');
 assert.match(r,/Morgan Hill/);assert.match(r,/NOT VERIFIED/);
 assert.match(r,/not purchase orders/);
 assert.match(r,/No verified eligible bids/);
 assert.match(r,/GFO-25-603/);
 assert.ok(r.length<=3400);
});
test('unchanged Qwen request has zero tool definitions and one model invocation',async()=>{
 const s=await readFile(new URL('../src/fial/grounded-chat-v5-2.mjs',import.meta.url),'utf8');
 assert.match(s,/commercialFitContextForQwen/);
 assert.match(s,/enable_thinking:false/);
 assert.match(s,/model_invocations:1/);
 assert.match(s,/rea_executions:0/);
 assert.doesNotMatch(s,/tool_choice:\s*['"]auto['"]|api\/rea\/execute|rea_allowed_tools/);
});
