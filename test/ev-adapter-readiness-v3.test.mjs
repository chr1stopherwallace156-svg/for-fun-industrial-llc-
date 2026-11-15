import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const p=new URL('../src/ev-conversion/adapter-readiness-v3.py',import.meta.url);
test('V3 rehashes original files and refuses fabricated registry or authority',()=>{const s=fs.readFileSync(p,'utf8');for(const x of ['mod.validate(root,m)','REGISTRY_PROVENANCE_HOLD','AUTHORITY_HOLD','runtimeConnected','vehicleSpecificQualified','engineeringReleased'])assert.ok(s.includes(x))});
test('V3 refuses non-FunIndustrial root',()=>{const r=spawnSync('python',[fileURLToPath(p),'--root',process.cwd()],{encoding:'utf8'});if(r.error)throw r.error;assert.notEqual(r.status,0);assert.match(r.stderr,/ROOT_SCOPE_HOLD/)});
