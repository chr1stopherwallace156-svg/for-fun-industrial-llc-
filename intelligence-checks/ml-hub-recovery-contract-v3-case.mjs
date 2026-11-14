// Static guardrail tests for the optional missing-service recovery path.
// Real service recovery must be verified on Windows; this does not run PowerShell.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const launcher=new URL('../Start-Fun-ML-Dashboard-V3.ps1',import.meta.url);
const startup=new URL('../Start-Fun-Industrial.ps1',import.meta.url);
const clean=async file=>(await readFile(file,'utf8')).replace(/\r\n/g,'\n');

test('preflight reports independent 8789, 8798, 8801 health and refuses unhealthy listeners',async()=>{
 const source=await clean(launcher);
 for(const [port,path] of [[8789,'/api/status'],[8798,'/api/unified/status'],[8801,'/api/ml/status']]){
  assert.ok(source.includes("Probe "+port+" '"+path+"'"),port+' must have exact health probe');
 }
 assert.match(source,/LISTENING_BUT_HTTP_FAILED/);
 assert.match(source,/UNHEALTHY_LISTENER_MANUAL_REVIEW_NO_RESTART/);
 assert.match(source,/DEPENDENCY_MISSING_CHECK_ONLY/);
});
test('core recovery is opt-in through main launcher, starts only missing services and skips 8443 gateway',async()=>{
 const source=await clean(launcher);
 const core=await clean(startup);
 assert.match(source,/if\(\$null -eq \$parent -or \$null -eq \$chat\)/);
 assert.match(source,/-File \$startScript -SkipPrivateGateway/);
 assert.match(core,/param\(\[switch\]\$CheckOnly,\[switch\]\$SkipPrivateGateway\)/);
 assert.match(core,/if\(\$SkipPrivateGateway\)/);
 assert.match(source,/EXISTING_SERVICE_CHANGED_DURING_RECOVERY_PORT_/);
 assert.match(source,/if\(\$CheckOnly\)/);
});
test('missing 8801 uses previously verified V2 checkout, no silent script fetch or authority change',async()=>{
 const source=await clean(launcher);
 assert.match(source,/if\(\$null -eq \$ml\)/);
 assert.match(source,/FunIndustrial-QwenML-V2/);
 assert.match(source,/V2_SOURCE_BRANCH_MISMATCH/);
 assert.match(source,/V2_SOURCE_DIRTY/);
 assert.match(source,/V2_ML_RECOVERY_FAILED_NO_RETRY/);
 assert.doesNotMatch(source,/Stop-Process|taskkill\.exe|Remove-Item|Invoke-Expression/);
});
