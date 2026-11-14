import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('V12F preserves bounded source-backed reconstruction and review boundaries',()=>{
 const s=fs.readFileSync(new URL('../src/vehicle-library/reconstruct-v12f.py',import.meta.url),'utf8');
 for(const t of ['SOURCE_INTEGRITY_HOLD','TABLE_PROVENANCE_HOLD','UNIT_AMBIGUOUS_OR_MISSING','MODEL_AMBIGUOUS_OR_MISSING','INCOMPATIBLE_DIMENSION','NEEDS_HUMAN_REVIEW','cadExportEligible','COUNT_COMPARISON_ONLY','EXISTING_RECONSTRUCTION_CONFLICT'])assert.ok(s.includes(t),t);
});
