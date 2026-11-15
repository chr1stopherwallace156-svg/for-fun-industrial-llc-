import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const py=fs.readFileSync(new URL('../src/ev-conversion/f450-visual-import-v6.py',import.meta.url),'utf8');
const ps=fs.readFileSync(new URL('../src/ev-conversion/Start-F450-Visual-V6.ps1',import.meta.url),'utf8');
test('mesh importer supports Blender standard formats and source hash',()=>{for(const s of ['.glb','.gltf','.obj','.fbx','source_sha256','save_as_mainfile','blendSha256'])assert.ok(py.includes(s))});
test('licensing and engineering authority are explicit',()=>{for(const s of ['LICENSE_EVIDENCE_REQUIRED','VISUAL_REFERENCE_ONLY','sourceScaleVerified','engineeringReleased'])assert.ok(py.includes(s))});
test('launcher only probes Blender unless licensed source supplied',()=>{for(const s of ['BLENDER_STATUS=NOT_FOUND','AWAITING_LICENSED_MESH_AND_LICENSE_EVIDENCE','OUTPUT_NOT_EMPTY_HOLD','--background'])assert.ok(ps.includes(s));assert.doesNotMatch(ps,/Stop-Process|Restart-Service|ollama/i)});
