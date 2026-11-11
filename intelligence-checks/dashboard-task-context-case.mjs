import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const src=readFileSync(fileURLToPath(new URL("../Diagnose-Fun-Dashboard8789-TaskContext.ps1",import.meta.url)),"utf8");
test("read-only task-context probe never edits policy, status, task, service or listener",()=>{
 for(const marker of [
  "FUN_DASHBOARD_TASK_CONTEXT=READ_ONLY_COMPLETE",
  "Get-ScheduledTask -TaskName",
  "Get-ScheduledTaskInfo -TaskName",
  "Get-CimInstance Win32_Process",
  "GetOwnerSid",
  "POLICY_RESTORED_FROM_FAILED_RECONCILIATION=",
  "CURRENT_USER_MATCH_POLICY=",
  "TASK_PRINCIPAL_MATCH_POLICY=",
  "WATCHER_OWNER_MATCH_POLICY=",
  "STATUS=",
  "POLICY_CHANGED_DURING_CONTEXT_INSPECTION"
 ])assert.ok(src.includes(marker),marker);
 assert.doesNotMatch(src,/\b(?:Stop-Process|Start-Process|Restart-Computer|Stop-ScheduledTask|Start-ScheduledTask|Set-ScheduledTask|Register-ScheduledTask|Unregister-ScheduledTask|Set-Content|Out-File|Remove-Item|Move-Item|Copy-Item|icacls\.exe)\b/);
 assert.doesNotMatch(src,/\[IO\.File\]::WriteAllText/);
});
test("probe redacts task principal and full process arguments",()=>{
 assert.doesNotMatch(src,/Write-Host[^\n]*(?:USER_ID|USER_SID|TASK_SID|OWNER_SID|PROCESS_ARGUMENTS|COMMAND_LINE)\s*=/i);
 assert.doesNotMatch(src,/Write-Host[^\n]*["\x27]\s*\$(?:userId|taskSid|policySid|interactiveSid|ownerSid)\b/i);
 assert.match(src,/Write-Host "CURRENT_USER_MATCH_POLICY=\$\(\$interactiveSid -eq \$policySid\)"/);
 assert.match(src,/WATCHER_OWNER_RESOLVED=/);
 assert.match(src,/TASK_PRINCIPAL_RESOLVED=/);
 assert.match(src,/DASHBOARD_LISTENER_VALID=/);
});
test("probe compares policy identity without treating interactive ACL as task access",()=>{
 assert.match(src,/INTERACTIVE=/);
 assert.match(src,/WATCHER_OWNER_MISMATCH_OR_UNVERIFIABLE=/);
 assert.match(src,/policy\.verifiedExistingPid/);
 assert.match(src,/status\.checkedUtc/);
});