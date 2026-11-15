import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bidReadinessContextForQwen} from '../src/bid-readiness/readiness-qwen-v5-12.mjs';
test('unrelated ordinary question adds no bid context',async()=>{
 assert.equal(await bidReadinessContextForQwen('How should a Python regular expression be written?'),'')
});
test('specific EV fleet bid question gets dated source, hard qualifications and zero contracts',async()=>{
 const r=await bidReadinessContextForQwen('Can Elektron bid on Long Beach EVSE charging construction?');
 assert.match(r,/Class B\/C-10/);
 assert.match(r,/UNVERIFIED/);
 assert.match(r,/Fleet Services EV Charging Depot/);
 assert.match(r,/Verified bid-ready opportunities: ZERO/);
 assert.match(r,/do not invent|do not treat|Never treat/i);
 assert.ok(r.length<=3000);
});
test('Qwen adds only bounded local context and retains one no-tool model invocation',async()=>{
 const code=await readFile(new URL('../src/fial/grounded-chat-v5-2.mjs',import.meta.url),'utf8');
 assert.match(code,/bidReadinessContextForQwen/);
 assert.match(code,/enable_thinking:false/);
 assert.match(code,/model_invocations:1/);
 assert.match(code,/rea_executions:0/);
 assert.doesNotMatch(code,/tool_choice:\s*['"]auto['"]|api\/rea\/execute/);
});
