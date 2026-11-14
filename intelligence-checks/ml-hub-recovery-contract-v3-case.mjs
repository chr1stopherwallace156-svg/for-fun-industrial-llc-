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
test('original 8789 recovery remains guarded and cannot skip its pinned source hash',async()=>{
 const source=await clean(launcher);
 const core=await clean(startup);
 assert.match(source,/if\(\$null -eq \$parent\)/);
 assert.match(source,/-File \$startScript -SkipPrivateGateway/);
 assert.match(core,/param\(\[switch\]\$CheckOnly,\[switch\]\$SkipPrivateGateway\)/);
 assert.match(core,/if\(\$SkipPrivateGateway\)/);
 assert.match(core,/8789_SOURCE_HASH_CHANGED_MANUAL_REVIEW_NO_RESTORE/);
 assert.match(source,/EXISTING_SERVICE_CHANGED_DURING_RECOVERY_PORT_/);
 assert.match(source,/if\(\$CheckOnly\)/);
});
test('missing 8798 with healthy 8789 uses dedicated launcher and never reloads 8789',async()=>{
 const source=await clean(launcher);
 assert.match(source,/elseif\(\$null -eq \$chat -or \$chatDegraded\)/);
 assert.match(source,/Start-Fun-Unified-Chat8798\.ps1/);
 assert.match(source,/START_ONLY_MISSING_8798_ORIGINAL_8789_PRESERVED/);
 assert.match(source,/8798_DEPENDENCY_/);
 assert.match(source,/8798_ORIGINAL_LOCAL_CATALOGUE_MISMATCH/);
 assert.match(source,/-File \$startChat/);
 assert.match(source,/8798_DEDICATED_RECOVERY_FAILED_NO_RETRY/);
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

test('missing local sidecars are recovered independently before dedicated 8798 startup',async()=>{
 const source=await clean(launcher);
 const helper=await clean(new URL('../Start-Fun-Local-Dependencies-V3.ps1',import.meta.url));
 assert.match(source,/Start-Fun-Local-Dependencies-V3\.ps1/);
 assert.match(source,/LOCAL_DEPENDENCY_RECOVERY_FAILED_NO_RETRY/);
 assert.ok(source.indexOf('-File $dependencyHelper')<source.indexOf('-File $startChat'),
   'local sidecars must be ready before 8798');
 assert.match(helper,/if\(\$null -eq \$local\)\{SpawnMissing 8796/);
 assert.match(helper,/if\(\$null -eq \$rea\)\{SpawnMissing 8797/);
 assert.match(helper,/--standalone/);
 assert.match(helper,/EXISTS_BUT_UNHEALTHY_NO_RESTART/);
 assert.match(helper,/PREEXISTING_LISTENER_CHANGED_/);
 assert.doesNotMatch(helper,/Start-Fun-Industrial\.ps1|Stop-Process|taskkill\.exe|Set-Content|Invoke-Expression/);
});
test('sidecar recovery verifies parent, Qwen and compute without changing 8789 source guard',async()=>{
 const source=await clean(launcher),helper=await clean(new URL('../Start-Fun-Local-Dependencies-V3.ps1',import.meta.url));
 const core=await clean(startup);
 assert.match(helper,/OnlyLoopback \$p/);
 assert.match(helper,/PARENT_LOCAL_19_MISMATCH/);
 assert.match(helper,/QWEN_NOT_READY/);
 assert.match(helper,/COMPUTE_NOT_READY/);
 assert.match(helper,/reaExecutionGrants -ne 0/);
 assert.match(helper,/realReaToolCount -ne 229/);
 assert.match(source,/if\(\$null -eq \$parent\)/);
 assert.match(core,/8789_SOURCE_HASH_CHANGED_MANUAL_REVIEW_NO_RESTORE/);
});

test('dedicated 8798 launcher only adopts exact healthy Qwen 8088 and does not start a duplicate',async()=>{
 const source=await clean(new URL('../Start-Fun-Unified-Chat8798.ps1',import.meta.url));
 assert.match(source,/function VerifiedIndependentQwen\(\)/);
 assert.match(source,/llama-server\.exe/);
 assert.match(source,/Qwen3-4B-Q4_K_M/);
 assert.match(source,/127\.0\.0\.1:8088\/health/);
 assert.match(source,/QWEN_LOCAL_MODEL_NOT_READY/);
 assert.match(source,/VerifiedIndependentQwen\)\)\)\{Hold 'ORIGINAL_SERVICES_CHANGED'/);
 assert.doesNotMatch(source,/Start-Fun-Industrial\.ps1/);
});

test('degraded existing 8798 triggers sidecar recovery without restarting unified chat',async()=>{
 const source=await clean(launcher);
 assert.match(source,/\$chatDegraded=\(\$null -ne \$chat/);
 assert.match(source,/\$chat\.state -ne 'ready'/);
 assert.match(source,/\$chat\.local\.ready -ne \$true/);
 assert.match(source,/\$chat\.rea\.ready -ne \$true/);
 assert.match(source,/\$null -eq \$chat -or \$chatDegraded -or \$null -eq \$ml/);
 assert.match(source,/if\(\$null -eq \$chat\)\{\s*& powershell\.exe -NoProfile -ExecutionPolicy Bypass -File \$startChat/);
 assert.match(source,/EXISTING_8798_DEGRADED_ADOPT_RECHECK_NO_RESTART/);
 assert.match(source,/8798_STILL_DEGRADED_AFTER_SIDECAR_RECOVERY_NO_RESTART/);
});

test('cold restart accepts only the pinned original or exact reviewed 8789 evidence-dashboard Git object',async()=>{
 const core=await clean(startup);
 assert.match(core,/ExpectedSourceSha='9C8667C1299102156968A79FD8CF524AC23EFAC25B7E924D369954EC638C6844'/);
 assert.match(core,/ReviewedEvidenceSourceBlob='422d4f75e57dc6099f7c6b05f535843d8f08929f'/);
 assert.match(core,/git\.exe -C \$Primary hash-object --no-filters -- \$Source/);
 assert.match(core,/\$SourceGitBlob -cne \$ReviewedEvidenceSourceBlob/);
 assert.match(core,/hash-object --path=src\/server\.mjs -- \$Source/);
 assert.match(core,/\$TrackedBlob -cne \$ReviewedEvidenceSourceBlob/);
 assert.match(core,/FUN_EVIDENCE_DATABASE=\$EvidenceDb/);
 assert.match(core,/FUN_COGNITION_PYTHON=\$EvidencePython/);
 assert.match(core,/FUN_8789_EVIDENCE_RUNTIME=CONFIGURED_LOCAL_EXISTING_DB/);
 assert.match(core,/8789_SOURCE_HASH_CHANGED_MANUAL_REVIEW_NO_RESTORE/);
 assert.doesNotMatch(core,/Set-Content[^\n]*\$Source|Copy-Item[^\n]*\$Source/);
});
test('one cold recovery restores core, ML, Commerce, then separately attests optional iPhone gateway',async()=>{
 const script=await clean(new URL('../Recover-Fun-After-Disconnect-V1.ps1',import.meta.url));
 const start=script.indexOf('& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Main');
 const commerce=script.indexOf('& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Commerce');
 const gateway=script.indexOf('& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Gateway');
 assert.ok(start>0&&commerce>start&&gateway>commerce);
 assert.match(script,/FUN_COLD_RECOVERY_CORE_AND_ML=PASS/);
 assert.match(script,/FUN_COLD_RECOVERY_COMMERCE_V1_1=PASS/);
 assert.match(script,/FUN_SERVICES_8088_8791_8789_8796_8797_8798_8801_8802=HEALTHY/);
 assert.match(script,/FUN_REA_ACTIONS=0 FUN_SHOPIFY_MUTATIONS=0 FUN_MODEL_TRAINING=0/);
 assert.doesNotMatch(script,/Invoke-Expression|taskkill\.exe|Set-Content|Remove-Item|Start-Process/);
});
