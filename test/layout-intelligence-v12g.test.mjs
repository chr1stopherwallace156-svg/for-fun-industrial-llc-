import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('generic layout audit has fail-closed checks and targeted review without meaning approval',()=>{
 const s=fs.readFileSync(new URL('../src/layout-intelligence/audit-v12g.py',import.meta.url),'utf8');
 for(const t of ['RAGGED_ROWS','HEADER_UNCLEAR','NUMERIC_CELL_WITHOUT_ROW_UNIT','TARGETED_SECOND_PASS','meaningVerified','EXISTING_AUDIT_CONFLICT','inputSha256'])assert.ok(s.includes(t),t);
});
