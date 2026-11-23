# Fun Industrial Roofing Bulk V2 — complete-public-file architecture

## Fundamental scope

This branch introduces **local, disk-backed bulk indexing** for LA County parcel rolls and Los Angeles City full issued building-permit data. The former 1,000-row sample pilot stays available at \`/roofing/\` as an archive, but **the primary navigation opens \`/roofing/bulk/\`**.

Full official files are much more useful than small recent samples. However, **LA County is not a single permit jurisdiction**; City of Los Angeles issued permits do not cover all other cities or LA County unincorporated areas. San Bernardino County assessor parcel rolls and the separate cities' roofing permit data must also be ingested. No program can truthfully infer the complete roof-replacement history of every home just from county assessor records.

The source tables store APN, ZIP, jurisdiction, street address (if legitimately provided), building year and limited land-use attributes. **Owner names, phone numbers, emails and other contact information are not extracted.** A parcel is **not necessarily one house**, and a roof-related permit is not necessarily proof of roof replacement. A missing permit means a **no-match in source data**, not that no roofing work occurred.

## Official source directory and credentials

1. **Los Angeles County assessor parcel roll 2021–2025**, official source:
   https://www.arcgis.com/home/item.html?id=70d93266f45a4080a97b285a471493cd
   Full archived CSV ZIP:
   https://apps.gis.lacounty.gov/static/hub/Assessor/Assessor_Parcel_Roll_2021_2025.zip
   The archive covers multiple roll years; the importer deduplicates by county/APN and prefers a newer roll year. Download does not prove every home or structure is present.
2. **Los Angeles City issued building permits, before 2010**, \`e67z-kt2n\`:
   https://data.lacity.org/d/e67z-kt2n
3. **Los Angeles City issued building permits, 2010–2019**, \`dyxf-7hc4\`:
   https://data.lacity.org/d/dyxf-7hc4
4. **Los Angeles City issued building permits, 2020–present**, \`pi9x-tg5x\`:
   https://data.lacity.org/d/pi9x-tg5x
5. **San Bernardino County official ArcGIS parcel FeatureServer**, full public layer:
   https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Parcels_for_San_Bernardino_County/FeatureServer/0
   The importer pages through the entire published layer (1,000 features per page; max 1,600 pages) and stores **only parcel number, jurisdiction, classification and source metadata**, never protected owner names. This layer does **not** contain site street addresses or year built, so it cannot independently produce address-level roof-age leads. The imported parcels remain candidates with incomplete physical details until an authorized characteristic/address source is joined.

6. **San Bernardino County assessor property characteristics**, official:
   https://arc.sbcounty.gov/property-information/
   The county provides a property-characteristics ZIP (NP450) and a bulk export in its **govPIMS** property portal https://arcpropertyinfo.sbcounty.gov/ .
   The published ZIP can be downloaded, but NP450 is a special **fixed-width format**. The automated importer deliberately refuses to treat it as CSV. Export a legitimate CSV from govPIMS or obtain an authorized conversion and inspect its schema before ingestion. Protected personal records must not be bypassed.
7. **Other municipal and county permitting authorities**: official published CSV/export or formally approved data access must be set up for each jurisdiction. No universal roof permit API key exists.

The LA open-data full SODA3 public CSV exports use \`https://data.lacity.org/api/v3/views/<ID>/export.csv\`; they do not require an API key. The old SODA1 rows export retires in December 2026. An optional developer app token can be supplied as the process environment variable \`SOCRATA_APP_TOKEN\` if an authorized user obtains one. Neither the dashboard nor source-control files display or store token contents.

## One-command installation

From a clean checkout on the branch \`feature/fun-roofing-bulk-v2-20261123\` run:

\`\`\`powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Fun-Everything-Bulk-V2.ps1
\`\`\`

The launcher validates the known Windows core, ML and gateway, then tests and activates the 8802 UI only if the full bulk source is not already active. Tests are run before stopping the previous verified dashboard process, and rollback is attempted if the new 8802 fails validation. All other ports and ELEKTRON remain untouched.

After activation open \`http://127.0.0.1:8802/roofing/bulk/\`.
Use the five source buttons to **download full published files** one by one. The server starts one local import job at a time; **the click does not mean the download has completed**. Use **Check import status** to see the latest job, and inspect source-run row counts and status.

The PC's 16 GB RAM is preserved by streaming CSV/ZIP files with bounded buffers into a locally indexed SQLite database. Full files can occupy multiple gigabytes of disk, and downloads are capped by default at 8 GB per file; official files exceeding limits fail safely. Full imports are not guaranteed to succeed until the real source formats are inspected and the desktop run is verified.

The process uses \`python.exe\` (Python 3.12 supported) and Node on the local Windows host. Python and Node offline tests precede activation.

## Approved operator CLI

The same engine is usable directly for large official records:

\`\`\`powershell
python.exe .\src\roofing\roofing_bulk_v2.py status
python.exe .\src\roofing\roofing_bulk_v2.py sync la_assessor_2021_2025
python.exe .\src\roofing\roofing_bulk_v2.py sync la_permits_pre2010
python.exe .\src\roofing\roofing_bulk_v2.py sync la_permits_2010_2019
python.exe .\src\roofing\roofing_bulk_v2.py sync la_permits_2020_present
python.exe .\src\roofing\roofing_bulk_v2.py sync sb_arcgis_parcels
python.exe .\src\roofing\roofing_bulk_v2.py markets --min-age 20 --include-unclassified
python.exe .\src\roofing\roofing_bulk_v2.py candidates --only-no-permit --include-unclassified
\`\`\`

If countywide **San Bernardino govPIMS CSV** is obtained via authorized export, ingest from disk (review column mappings first):

\`\`\`powershell
python.exe .\src\roofing\roofing_bulk_v2.py inspect --file "C:\PATH\TO\OFFICIAL.csv"
python.exe .\src\roofing\roofing_bulk_v2.py ingest --file "C:\PATH\TO\OFFICIAL.csv" --source-id municipal_sb_govpims_full --kind sb_properties --county "San Bernardino"
python.exe .\src\roofing\roofing_bulk_v2.py rebuild
\`\`\`

City or unincorporated area permit CSVs can likewise be imported with \`--kind municipal_permits --county ... --jurisdiction ...\` **only** when the source is officially authorized and has the required address/APN/date/roof-description fields. Other formats need an explicit adapter, not silent ingestion.

Disk storage: \`%LOCALAPPDATA%\FunIndustrial\RoofingBulkV2\roofing.sqlite3\` with official downloaded source files under \`official_downloads\`. Every source import is hashed and recorded with a status and row counts. Interrupted/incomplete imports are held out of candidate calculation. The warehouse does **not** send messages, search for private owner identities, or submit permits.

## Formula and interpretation

A review score (not calibrated probability) is:

\`priority=min(100,min(50,max(0,building_age_if_known))+
  35[roof-related permit >=20yr]+20[no roof-related permit in imported data]+10[classified residential])\`

A **recent roof-related permit** receives neither the +35 nor the +20 increment.
A property with **no observed permit stays eligible**, including properties with unknown construction year. The result is a simple sorting rule, not scientific proof of rooftop deterioration or profitable sales. Inspect records and property conditions before making claims.

The final target model should estimate:

\`Expected net opportunity = Pr(roofing need|verified signals) * Pr(contract wins|compliant outreach) * expected project gross margin - contact/inspection/data costs\`

Both probabilities require real labeled inspections and completed project outcomes, proper train/holdout separation, and calibration. Until then they are unknown, not fabricated.

## Completion criteria

System installation: API endpoints, local worker and safeguards verified on PC.

Data installation: each official file fully downloaded (with byte count and SHA-256), ingested and source status marked \`INGESTED_NOT_COMPLETENESS_VERIFIED\`; candidates rebuilt; per-county row counts reviewed.

Countywide coverage: **not achieved by this branch alone**. The official SB ArcGIS parcel IDs can be paginated from the whole published layer, but they lack roof age and street address. Completing countywide address-level coverage requires full SB parcel enrichment and permit source acquisition from LA and SB incorporated cities and unincorporated agencies, source continuity audits and municipal gap reporting. No output should be advertised as "every house" before that independent reconciliation.

Keep original dashboard, Qwen, Math V3 and REA permissions unchanged.
