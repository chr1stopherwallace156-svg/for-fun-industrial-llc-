import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SELECTIVE_VERSION,bulkOverview,bulkMarkets} from '../src/roofing/roofing-bulk-bridge-v2.mjs';
import {ROOF_BULK_PAGE} from '../src/ui/roofing-bulk-page-v2.mjs';

test('Selective extraction is versioned and no source data is invented',async()=>{
 assert.equal(SELECTIVE_VERSION,'fun-roofing-selective-v3');
 const status=await bulkOverview();
 assert.equal(status.selection.version,SELECTIVE_VERSION);
 assert.equal(status.automatedOutreach,0);
 assert.equal(status.elektronTouched,false);
 assert.equal(status.claimsAboutAllHomes,false);
 assert.equal(status.permitHistoryCoverageVerified,false);
});
test('real source sync calls automatic selective materialization with verified pruning',async()=>{
 const py=await readFile(new URL('../src/roofing/roofing_bulk_v2.py',import.meta.url),'utf8');
 const selective=await readFile(new URL('../src/roofing/selective_extract_v3.py',import.meta.url),'utf8');
 assert.match(py,/materialize_roof_targets\(args.db,drop_irrelevant=True\)/);
 assert.match(py,/LA_ASSESSOR_REQUIRED_FIELDS_MOSTLY_MISSING_HOLD/);
 assert.match(py,/PERMIT_SCHEMA_MISSING_DATE_DESCRIPTION_OR_LOCATION_FIELDS/);
 assert.match(selective,/BEGIN IMMEDIATE/);
 assert.match(selective,/SELECTION_STAGE_VALIDATION_FAILED/);
 assert.match(selective,/INCOMPLETE_UNTIL_VERIFIED/);
 assert.match(selective,/source_check\(c\)/);
});
test('UI defaults to filtered candidates and allows optional enrichment holds',async()=>{
 assert.match(ROOF_BULK_PAGE,/id="selection-selected"/);
 assert.match(ROOF_BULK_PAGE,/id="selection-held"/);
 assert.match(ROOF_BULK_PAGE,/id="selection-excluded"/);
 assert.match(ROOF_BULK_PAGE,/id="include-unclassified"/);
 assert.doesNotMatch(ROOF_BULK_PAGE,/id="include-unclassified" checked/);
 assert.match(ROOF_BULK_PAGE,/S = clip/);
 const js=await readFile(new URL('../src/ui/roofing-bulk-page-v2.js',import.meta.url),'utf8');
 assert.match(js,/selection\.excluded/);
 assert.match(js,/selection\.updated_utc/);
 assert.doesNotMatch(js,/setInterval|WebSocket|localStorage/);
});
test('PowerShell deployment never sends Python code to the Node syntax validator',async()=>{
 const script=await readFile(new URL('../Activate-Fun-Roofing-Bulk-V2.ps1',import.meta.url),'utf8');
 assert.match(script,/if\(\$file -like '\*\.mjs' -or \$file -like '\*\.js'\)/);
 assert.match(script,/ast\.parse\(/);
 assert.match(script,/ROOFING_PYTHON_SYNTAX_FAILED_NO_PORT_CHANGE/);
 assert.ok(script.indexOf('ROOFING_PYTHON_SYNTAX_FAILED_NO_PORT_CHANGE')<
   script.indexOf('$PreviousProcess=Owner'));
});
test('invalid filter inputs fail closed without a database lookup',async()=>{
 await assert.rejects(()=>bulkMarkets({county:'not a county'}),/ROOF_BULK_FILTER_SCHEMA/);
 await assert.rejects(()=>bulkMarkets({city:'<script>'}),/ROOF_BULK_FILTER_SCHEMA/);
});
