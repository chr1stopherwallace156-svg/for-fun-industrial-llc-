import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function ps(){return readFile(new URL('../scripts/Install-FunIndustrial-AiderCoding.ps1',import.meta.url))}
test('Windows installer is strictly ASCII and uses parser-friendly syntax',async()=>{
 const b=await ps();
 assert.ok(b.every(x=>x<=127),'installer must not contain non-ASCII bytes on Windows PowerShell 5.1');
});
test('isolated candidate tests and source backups precede active dashboard process stop',async()=>{
 const s=(await ps()).toString('utf8');
 const test=s.indexOf("'ISOLATED_CODING_TESTS_FAILED'");
 const backup=s.indexOf("Copy-Item -LiteralPath $agent -Destination");
 const npm=s.indexOf("'ACTIVE_REGRESSION_FAILED'");
 const stop=s.indexOf('Stop-Process -Id $oldProcess.ProcessId');
 assert.ok(test>0&&backup>test&&npm>backup&&stop>npm);
 assert.ok(s.includes('AIDER_CODING_SOURCE_QUALIFIED BACKUP='));
 assert.ok(s.includes('AIDER_CODING_READY=PASS'));
 assert.ok(s.includes('Restore-Source'));
});
test('REA activation precedes unified/coding status verification',async()=>{
 const s=(await ps()).toString('utf8');
 const active=s.indexOf('RESTART_ONLY_DASHBOARD_PID=');
 const rea=s.indexOf('Invoke-RestMethod "$base/api/rea/start"',active);
 const unified=s.indexOf('Invoke-RestMethod "$base/api/unified/status"',active);
 const coding=s.indexOf('Invoke-RestMethod "$base/api/unified/coding/status"',active);
 assert.ok(active>0&&rea>active&&unified>rea&&coding>unified);
});
test('unified coding bridge does not create a new listener or auto-start Aider',async()=>{
 const s=await readFile(new URL('../src/unified-agent.mjs',import.meta.url),'utf8');
 assert.ok(s.includes('import {createCodingAgent} from "./coding-agent.mjs";'));
 assert.ok(s.includes('const coding=createCodingAgent('));
 assert.ok(s.includes('endpoint.startsWith("/api/unified/coding/")'));
 assert.ok(!s.includes('coding.start('));
});
test('iPhone coding UI requires separate affirmative approval for edits and tests',async()=>{
 const s=await readFile(new URL('../public/unified-control-center.html',import.meta.url),'utf8');
 assert.ok(s.includes('offerIsolatedCoding(content,result.code_files)'));
 assert.ok(s.includes('api(\'/api/unified/coding/intent\''));
 assert.ok(s.includes('api(\'/api/unified/coding/approve\','));
 assert.ok(s.includes('api(\'/api/unified/coding/test\','));
 assert.ok(s.includes('Approve isolated Aider edit'));
 assert.ok(s.includes('Approve isolated node --test'));
});

test('503 unified preflight recovers REA before touching active source',async()=>{
 const s=(await ps()).toString('utf8');
 const status=s.indexOf('Invoke-RestMethod "$base/api/status"');
 const initial=s.indexOf('try{$before=Invoke-RestMethod "$base/api/unified/status"');
 const catalog=s.indexOf('Invoke-RestMethod "$base/api/rea/tools"');
 const recovery=s.indexOf('Invoke-RestMethod "$base/api/rea/start"',initial);
 const retry=s.indexOf('try{$before=Invoke-RestMethod "$base/api/unified/status"',recovery);
 const backup=s.indexOf('Copy-Item -LiteralPath $agent -Destination');
 assert.ok(status>=0&&initial>status&&catalog>initial&&recovery>catalog&&retry>recovery&&backup>retry);
 assert.ok(s.includes('REA_PREFLIGHT_RECOVERY_FAILED_BEFORE_SOURCE_EDITS'));
 assert.ok(s.includes('UNIFIED_STATUS_STILL_UNAVAILABLE_BEFORE_SOURCE_EDITS'));
 assert.ok(s.includes('AIDER_BASELINE_READY=PASS'));
});
