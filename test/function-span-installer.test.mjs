import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('installer refuses source drift before stopping any service',async()=>{
 const code=await readFile(new URL('../scripts/Upgrade-FunIndustrial-FunctionSpan.ps1',import.meta.url),'utf8');
 const hold=code.indexOf('CODE_CONTEXT_BASELINE_DRIFT_HOLD_NO_OVERWRITE');
 const stop=code.indexOf('Stop-Process -Id $oldProcess.ProcessId');
 assert.ok(hold>=0&&stop>hold);
 assert.ok(code.includes('FUNCTION_SPAN_SOURCE_QUALIFIED BACKUP='));
});
test('unified availability is checked only after REA activation',async()=>{
 const code=await readFile(new URL('../scripts/Upgrade-FunIndustrial-FunctionSpan.ps1',import.meta.url),'utf8');
 const begin=code.indexOf('Write-Host "RESTART_ONLY_DASHBOARD_PID=');
 const rea=code.indexOf('Invoke-RestMethod "$base/api/rea/start"',begin);
 const ready=code.indexOf('Invoke-RestMethod "$base/api/unified/status"',begin);
 assert.ok(begin>=0&&rea>begin&&ready>rea);
 assert.ok(code.includes('FUNCTION_SPAN_READY=PASS'));
});

test('Windows PowerShell 5.1 entrypoint stays ASCII-only to avoid UTF-8 no-BOM parser corruption',async()=>{
 const installer=await readFile(new URL('../scripts/Upgrade-FunIndustrial-FunctionSpan.ps1',import.meta.url));
 assert.ok(installer.every(byte=>byte<=0x7F),'PowerShell entrypoint contains non-ASCII bytes without a BOM');
 assert.ok(installer.toString('utf8').includes('incomplete - verify before relying on analysis'));
});
