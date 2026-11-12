import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../scripts/Qualify-Fun-RAEM009.mjs',import.meta.url),'utf8');
test('RAEM-009 retains dry-run default',()=>{assert.match(source,/if\(mode==='dry-run'\)/);assert.match(source,/RAEM_009_NO_LIVE_NETWORK=TRUE/);});
test('RAEM-009 retains exact interactive operator confirmation',()=>{assert.match(source,/if\(!exactOperatorConfirmation\(answer\)\)/);assert.match(source,/!process\.stdin\.isTTY\|\|!process\.stdout\.isTTY/);});
test('the review happens after one catalogue check and cannot authorize another',()=>{assert.match(source,/const result=await checkPublicCatalogue\(/);assert.match(source,/reviewPublicCatalogueResult\(result\)/);assert.match(source,/RAEM_011_REVIEW/);assert.equal((source.match(/checkPublicCatalogue\(/g)||[]).length,1);assert.doesNotMatch(source,/setInterval\(/);});
test('the report does not override successful baseline result',()=>{assert.match(source,/if\(result\.state==='PASS'\)console\.log\('RAEM_009_RESULT=PASS PUBLIC_METADATA_ONLY'\)/);});
