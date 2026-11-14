import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const path=resolve('Recover-Fun-EV-WireViz-V5.ps1');
const src=readFileSync(path,'utf8');
test('Audit defaults to read only; recovery requires exact approval',()=>{
 assert.match(src,/\[ValidateSet\('Audit','Recover'\)\]\[string\]\$Action='Audit'/);
 assert.match(src,/if\(\$Action -eq 'Audit'\)/);
 assert.match(src,/\$Approval -cne 'APPROVE_FUN_EV_WIREVIZ_RECOVERY'/);
 assert.ok(src.indexOf("if($Action -eq 'Audit')")<src.indexOf('New-Item -ItemType Directory'));
});
test('recovery only uses dedicated Fun Industrial path and refuses incomplete venv',()=>{
 assert.match(src,/Join-Path \$local 'FunIndustrial'/);
 assert.match(src,/Join-Path \$engineering 'Tools'/);
 assert.match(src,/PARTIAL_VENV_OR_UNEXPECTED_FILES_HOLD/);
 assert.match(src,/UNSAFE_DIRECTORY_HOLD/);
 assert.match(src,/UNSAFE_WHEEL_ENTRY_HOLD/);
 assert.doesNotMatch(src,/\b(?:Remove-Item|Move-Item|Stop-Service|Start-Service|Restart-Service|Register-ScheduledTask|Stop-Process|Start-Process|Invoke-Expression)\b/);
 assert.doesNotMatch(src,/Elektron|Ollama|\bREA\b|127\.0\.0\.1/i);
});
test('uses venv-only pip, wheel primary hash and offline installation',()=>{
 assert.match(src,/\$python @\('-m','venv',\$venv\)/);
 assert.match(src,/\$vpy @\('-m','pip','download'/);
 assert.match(src,/--only-binary=:all:/);
 assert.match(src,/\$vpy @\('-m','pip','install','--no-index','--find-links',\$wheels/);
 assert.match(src,/5DFDFEC91E5D26E4F27F0F9D031672DA7FB3C133D127167D233F4742F01873A2/);
 assert.match(src,/native_render_qualified=\$false/);
});
test('real Windows audit returns JSON without installer action',t=>{
 if(process.platform!=='win32'){t.skip('Windows PowerShell required');return}
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path,'-Action','Audit'],{
  encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
 assert.equal(r.error,undefined,r.error?.message);
 assert.equal(r.status,0,r.stderr||r.stdout);
 const x=JSON.parse(r.stdout.trim());
 assert.equal(x.schema,'fun.ev.wireviz-recovery.audit.v5');
 assert.equal(x.scope,'FUN_INDUSTRIAL_ONLY');
 assert.equal(x.mode,'READ_ONLY');
 assert.equal(x.installed_by_this_command,false);
 assert.equal(typeof x.resume_layout_eligible,'boolean');
});
