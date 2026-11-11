import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const root=new URL("../",import.meta.url);
const deploy=readFileSync(fileURLToPath(new URL("Deploy-Fun-Security-Primary-8789.ps1",root)),"utf8");
const wrapper=readFileSync(fileURLToPath(new URL("Retire-Legacy-Pins-And-Deploy.ps1",root)),"utf8");
test("legacy source pin and 204-file provisional fingerprint are no longer deployment gates",()=>{
 for(const x of ["AUTOSTART_SOURCE_PIN_MISMATCH","PRE_DEPLOY_204_FILE_BASELINE_CHANGED","BASELINE_PIN_MISMATCH"])
  assert.ok(!deploy.includes(x),x);
 assert.match(deploy,/LEGACY_PINS=NOT_REQUIRED/);
 assert.doesNotMatch(deploy,/integrity_monitor\.py/);
 assert.doesNotMatch(deploy,/\$PolicyChanged/);
 assert.match(deploy,/LEGACY_AUTOSTART_TASK_ACTIVE_USE_RETIRE_AND_DEPLOY/);
 assert.match(deploy,/LEGACY_AUTOSTART_POLICY_STILL_PRESENT_USE_RETIRE_AND_DEPLOY/);
});
test("one-command path only retires named current-user watchdog then applies existing guarded deployment",()=>{
 for(const x of [
  "LEGACY_WATCHDOG_RETIREMENT=PASS",
  "LEGACY_SOURCE_AND_PID_PINS=RETIRED",
  "LEGACY_AUTOSTART_SCHEDULED_TASK=REMOVED",
  "LEGACY_RETIREMENT_BACKUP=",
  "FUN_PHASE5_ONE_RUN=PASS",
  "Start-ScheduledTask", "Stop-ScheduledTask -TaskName $TaskName",
  "Unregister-ScheduledTask -TaskName $TaskName",
  "SCHEDULED_TASK_OWNER_NOT_CURRENT_USER",
  "SCHEDULED_TASK_ACTION_NOT_EXACT_LEGACY_WATCHER",
  "PHASE5_DEPLOYMENT=STARTING",
  "-File $Deploy -Apply"
 ].filter(x=>x!=="Start-ScheduledTask"))assert.ok(wrapper.includes(x),x);
 assert.doesNotMatch(wrapper,/Start-ScheduledTask\b|Register-ScheduledTask\b|New-ScheduledTask\b/);
 assert.doesNotMatch(wrapper,/Stop-Process\b|Restart-Computer\b|Stop-Service\b|Stop-NetBird\b/);
});
test("all retired policy and watcher files have verified backups; only exact task is removed",()=>{
 for(const x of ["policy.original.json","policy.retired.json","watcher.original.ps1",
 "watcher.retired.ps1","task.original.xml","POLICY_BACKUP_HASH_MISMATCH",
 "WATCHER_BACKUP_HASH_MISMATCH","RETIRED_POLICY_BACKUP_MISMATCH",
 "RETIRED_WATCHER_BACKUP_MISMATCH","PRIMARY_DASHBOARD_CHANGED_DURING_WATCHDOG_RETIREMENT"])
  assert.ok(wrapper.includes(x),x);
 assert.match(wrapper,/Get-ScheduledTask -TaskName \$TaskName/);
 assert.match(wrapper,/AUTOSTART_AT_SIGNIN=DISABLED_AFTER_THIS_CHANGE/);
 assert.match(wrapper,/DASHBOARD_NO_LONGER_AUTOSTARTS_AT_WINDOWS_SIGNIN/);
});
test("phase 5 still validates existing voice memory REA and loopback, without privilege broadening",()=>{
 for(const x of ["Pid8789","REA_PERMISSION_REGRESSION","REA_229_CATALOGUE_REGRESSION",
 "PORT_8789_OWNER_NOT_RECOGNIZED","LIVE_SERVICE_PREFLIGHT_HOLD",
 "SECURITY_APPROVAL_HEADER_NOT_ENFORCED","PROTECTED_PORT_OWNER_CHANGED_",
 "FUN_SECURITY_PRIMARY_8789_DEPLOY=PASS","FI_SECURITY_PRIMARY_CLIENT_V2"])
 assert.ok(deploy.includes(x),x);
 assert.doesNotMatch(deploy,/NODE_TLS_REJECT_UNAUTHORIZED|REA_ALLOWED_TOOLS=\*|REA_ALLOWED_TOOLS='ALL'/);
});

test("live 8789 dashboard restarts only with same verified Node executable path",()=>{
 assert.match(deploy,/\$originalNodePath=\[string\]\$existingNodeProcess\.ExecutablePath/);
 assert.match(deploy,/\$Node=\$originalNodePath/);
 assert.match(deploy,/RUNNING_8789_NODE_EXE_PATH_NOT_VERIFIABLE/);
 assert.match(deploy,/CheckFile \$originalNodePath/);
});
