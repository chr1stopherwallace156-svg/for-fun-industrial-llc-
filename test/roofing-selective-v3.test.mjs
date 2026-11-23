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
test('Windows permit downloader requires real TLS chain and fixed official host',async()=>{
 const code=await readFile(new URL('../Download-Fun-LACity-Permits-WindowsTLS-V1.ps1',import.meta.url),'utf8');
 assert.match(code,/\[ValidateSet\('la_permits_pre2010','la_permits_2010_2019','la_permits_2020_present'\)\]/);
 assert.match(code,/https:\/\/data\.lacity\.org\/api\/v3\/views\/pi9x-tg5x\/export\.csv/);
 assert.match(code,/\$remote\.Scheme -cne 'https' -or \$remote\.Host -cne 'data\.lacity\.org'/);
 assert.match(code,/\$handler\.AllowAutoRedirect=\$false/);
 assert.match(code,/\$next\.Scheme -cne 'https' -or \$next\.Host -cne 'data\.lacity\.org'/);
 assert.match(code,/HttpCompletionOption\]::ResponseHeadersRead/);
 assert.match(code,/\$maxBytes=\[long\]\(8GB\)/);
 assert.match(code,/\[IO\.File\]::Move\(\$tempPath,\$destination\)/);
 assert.match(code,/\$sha\.TransformFinalBlock/);
 assert.match(code,/FUN_LACITY_NATIVE_CERTIFICATE_VALIDATION=PASS/);
 assert.doesNotMatch(code,/SkipCertificateCheck|ServerCertificateValidationCallback|CertificatePolicy|SslProtocols\]::None|ValidateServerCertificate\s*=|TrustAllCerts|CertificateValidation=\$false/i);
});
test('permit launcher performs certificate-verified download before local sync; source archives are reusable',async()=>{
 const launcher=await readFile(new URL('../Start-Fun-Roofing-RealData-V3.ps1',import.meta.url),'utf8');
 const downloader=await readFile(new URL('../Download-Fun-LACity-Permits-WindowsTLS-V1.ps1',import.meta.url),'utf8');
 const activation=await readFile(new URL('../Activate-Fun-Roofing-Bulk-V2.ps1',import.meta.url),'utf8');
 assert.match(launcher,/Download-Fun-LACity-Permits-WindowsTLS-V1\.ps1/);
 assert.match(launcher,/FUN_LACITY_WINDOWS_CERT_VERIFIED_DOWNLOAD_FAILED_NO_IMPORT_STARTED/);
 assert.ok(launcher.indexOf('FUN_LACITY_WINDOWS_TLS_DOWNLOAD=COMPLETED_IMPORT_STILL_PENDING')<
   launcher.indexOf('$response=Invoke-RestMethod @params'));
 assert.match(launcher,/FUN_REALDATA_REUSE_CACHED_ARCHIVE_BYTES/);
 assert.match(downloader,/FUN_LACITY_CACHED_CSV_RETAINED_BYTES/);
 assert.match(activation,/Download-Fun-LACity-Permits-WindowsTLS-V1\.ps1/);
});
test('invalid filter inputs fail closed without a database lookup',async()=>{
 await assert.rejects(()=>bulkMarkets({county:'not a county'}),/ROOF_BULK_FILTER_SCHEMA/);
 await assert.rejects(()=>bulkMarkets({city:'<script>'}),/ROOF_BULK_FILTER_SCHEMA/);
});
