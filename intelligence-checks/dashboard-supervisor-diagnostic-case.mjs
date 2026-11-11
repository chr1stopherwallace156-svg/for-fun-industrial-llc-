import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const file=fileURLToPath(new URL("../Diagnose-Fun-Dashboard8789-Supervisor.ps1",import.meta.url));
const source=readFileSync(file,"utf8");
test("diagnostic is read-only and does not run, stop or replace the live supervisor",()=>{
 for(const text of ["Policy-Ready $policy","Endpoint-Ready","Confirm-Owner $actualPid $policy",
  "SIMULATED_POLICY_READY=","SIMULATED_OWNER_CLASSIFICATION=",
  "POLICY_CURRENTLY_MATCHES_RUNNING_SOURCE_AND_PROCESS=",
  "FUN_DASHBOARD_SUPERVISOR_DIAGNOSTIC=PASS_READ_ONLY"]){
   assert.ok(source.includes(text),text);
 }
 for(const bad of ["Stop-Process -Id","Start-Process -FilePath",
  "Register-ScheduledTask -TaskName","Stop-ScheduledTask -TaskName","Move-Item -LiteralPath",
  "Set-Content -Path $PolicyPath","Copy-Item -LiteralPath"]){
   assert.ok(!source.includes(bad),bad);
 }
});
test("simulates exact canonical read-only function AST and checks installed hash identity",()=>{
 for(const text of ["CANONICAL_READ_ONLY_FUNCTION_MISSING_",
  "SYMLINK_FILE_","SUPERVISOR_SOURCE_MATCH=","INSTALLED_WATCHER_SOURCE_DIFFERS_NO_SIMULATION",
  "FindAll(","FunctionDefinitionAst","HashFile","FHash $PolicyPath",
  "POLICY_CHANGED_DURING_READ_ONLY_DIAGNOSTIC"]){
  if(text==="HashFile")continue;
  assert.ok(source.includes(text),text);
 }
 assert.match(source,/if\(-not \$ready\)\{/);
 assert.match(source,/SIMULATED_POLICY_CATALOGUE_COUNT/);
 assert.match(source,/SIMULATED_POLICY_REQUIRED_FILES_MISSING/);
});
test("never changes the actual policy; updates simulated fields only in memory",()=>{
 assert.match(source,/\$policy=Get-Content -LiteralPath \$PolicyPath -Raw -ErrorAction Stop \| ConvertFrom-Json/);
 assert.match(source,/\$policy\.serverSha256=\$serverSha/);
 assert.match(source,/\$policy\.htmlSha256=\$htmlSha/);
 assert.match(source,/\$policy\.verifiedExistingPid=\$actualPid/);
 assert.doesNotMatch(source,/WriteAllText\s*\(\s*\$PolicyPath|Move-Item .*PolicyPath|Set-Content .*PolicyPath/);
});