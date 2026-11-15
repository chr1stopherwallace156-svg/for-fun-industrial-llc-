import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {demandContextForQwen} from '../src/demand/demand-qwen-v5-14.mjs';
test('ordinary unrelated software question does not load buyer information',async()=>{
 assert.equal(await demandContextForQwen('Explain binary trees in Python'), '')
});
test('school fleet question explicitly distinguishes public bids from LEA program grants',async()=>{
 const r=await demandContextForQwen('What are current Bakersfield fleet purchases under ZESBI?');
 assert.match(r,/161 total school buses/);
 assert.match(r,/NOT prove zero-emission buses/);
 assert.match(r,/eligible K-12 LEAs/);
 assert.match(r,/not a contract or grant award for ELEKTRON/);
 assert.match(r,/No current eligible bid|Zero verified live school EV repair RFPs/);
 assert.ok(r.length<=2300)
});
test('existing Qwen path still exactly one model call, no REA authority',async()=>{
 const s=await readFile(new URL('../src/fial/grounded-chat-v5-2.mjs',import.meta.url),'utf8');
 assert.match(s,/demandContextForQwen/);
 assert.match(s,/enable_thinking:false/);
 assert.match(s,/model_invocations:1/);
 assert.match(s,/rea_executions:0/);
 assert.doesNotMatch(s,/tool_choice:\s*['"]auto['"]|api\/rea\/execute/)
});
