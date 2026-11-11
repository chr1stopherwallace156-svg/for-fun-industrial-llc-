import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const body=readFileSync(fileURLToPath(new URL("../Recover-Fun-Dashboard-After-Phase5.ps1",import.meta.url)),"utf8");
test("if known dashboard is live, no process or source changes occur",()=>{
 assert.match(body,/if\(\$initial -gt 0\)\{/);
 assert.match(body,/FUN_PHASE5_RECOVERY=ALREADY_RUNNING_UNTOUCHED/);
 assert.match(body,/NO_PROCESSES_OR_SOURCE_FILES_MODIFIED=TRUE/);
 assert.ok(body.indexOf("if($initial -gt 0){")<body.indexOf("Copy-Item -LiteralPath $m.original -Destination $m.live -Force"));
});
test("source restore and Node launch are bounded to saved originals and single loopback 8789",()=>{
 for(const item of ["RETIRED_POLICY_IDENTITY_NOT_TRUSTED","LIVE_SOURCE_NOT_EXACT_ORIGINAL_OR_STAGED_BACKUP","RESTORED_SOURCE_HASH_NOT_MATCHING_BACKUP","DASHBOARD_PORT_CLAIMED_DURING_REPAIR","8789_LISTENER_OWNER_NOT_KNOWN_NODE_DASHBOARD","WATCHDOG=RETIRED REA_ALLOWLIST=UNCHANGED AUTOSTART_AT_LOGIN=DISABLED"])assert.ok(body.includes(item),item);
 assert.match(body,/Get-CimInstance Win32_Process/);
 assert.match(body,/Start-Process -FilePath \$Node -ArgumentList 'src\/server.mjs'/);
 assert.doesNotMatch(body,/Stop-Process\b|Start-ScheduledTask\b|Register-ScheduledTask\b|Stop-ScheduledTask\b|netbird up|ollama serve|Remove-Item\b/);
});
test("backup hashes, original runtime settings, and protected port ownership are checked",()=>{
 for(const item of ["server.original.mjs","index.original.html","tools.original.mjs","server.staged.mjs","index.staged.html","tools.staged.mjs","policy.retired.json","memoryBudgetMs","REA_ALLOWED_TOOLS=(@($pol.allowedTools)-join ',')","PROTECTED_PORT_CHANGED_","RESTORE_STDERR_LOG="])assert.ok(body.includes(item),item);
});
test("reads failed runtime log and reports health without needing policy approvals",()=>{
 for(const item of ["FAILED_DEPLOYMENT_STDERR_PATH=","FAILED_STARTUP_ERROR_HINT=","$($label)_VOICE_ENABLED=","$($label)_MEMORY_MODE=","FUN_PHASE5_RECOVERY=PASS"])assert.ok(body.includes(item),item);
 assert.doesNotMatch(body,/Reconcile-Fun-Dashboard8789-Policy/);
});