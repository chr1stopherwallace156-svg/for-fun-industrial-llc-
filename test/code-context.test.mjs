import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {isCodingRequest,buildCodeContext} from '../src/code-context.mjs';

async function fixture(fn){const dir=await mkdtemp(path.join(tmpdir(),'fi-code-v1-'));try{await writeFile(path.join(dir,'app.mjs'),'export function analyzeFleetGraph(nodes) {\n return nodes.length;\n}\n');await writeFile(path.join(dir,'other.py'),'def train_tensor_model(x):\n    return x\n');await writeFile(path.join(dir,'.env'),'TOKEN=PRIVATE_CREDENTIAL\n');await mkdir(path.join(dir,'node_modules'));await writeFile(path.join(dir,'node_modules','leak.js'),'export const fleetGraph = "SECRET";');return await fn(dir)}finally{await rm(dir,{recursive:true,force:true})}}

test('detects explicit coding intent but not ordinary conversation',()=>{assert.equal(isCodingRequest('Fix the bug in the software codebase'),true);assert.equal(isCodingRequest('what is the weather today?'),false)});
test('selects relevant local file and line numbers',()=>fixture(async dir=>{const x=await buildCodeContext(dir,'Inspect analyzeFleetGraph function in app.mjs');assert.deepEqual(x.files,['app.mjs']);assert.match(x.context,/FILE app\.mjs/);assert.match(x.context,/\d+: .*analyzeFleetGraph/)}));
test('never includes secret or dependency paths',()=>fixture(async dir=>{const x=await buildCodeContext(dir,'Debug fleet graph, look for TOKEN');assert.ok(!x.context.includes('PRIVATE_CREDENTIAL'));assert.ok(!x.context.includes('node_modules'));assert.ok(!x.files.some(p=>p.includes('.env')))}));
test('strict budget and read-only behavior',()=>fixture(async dir=>{const before=await readFile(path.join(dir,'app.mjs'),'utf8');const x=await buildCodeContext(dir,'inspect source code in app.mjs',{maxChars:140});assert.ok(x.context.length<=140);assert.equal(await readFile(path.join(dir,'app.mjs'),'utf8'),before)}));
test('skips symlink target outside root',()=>fixture(async dir=>{const ext=path.join(tmpdir(),'fi-external-'+Date.now()+'.js');try{await writeFile(ext,'export const fleetGraph = "SHOULD_NOT_READ"');await symlink(ext,path.join(dir,'external.js'));const x=await buildCodeContext(dir,'inspect fleetGraph source code');assert.ok(!x.context.includes('SHOULD_NOT_READ'))}finally{await rm(ext,{force:true})}}));
test('does not dump repository on noncoding requests',()=>fixture(async dir=>{const x=await buildCodeContext(dir,'Hello, how are you?');assert.equal(x.context,'');assert.deepEqual(x.files,[])}));
test('rejects invalid budget and excessive question',()=>fixture(async dir=>{await assert.rejects(buildCodeContext(dir,'source code',{maxChars:99}),/Invalid code context budget/);await assert.rejects(buildCodeContext(dir,'x'.repeat(3001)),/Invalid coding query/)}));
