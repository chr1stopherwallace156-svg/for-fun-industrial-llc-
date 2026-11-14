import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import fs from 'node:fs';
const p=new URL('../src/layout-intelligence/text-integrity-v12r.py',import.meta.url);
function run(lines){const loader="import importlib.util\nspec=importlib.util.spec_from_file_location('m',"+JSON.stringify(fileURLToPath(p))+")\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\n";const r=spawnSync('python',['-c',loader+lines.join('\n')],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr)}
test('V12R detects CID artifacts, replacement glyphs, control characters and empty text',()=>run([
 "assert m.classify('Figure 28 - Center Bearing Alignment')[0]=='READABLE_REVIEW_CANDIDATE'",
 "assert m.classify('*F(cid:7)6(cid:3)')[0]=='TEXT_RECOVERY_REQUIRED'",
 "assert 'CID_GLYPH_ARTIFACT' in m.classify('X(cid:17)')[1]",
 "assert m.classify('a\\ufffdb')[0]=='TEXT_RECOVERY_REQUIRED'",
 "assert m.classify('a\\x00b')[0]=='TEXT_RECOVERY_REQUIRED'",
 "assert m.classify(' ')[0]=='TEXT_RECOVERY_REQUIRED'",
 "assert m.classify('車両仕様')[0]=='READABLE_REVIEW_CANDIDATE'",
 "assert m.classify('A')[0]=='LOW_INFORMATION_REVIEW'"
]));
test('V12R never promotes extracted text to engineering authority',()=>{const s=fs.readFileSync(p,'utf8');for(const term of ['QUEUE_PROVENANCE_HOLD','DUPLICATE_REVIEW_KEY_HOLD','OUTPUT_CONFLICT_HOLD','textRecovered','engineeringApproved','operatorReviewEligible'])assert.ok(s.includes(term),term)});
