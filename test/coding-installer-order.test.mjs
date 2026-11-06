import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('coding installer starts REA before requiring unified readiness', async()=>{
 const script=await readFile(new URL('../scripts/Install-FunIndustrial-CodingContext.ps1',import.meta.url),'utf8');
 const listener=script.indexOf("if(-not $httpReady){Restore-AfterActivationFailure");
 const reaStart=script.indexOf('Invoke-RestMethod "$base/api/rea/start" -Method POST',listener);
 const unified=script.indexOf('Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45',listener);
 assert.ok(listener>=0 && reaStart>listener && unified>reaStart,'HTTP readiness must be followed by REA startup and then unified readiness');
 assert.ok(script.includes('PREVIOUS_DASHBOARD_READY=$recovered'),'rollback should report whether old dashboard recovered');
 assert.ok(script.includes('REA_ENABLED_COUNT_MISMATCH='),'deployment must verify the enabled REA catalog count');
});
