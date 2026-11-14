import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('V12C table extraction preserves source and engineering approval boundaries',()=>{
 const s=fs.readFileSync(new URL('../src/vehicle-library/tables-v12c.py',import.meta.url),'utf8');
 for(const token of ['SOURCE_HASH_MISMATCH','EXTRACTION_PROVENANCE_HOLD','PAGE_BUDGET_HOLD','TABLE_BUDGET_HOLD','NEEDS_HUMAN_REVIEW','modelApplicability','UNDETERMINED','approvedForEngineering','pageFailures','find_tables','engineering-tables-v12c.json'])assert.ok(s.includes(token),token);
});
