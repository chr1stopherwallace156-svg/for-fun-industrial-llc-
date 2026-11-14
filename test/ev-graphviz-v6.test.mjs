import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('Run-Fun-EV-Graphviz-V6.ps1');
const src=readFileSync(script,'utf8');

test('audit is default and precedes explicit installation authorization',()=>{
 assert.match(src,/\[ValidateSet\('Audit','Install'\)\]\[string\]\$Action='Audit'/);
 assert.match(src,/if\(\$Action -eq 'Audit'\)/);
 assert.match(src,/\$Approval -cne 'APPROVE_FUN_EV_GRAPHVIZ_INSTALL'/);
 assert.ok(src.indexOf("if($Action -eq 'Audit')")<src.indexOf('APPROVE_FUN_EV_GRAPHVIZ_INSTALL'));
});
test('native installer is single package exact version and refuses existing candidate',()=>{
 assert.match(src,/\$packageId='Graphviz\.Graphviz'/);
 assert.match(src,/\$version='16\.1\.0'/);
 assert.match(src,/GRAPHVIZ_ALREADY_PRESENT_HOLD/);
 assert.match(src,/CATALOG_MISMATCH_HOLD/);
 assert.match(src,/POSTINSTALL_DOT_NOT_FOUND_HOLD/);
 assert.match(src,/native_svg_render_qualified=\$false/);
});
test('Graphviz probe only inspects normal program directories and Fun WireViz receipt',()=>{
 assert.match(src,/FunIndustrial\\EVEngineering\\Tools\\WireViz/);
 assert.match(src,/Get-ChildItem -LiteralPath \$root -Directory/);
 assert.match(src,/Get-FileHash -LiteralPath \$dot/);
 assert.doesNotMatch(src,/\b(?:Stop-Service|Restart-Service|Start-Service|Register-ScheduledTask|Start-Process|Stop-Process|Remove-Item|Invoke-Expression)\b/i);
 assert.doesNotMatch(src,/Elektron|Ollama|\bREA\b|127\.0\.0\.1/i);
 assert.doesNotMatch(src,/\$Args\b|@Args\b/);
});
test('native Windows PowerShell audit runs without attempting to install',t=>{
 if(process.platform!=='win32'){t.skip('Windows-only native audit');return}
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
 '-File',script,'-Action','Audit'],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
 assert.equal(r.error,undefined,r.error?.message);
 assert.equal(r.status,0,r.stderr||r.stdout);
 const record=JSON.parse(r.stdout.trim());
 assert.equal(record.scope,'FUN_INDUSTRIAL_ONLY');
 assert.equal(record.schema,'fun.ev.graphviz-native.audit.v6');
 assert.equal(record.mode,'READ_ONLY');
 assert.equal(record.installer_executed,false);
 assert.equal(record.native_svg_render_qualified,false);
 assert.ok(Array.isArray(record.graphviz_dot_candidates));
});
