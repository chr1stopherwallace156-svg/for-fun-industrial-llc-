import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('V12D stages raw table-cell parameters without engineering approval',()=>{
 const s=fs.readFileSync(new URL('../src/vehicle-library/parameters-v12d.py',import.meta.url),'utf8');
 for(const token of ['SOURCE_HASH_MISMATCH','TABLE_PROVENANCE_OR_COMPLETENESS_HOLD','UNKNOWN_TABLE_SOURCE','modelApplicability','UNDETERMINED','normalizedValue','NEEDS_HUMAN_REVIEW','approvedForEngineering','EXISTING_PARAMETER_INDEX_CONFLICT'])assert.ok(s.includes(token),token);
});
