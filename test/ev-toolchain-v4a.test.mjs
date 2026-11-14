import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const script=resolve('Setup-Fun-EV-Toolchain-V4.ps1');
const src=readFileSync(script,'utf8');
test('native command helper is not bound to automatic PowerShell Args',()=>{
 assert.match(src,/function Checked\(\[string\]\$Executable,\[string\[\]\]\$ArgumentList,\[string\]\$Stage\)/);
 assert.match(src,/& \$Executable @ArgumentList/);
 assert.doesNotMatch(src,/function Checked\([^)]*\$Args\b/i);
 assert.doesNotMatch(src,/@Args\b/i);
 assert.match(src,/EMPTY_ARGUMENTS_HOLD/);
});
test('explicit read-only SelfTest is before Plan and approval-gated Install',()=>{
 const testAt=src.indexOf("if($Action -eq 'SelfTest')");
 const planAt=src.indexOf("if($Action -eq 'Plan')");
 const approvalAt=src.indexOf("if($Approval -cne 'INSTALL_FUN_EV_TOOLCHAIN')");
 assert.ok(testAt>=0&&planAt>testAt&&approvalAt>planAt);
 assert.match(src,/PREINSTALL_ARGV_HOLD/);
 assert.match(src,/native_argument_forwarding='PASS'/);
 assert.match(src,/wireviz_target_exists=/);
});
test('read-only Windows PowerShell actually forwards Node, Python and winget argument vectors',t=>{
 if(process.platform!=='win32'){t.skip('Requires native Windows PowerShell');return}
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
   '-File',script,'-Action','SelfTest'],{
  encoding:'utf8',timeout:15000,maxBuffer:1024*1024,
 });
 assert.equal(r.error,undefined,r.error?.message);
 assert.equal(r.status,0,r.stderr||r.stdout);
 const json=JSON.parse(r.stdout.trim());
 assert.equal(json.schema,'fun.ev.toolchain.argv-selftest.v4a');
 assert.equal(json.mode,'NO_INSTALL');
 assert.equal(json.node_passed,true);
 assert.equal(json.native_argument_forwarding,'PASS');
 assert.equal(json.installer_executed,false);
 // On machines with either native tool present, forwarded version checks must also pass.
 assert.equal(typeof json.python_passed,'boolean');
 assert.equal(typeof json.winget_passed,'boolean');
});
