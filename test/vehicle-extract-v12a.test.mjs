import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('V12A offline extractor preserves engineering review boundaries',()=>{
 const s=fs.readFileSync(new URL('../src/vehicle-library/extract-v12a.py',import.meta.url),'utf8');
 for(const token of ['SOURCE_HASH_MISMATCH','reviewStatus','UNVERIFIED','engineeringApproved','sourceSha256','partial','processedPages','get_text','max_pages'])assert.ok(s.includes(token),token);
 assert.ok(!s.includes('subprocess.run('));
});
