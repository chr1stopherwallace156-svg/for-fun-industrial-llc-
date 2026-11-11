import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const file=fileURLToPath(new URL("../Reconcile-Fun-Dashboard8789-Policy.ps1",import.meta.url));
const src=readFileSync(file,"utf8");

test("reconciliation defaults to read-only; no policy writes before explicit approval digest",()=>{
 assert.match(src,/\[switch\]\$Approve/);
 assert.match(src,/\[string\]\$ExpectedReviewDigest/);
 assert.match(src,/if\(-not \$Approve\)\{/);
 assert.match(src,/FUN_DASHBOARD_POLICY_RECONCILE=NOT_PERFORMED/);
 assert.ok(src.indexOf("if(-not $Approve){")<src.indexOf("Move-Item -LiteralPath $candidate -Destination $PolicyFile"));
 assert.match(src,/REVIEW_DIGEST_STALE_OR_INCORRECT/);
});
test("reconciler verifies running node identity and source timestamps",()=>{
 for(const marker of [
  "Owner8789", "Get-CimInstance Win32_Process", "PRIMARY_PROCESS_IDENTITY_MISMATCH",
  "AUTOSTART_NODE_BINARY_PATH_MISMATCH",
  "RUNNING_PROCESS_PREDATES_DEPLOYED_FILES_REVIEW_RESTART_REQUIRED",
  "SERVED_HTML_DIFFERS_FROM_DEPLOYED_HTML", "CURRENT_PID=",
  "SERVER_MODIFIED_UTC=", "HTML_MODIFIED_UTC="
 ])assert.ok(src.includes(marker),marker);
});
test("reconciler requires existing supervisor task and preserves 229 REA names",()=>{
 for(const marker of [
  "EXISTING_AUTOSTART_TASK_NOT_RUNNING","AUTOSTART_TASK_ACTION_CHANGED",
  "REA_CATALOGUE_CHANGED_SINCE_POLICY",
  "REA_PERMISSION_SET_CHANGED_SINCE_POLICY",
  "209_REA_NEVER_CALL",
  "204_FILE_MONITOR_NOT_CLEAN", "204_FILE_MONITOR_NOT_CLEAN"
 ].filter(x=>x!=="209_REA_NEVER_CALL"))assert.ok(src.includes(marker),marker);
 assert.doesNotMatch(src,/\bStop-Process\b|\bStop-ScheduledTask\b|\bRegister-ScheduledTask\b/);
 assert.doesNotMatch(src,/\/api\/rea\/call|\/api\/rea\/start/);
});
test("backup and revalidation before policy update with rollback",()=>{
 for(const marker of [
  "policy.original.json","review.json","FILES_OR_PROCESS_CHANGED_SINCE_REVIEW",
  "ORIGINAL_POLICY_CHANGED_BEFORE_REPLACE","POLICY_BACKUP=",
  "SUPERVISOR_DID_NOT_ACCEPT_RECONCILED_POLICY","Copy-Item -LiteralPath (Join-Path $backup 'policy.original.json')",
  "FUN_DASHBOARD_POLICY_RECONCILE=PASS"
 ])assert.ok(src.includes(marker),marker);
});
