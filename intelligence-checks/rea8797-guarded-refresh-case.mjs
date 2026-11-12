import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../Repair-Fun-Rea229-Sidecar8797.ps1',import.meta.url),'utf8');
test('8797 guarded refresher defaults inert and requires exact independent apply authorization',()=>{
 assert.match(src,/\[switch\]\$CheckOnly/);
 assert.match(src,/\[switch\]\$Apply/);
 assert.match(src,/AUTHORIZE REA 8797 RESTART/);
 assert.match(src,/EXPLICIT_APPROVAL_PHRASE_REQUIRED/);
 const inactive=src.indexOf('REA8797_GUARDED=INACTIVE');
 const firstAudit=src.indexOf('foreach($File in $Files)');
 assert.ok(inactive>=0&&firstAudit>inactive,'inert path before service inspection');
 assert.ok(src.indexOf('exit 0',inactive)>inactive&&src.indexOf('exit 0',inactive)<firstAudit,
  'default mode returns before performing any preflight actions');
 assert.match(src,/if\(\$CheckOnly -and \$Apply\)/);
 assert.match(src,/if\(\$CheckOnly\)\{[\s\S]*?RESTARTS=0 MCP_CALLS=0/);
});
test('8797 refresher checks exact owner, pinned script, idle status, 229/19 and no pending approvals',()=>{
 for(const x of ['8797_WRONG_REPOSITORY_SCRIPT_OWNER','8797_MISSING_EXPLICIT_SERVE',
  '8797_NOT_IDLE_AND_READY','DEPENDENT_CATALOGUES_NOT_READY',
  'UNIFIED_APPROVAL_PENDING_OR_BUSY','8797_OWNER_CHANGED',
  'PROCESS_IDENTITY_CHANGED_BEFORE_STOP','REA_CHILD_PROCESS_TREE_UNEXPECTED_MANUAL_REVIEW',
  'MCP_CHILD_OWNERSHIP_UNVERIFIED'])
  assert.ok(src.includes(x),'missing '+x);
 assert.match(src,/CreationDate/);
 assert.match(src,/\$P3\.preparationPending/);
 assert.match(src,/\$P31\.preparationPending/);
 assert.match(src,/\$P32\.preparationPending/);
 assert.match(src,/\$OldStatus\.busy -ne \$false/);
});
test('only exact verified REA parent and MCP child may be stopped; protected services are checked',()=>{
 assert.match(src,/Stop-Process -Id \$McpPid -Force/);
 assert.match(src,/Stop-Process -Id \$OldPid -Force/);
 assert.doesNotMatch(src,/taskkill\.exe|Stop-Process -Name|Get-Process.*\|.*Stop-Process/i);
 for(const x of ['8789','8796','8798','8088','8791','PROTECTED_LISTENER_CHANGED_',
  '8797_REPLACEMENT_NOT_LOOPBACK','8797_CATALOGUE_CHANGED','8797_NEW_SESSION_NOT_CLEAN'])
  assert.ok(src.includes(x),'missing '+x);
});
test('guarded 8797 repair never calls exact REA tools and never silently restarts other services',()=>{
 assert.doesNotMatch(src,/\/api\/rea229\/(call|run)|\/api\/unified\/v3\.2\/confirm/);
 assert.match(src,/Start-Fun-Rea229-Sidecar8797\.ps1/);
 assert.match(src,/NO_MCP_TOOL_EXECUTION=TRUE/);
 assert.match(src,/MANUAL_RECOVERY_REQUIRED/);
});
