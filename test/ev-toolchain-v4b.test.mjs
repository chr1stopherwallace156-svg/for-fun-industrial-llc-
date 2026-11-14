import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const src=readFileSync('Setup-Fun-EV-Toolchain-V4.ps1','utf8');
test('Windows PowerShell native argv sentinel sources contain no embedded quote escapes',()=>{
 const nodeProbe="process.stdout.write(process.argv.slice(1).join(String.fromCharCode(44)))";
 const pyProbe='import sys; print(chr(44).join(sys.argv[1:]))';
 assert.equal(src.split(nodeProbe).length-1,2);
 assert.equal(src.split(pyProbe).length-1,1);
 assert.doesNotMatch(src,/process\.stdout\.write\(process\.argv\.slice\(1\)\.join\(","\)\)/);
 assert.doesNotMatch(src,/import sys; print\(","\.join\(sys\.argv\[1:\]\)\)/);
 assert.match(src,/print\(sys\.version_info\.major,sys\.version_info\.minor,sep=chr\(46\)\)/);
});
test('replacement inline Node and Python sentinel code reports exact two positional arguments',()=>{
 const nodeScript='process.stdout.write(process.argv.slice(1).join(String.fromCharCode(44)))';
 const node=spawnSync(process.execPath,['-e',nodeScript,'fun-one','fun-two'],{encoding:'utf8',timeout:5000});
 assert.equal(node.status,0,node.stderr);
 assert.equal(node.stdout,'fun-one,fun-two');
 // Python native Windows execution is exercised in V4a SelfTest; no Python dependency on CI Linux.
});
test('SelfTest source precedes every install and never calls an installation command',()=>{
 const start=src.indexOf("if($Action -eq 'SelfTest'){");
 const end=src.indexOf("if($Action -eq 'Plan'){");
 assert.ok(start>=0&&end>start);
 const onlySelf=src.slice(start,end);
 assert.doesNotMatch(onlySelf,/Checked \$winget\.Source @\('install'/);
 assert.doesNotMatch(onlySelf,/Checked \$python @\('-m','venv'/);
 assert.doesNotMatch(onlySelf,/New-Item -ItemType Directory/);
 assert.match(onlySelf,/mode='NO_INSTALL'/);
});
