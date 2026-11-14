import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('V12B indexes source-backed page references without automatic engineering promotion',()=>{
 const s=fs.readFileSync(new URL('../src/vehicle-library/index-v12b.py',import.meta.url),'utf8');
 for(const t of ['SOURCE_HASH_MISMATCH','EXTRACTION_PROVENANCE_MISMATCH','INCOMPLETE_EXTRACTION_HOLD','NEEDS_HUMAN_REVIEW','approvedForEngineering','proposedDestination','sourceSha256','engineering-index-v12b.json'])assert.ok(s.includes(t),t);
});
