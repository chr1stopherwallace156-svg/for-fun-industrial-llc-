import test from 'node:test';
import assert from 'node:assert/strict';
import {fleetContextForQwen} from '../src/fleet/fleet-qwen-v5-9.mjs';
import {readFile} from 'node:fs/promises';
test('unrelated prompts skip fleet lookup entirely and inject no extra instructions',async()=>{
 assert.equal(await fleetContextForQwen('How can I improve a Python regex?'),'');
});
test('Qwen sees only dated ZESBI evidence and no invented purchasing or model permissions',async()=>{
 const s=await fleetContextForQwen('Which Victorville school district bus fleet is a ZESBI prospect?');
 assert.match(s,/Victor Valley Union High School District/);
 assert.match(s,/6 historically listed buses/);
 assert.match(s,/3 historically listed chargers/);
 assert.match(s,/current open bid not verified/);
 assert.match(s,/does not use old first-solicitation priority tiers/);
 assert.doesNotMatch(s,/B20260233096|13479 Abbot|elektronindustrial@gmail.com/);
 assert.ok(s.length<=2600);
});
test('Qwen existing grounded one-call path uses fleet context without changing the authority controls',async()=>{
 const src=await readFile(new URL('../src/fial/grounded-chat-v5-2.mjs',import.meta.url),'utf8');
 assert.match(src,/fleetContextForQwen/);
 assert.match(src,/regulatoryContextForQwen/);
 assert.match(src,/enable_thinking:false/);
 assert.match(src,/tool_executions:0/);
 assert.match(src,/rea_executions:0/);
 assert.doesNotMatch(src,/api\/rea\/call|api\/tools\/execute|tool_choice:\s*['"]auto['"]/);
});
