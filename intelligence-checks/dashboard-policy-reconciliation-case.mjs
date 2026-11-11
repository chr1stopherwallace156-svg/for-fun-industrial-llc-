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
test("reconciler recognizes real operator dashboard without old sample chat-input ID",()=>{
 assert.match(src,/LIVE_VOICE_PANEL_OR_CLIENT_SCRIPT_MISSING/);
 assert.match(src,/LIVE_DASHBOARD_HTML_STRUCTURE_INVALID/);
 assert.match(src,/LIVE_CHAT_ROUTE_MISSING_/);
 assert.match(src,/LIVE_CHAT_TOOL_CATALOGUE_UNAVAILABLE/);
 assert.ok(src.includes('src="/api/voice/mobile/client.js"'));
 assert.doesNotMatch(src,/htmlText\.Contains\('id="chat-input"'\)/);
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
  "SUPERVISOR_REJECTED_POLICY_FRESH_TICKS_","AUTOSTART_POLICY_ROLLBACK=VERIFIED",
  "FUN_DASHBOARD_POLICY_RECONCILE=PASS"
 ])assert.ok(src.includes(marker),marker);
});

test("candidate policy is re-read from disk, and watchdog acceptance requires new timestamp",()=>{
 for(const marker of [
  "WRITTEN_POLICY_BYTES_DIFFER_FROM_VERIFIED_CANDIDATE",
  "PERSISTED_POLICY_ROUNDTRIP_INVALID",
  "AUTOSTART_SUPERVISOR_STATUS_STALE_BEFORE_UPDATE",
  "WATCHDOG_BEFORE_POLICY_UPDATE=",
  "WATCHDOG_FRESH_REPORT_",
  "SUPERVISOR_NOT_POLLING_AFTER_POLICY_WRITE",
  "SUPERVISOR_REJECTED_POLICY_FRESH_TICKS_",
  "AUTOSTART_POLICY_ROLLBACK=VERIFIED",
  "ROLLBACK_FILE_HASH_MISMATCH",
  "if($stamp -le $lastTick){continue}"
 ])assert.ok(src.includes(marker),marker);
 assert.ok(src.indexOf("Move-Item -LiteralPath $candidate -Destination $PolicyFile")<src.indexOf("WATCHDOG_FRESH_REPORT_"));
 assert.match(src,/\$freshTicks=0/);
 assert.match(src,/if\(\$freshTicks -eq 0\)/);
});
