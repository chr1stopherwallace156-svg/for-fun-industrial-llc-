import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('Setup-Fun-EV-Toolchain-V4.ps1','utf8');
test('Plan is default; Install requires exact deliberate approval',()=>{
 assert.match(src,/\[ValidateSet\('Plan','SelfTest','Install'\)\]\[string\]\$Action='Plan'/);
 assert.match(src,/\$Action -eq 'Plan'/);
 assert.match(src,/\$Approval -cne 'INSTALL_FUN_EV_TOOLCHAIN'/);
});
test('Windows installation package IDs are exact versioned',()=>{
 for(const [id,v] of [['Graphviz.Graphviz','16.1.0'],['FreeCAD.FreeCAD','1.1.4'],['QElectroTech.QElectroTech','0.100.0']])
  assert.ok(src.includes("Id='"+id+"';Version='"+v+"'"));
 assert.match(src,/--source','winget'/);
});
test('WireViz venv installation verifies upstream primary wheel hash',()=>{
 assert.match(src,/wireviz==0\.4\.1/);
 assert.match(src,/5DFDFEC91E5D26E4F27F0F9D031672DA7FB3C133D127167D233F4742F01873A2/);
 assert.match(src,/Get-FileHash -LiteralPath \$wheel -Algorithm SHA256/);
 assert.match(src,/Join-Path \$target 'venv'/);
 assert.match(src,/New-Item -ItemType Directory -Path \$target/);
 assert.doesNotMatch(src,/Move-Item -LiteralPath \$stage/);
});
test('no cross-project or process lifecycle commands',()=>{
 assert.doesNotMatch(src,/\b(?:Restart-Service|Stop-Service|Start-Service|Register-ScheduledTask|Stop-Process|Start-Process|Invoke-Expression|Remove-Item)\b/);
 assert.doesNotMatch(src,/Elektron|Ollama|\bREA\b|127\.0\.0\.1/i);
});

test('all package catalog checks precede every install request',()=>{
 const preflight=src.indexOf("Checked $winget.Source @('show'");
 const install=src.indexOf("Checked $winget.Source @('install'");
 assert.ok(preflight>=0&&install>preflight);
 const section=src.slice(preflight,install);
 assert.match(section,/foreach\(\$pkg in \$packages\)/);
});
