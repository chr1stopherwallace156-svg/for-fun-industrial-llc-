import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('negation repair installer is Windows PowerShell 5 compatible ASCII',async()=>{
 const bytes=await readFile(new URL('../scripts/Repair-FunIndustrial-NegatedToolIntent.ps1',import.meta.url));
 assert.ok(bytes.every(x=>x<=0x7F));
});
test('repair tests, source anchors, and source backup precede restart',async()=>{
 const s=await readFile(new URL('../scripts/Repair-FunIndustrial-NegatedToolIntent.ps1',import.meta.url),'utf8');
 const anchors=s.indexOf('NEGATION_FIX_SOURCE_ANCHOR_MISMATCH');
 const qualify=s.indexOf('ACTIVE_REGRESSION_FAILED');
 const backup=s.indexOf('Copy-Item -LiteralPath $target -Destination');
 const stop=s.indexOf('Stop-Process -Id $oldProcess.ProcessId');
 assert.ok(anchors>=0&&qualify>anchors&&backup>anchors&&stop>qualify&&stop>backup);
 assert.ok(s.includes('NEGATION_ROUTING_READY=PASS'));
});
test('REA comes before unified readiness after dashboard restart',async()=>{
 const s=await readFile(new URL('../scripts/Repair-FunIndustrial-NegatedToolIntent.ps1',import.meta.url),'utf8');
 const begin=s.indexOf('RESTART_ONLY_DASHBOARD_PID=');
 const rea=s.indexOf('Invoke-RestMethod "$base/api/rea/start"',begin);
 const unified=s.indexOf('Invoke-RestMethod "$base/api/unified/status"',begin);
 assert.ok(begin>=0&&rea>begin&&unified>rea);
});
