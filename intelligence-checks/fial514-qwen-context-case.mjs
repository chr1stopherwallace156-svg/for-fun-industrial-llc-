import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {purchaseDemandContextForQwen} from '../src/demand/demand-qwen-v5-14.mjs';
test('unrelated coding question avoids purchasing-demand context',async()=>{
 assert.equal(await purchaseDemandContextForQwen('How do I write a Python regex?'),'')
});
test('VVTA topic gets dated separate maintenance intent, license limitation and no awarded bid',async()=>{
 const r=await purchaseDemandContextForQwen('What does VVTA hydrogen bus maintenance procurement mean for Elektron?');
 assert.match(r,/VVTA|Victor Valley Transit Authority/);
 assert.match(r,/California Class A or B/);
 assert.match(r,/SEPARATELY/);
 assert.match(r,/ZERO eligible ELEKTRON bids/);
 assert.match(r,/no.*contract|not.*contract|no.*orders|ZERO eligible/i);
 assert.ok(r.length<=2400)
});
test('Qwen main path continues one local model call, no REA or external tool schema',async()=>{
 const src=await readFile(new URL('../src/fial/grounded-chat-v5-2.mjs',import.meta.url),'utf8');
 assert.match(src,/purchaseDemandContextForQwen/);
 assert.match(src,/enable_thinking:false/);
 assert.match(src,/model_invocations:1/);
 assert.match(src,/rea_executions:0/);
 assert.doesNotMatch(src,/api\/rea\/execute|tool_choice:\s*['"]auto['"]/);
});
