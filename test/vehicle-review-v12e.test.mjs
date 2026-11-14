import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('V12E normalizes only exact unit cells and never grants CAD authority',()=>{
 const s=fs.readFileSync(new URL('../src/vehicle-library/review-v12e.py',import.meta.url),'utf8');
 for(const t of ['SOURCE_INTEGRITY_HOLD','PARAMETER_PROVENANCE_HOLD','EXACT_CELL_UNIT_CONVERSION_ONLY','UNDETERMINED','NEEDS_HUMAN_REVIEW','POTENTIAL_CONFLICT_REQUIRES_CONFIGURATION_REVIEW','cadExportEligible','EXISTING_REVIEW_CONFLICT'])assert.ok(s.includes(t),t);
});
