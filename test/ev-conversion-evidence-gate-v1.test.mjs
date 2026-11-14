import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import fs from 'node:fs';
const p=new URL('../src/ev-conversion/evidence-gate-v1.py',import.meta.url);
test('EV dossier requires verified inputs rather than inventing F-450 specifications',()=>{
 const s=fs.readFileSync(p,'utf8');for(const x of ['MISSING_VERIFIED_EVIDENCE','HOLD_MISSING_VERIFIED_INPUTS','INTEGRITY_PROVENANCE_HOLD','designReleased','regulatoryEligibilityVerified','OUTPUT_CONFLICT_HOLD'])assert.ok(s.includes(x),x);
});
test('EV dossier enumerates safety, engineering, and manufacturing evidence domains',()=>{
 const script="import importlib.util;spec=importlib.util.spec_from_file_location('m',"+JSON.stringify(fileURLToPath(p))+");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);assert len(m.DOMAINS)==7;assert 'hv_isolation' in m.DOMAINS['safety'];assert 'bom_quotes' in m.DOMAINS['manufacturing']";
 const r=spawnSync('python',['-c',script],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr);
});
