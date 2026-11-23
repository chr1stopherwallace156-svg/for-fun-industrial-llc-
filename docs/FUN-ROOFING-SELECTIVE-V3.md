# Roofing Selective V3 — Real data, kept evidence, discarded irrelevance

## Purpose

On each explicitly operator-initiated complete source sync, the local importer
validates source columns and at least one recognizable record, ingests only
whitelisted non-owner parcel fields or roof-related permit records, and then
automatically builds a selective county/city/ZIP targeting index.

Real public data sources already allowlisted: LA County Assessor 2021–2025
parcel-roll ZIP, City of LA issued permits pre-2010 / 2010–2019 / 2020–present
SODA3 full CSV exports, and San Bernardino countywide ArcGIS parcel layer.
No API keys are needed to initiate these public exports. The San Bernardino
ArcGIS layer has APN and jurisdiction but **not verified building year or street
address**; those records remain enrichment holds. No universal countywide roof
permit database exists; incorporated cities need distinct official feeds.

## Deterministic formula

Each property receives an uncalibrated **research priority**:

S = clip(40 × age_relevance + 20 × old_roof_record +
         10 × no_record_observed + 15 × residential_evidence +
         15 × data_completeness, 0, 100)

- age_relevance = clip((building_age − 15)/30, 0, 1), 0 if unknown
- old_roof_record = 1 if the last observed roof-related permit was ≥20 years ago
- no_record_observed = 1 if no matching roof permit exists in **ingested**
  sources; this is **not** proof that roof work never happened
- residential_evidence = 1 for a classified residential parcel, 0.25 otherwise
- data_completeness = number of known values among APN, address, ZIP,
  building year, residential flag, divided by 5

The formula is not a roof-replacement probability, proof of damage, expected
revenue, or a promise of a customer. Real inspections and contractor outcomes
would be required to calibrate it.

## Property decisions

**KEEP:** plausible residential parcel ≥20 years old with address and ZIP.

**HOLD:** missing address, unknown year built, uncertain property
classification, or younger residential parcel. Holds are retained with
minimal identification fields for later enrichment, and **not** shown among
ready targets by default. A younger parcel with no roofing permit is retained.

**DROP:** clearly non-residential property (e.g. industrial warehouse),
or unusable parcel identifiers with no address fallback. Only this class may
be pruned from the imported property table following full validation.

Permit-related data continues to be stored for historical matching, even
when its parcel record is not currently a qualified residential target.
No owner names, emails, or phone numbers are stored or enriched.

## Data safety

- The importer validates required field names, recognized parsed rows and
  sanity thresholds for LA assessor building-year and street-address completeness.
  Source ZIP fields can collide after column-name normalization. For property
  records, conflicting ZIPs are resolved **only** when the official Property
  Location contains a full explicit situs ZIP; otherwise the parcel remains
  in an enrichment HOLD with ZIP unknown. Even a single column ZIP cannot
  override an explicit situs ZIP. Roof permit imports with conflicting ZIPs
  continue to fail closed. Unknown formats are held rather than counted as
  verified roofing data.
- On the already-downloaded LA assessor archive, `inspect` exposes only
  mapped column names and original duplicate ZIP header labels. A separate
  bounded `probe-assessor` examines up to 1,500 rows for **aggregate counts
  only**: rows with valid identifiers, address/year, ambiguous ZIPs, and ZIPs
  recovered directly from situs addresses. It never outputs individual
  owner details, addresses, ZIP values, or parcel IDs. This is sample-quality
  evidence, **not a successful full import**.
- Selection builds indexed temporary tables with bounded batches (~2,000
  rows); it validates KEEP+HOLD+DROP counts before a transactional swap.
- The current official source must have a completed ingest state; interrupted
  sources are excluded from all permit matching and selection.
- Definite drops are removed from the local property table *only after*
  the selection index validates. Superseded unfiltered candidate-cache rows
  are also cleared after successful replacement. Source receipt counts and
  source SHA-256 evidence are retained.
- Downloaded official ZIP/CSV source archives are **retained for audit and
  replay**. Automatic deletion of those large archives is not enabled until
  they can be independently reconciled and a separate cleanup policy
  verified. No other Fun Industrial, Qwen, REA or Elektron directories are
  modified. SQLite physical file size may not shrink until separately
  reviewed compaction; logical pruning does reclaim reusable space.
- A source with an obsolete format or failed validation does **not**
  trigger pruning.

## Activation / real data

1. Deploy the updated reviewed 8802 system by running
   \`Activate-Fun-Roofing-Bulk-V2.ps1\`.
2. Initiate the first full real source import with
   \`Start-Fun-Roofing-RealData-V3.ps1 -Source la_assessor_2021_2025\`.
3. View \`http://127.0.0.1:8802/roofing/bulk/\` and use **Check import
   status** to inspect the worker. Its request acknowledgement is not proof
   of completed download or import.
4. Once the first import verifies, use each remaining full-source button
   individually: LA City issued permits for the three historical periods,
   then San Bernardino ArcGIS parcel identifiers. Only one source sync runs
   at a time; never run multiple independent writers against this database.
5. Compare actual accepted source rows, selective target counts, held
   enrichment records, excluded records, and completed file hashes.
6. Additional separate municipal building-permit authorities are required
   before alleging every house or full 20-year roofing history is covered.

**A zero-property result without a successful source ingest is a data gap,
not a true count of houses needing roofing work.**

## Windows-native official LA City permit CSV download

On some Windows Python installations, the OpenSSL trust bundle cannot build
the LA City data portal's HTTPS certificate chain and Python fails with
`SSL: CERTIFICATE_VERIFY_FAILED` before any permit records are read.
For an explicit operator-selected `la_permits_*` source, the guarded launch
script now downloads the allowlisted official `data.lacity.org` CSV with
Windows-native .NET `HttpClientHandler` and the Windows certificate store.
The downloader:

- Accepts only the three pinned official LA City export URLs and **HTTPS**.
- Requires Windows certificate verification (never disables TLS checks).
- Rejects redirection to a different host, plain HTTP, or too many redirects.
- Rejects non-CSV responses, HTTP failures, empty or oversized bodies.
- Streams in 1 MiB buffers to a private incomplete file, records the SHA-256
  checksum, checks content length when provided, and atomically moves the
  complete file into the normal Python import cache.
- Leaves a previously downloaded official CSV intact; no second download
  and no deletion of the LA assessor archive. An incomplete new attempt
  cannot replace an existing verified file.
- Invokes the existing local Python `sync` after a verified source download.
  Python sees an existing local file and does not retry its failing TLS path.
  Import/permit matching still require their own source schema, row and
  selective-index validation to report successful completion.

The native downloader is `Download-Fun-LACity-Permits-WindowsTLS-V1.ps1`,
called automatically from `Start-Fun-Roofing-RealData-V3.ps1`. Network errors
are held; users are not asked to install unknown certificates or weaken HTTPS.
No new background services, model/REA calls, emails, sales outreach, payments,
or Elektron changes are authorized.

## Evidence-based 500-property research pilot

After completing the assessor and all three LA City permit sources, run the
optional read-only `src/roofing/export_roofing_pilot_v1.py` command from the
reviewed local repository. It selects **four ZIPs** from the user's observed
market counts: 90011, 90049, 90731 and 90037. Each contributes **125 public
parcel records** (65 with a latest roof-related permit dated 20+ years ago
and 60 with no match in imported LA City permit history). Every parcel must
be a selected residential research candidate and the building must be
at least 25 years old. It is a deliberately balanced review sample, **not**
a statistically representative random sample or a list of confirmed needs.

The export:
- Opens existing SQLite using `mode=ro` and `PRAGMA query_only=ON`.
- Requires four completed official source receipts and the validated V3
  selection index; stops on missing or insufficient strata.
- Excludes any parcel with more recent roof-related permit evidence from
  these two specific review cohorts. Those excluded from this pilot remain
  in the database and can be researched separately.
- Orders each quota deterministically by bounded research score, older
  construction year, and APN. Scores are not roof-condition or conversion
  probabilities.
- Writes exactly 500 records into the user's local roofing `research_exports`
  directory with source parcel ID, street address, city, ZIP, building year,
  latest recorded roof-related permit, evidence cohort and next verification.
  No contact names, telephone numbers, emails or owner identities are stored.
- Escapes spreadsheet formulas in all CSV fields. No marketing actions,
  outbound requests, license checks, database mutation, dashboard restart,
  Qwen calls, procurement mutation, or Elektron changes are made.

A recorded permit may be for roofing work other than a completed replacement;
a missing match is **not** evidence of never having roof work. LA City permit
feeds do not provide verified coverage for all municipalities in LA County.
Review original permit details and property-specific history before treating
a research sample as a sales opportunity.

## Two parallel mathematical models: Existing V3 + permit-cycle V4

The user's original Selective V3 formula remains unchanged, using age
relevance, old permit flag, no observed permit flag, residential type, and
evidence completeness for a bounded research-priority score. It does
**not** estimate actual roof age or roof replacement probability.

The new independent V4 formula reads the indexed property records and actual
LA City historical permit records **without writing to the database**:

- Choose ZIP codes (1–10 five-digit values), construction age (20–100 years),
  historical interval `X` (10–50 years), recent window `R` (1–10 years, R < X),
  and either *roof-related permits* or the narrower *replacement-like
  description* class (classification is not completion verification).
- `Gap_i(X)=1` if parcel `i` has an exact APN-matched roof-related
  permit dated at least X years before the current calculation.
- `Repeat_i(X,R)=1` if the **same parcel** has both a roof-related permit in
  the last R years and an earlier recorded roof-related permit at least X
  years before that newer permit. These are *recorded permit intervals*,
  not verified reroof cycles.
- `ZIP_recent_activity_per_1000 = 1000 * selected older parcels with
  recent APN-exact roof permits / all selected older parcels in ZIP`.
- `ZIP_observed_repeat_share = 100 * same-parcel long-gap recent repeats /
  parcels with a recorded permit at least X years old` (null without
  historical evidence). This is a historical observation subject to
  record incompleteness and selection bias, **not** a predictive hazard
  or calibrated replacement probability.

V4 uses exact county+APN matching for observed repeat counts and **does
not** infer missing roof work from absent permits. V3 may additionally
include conservative address matching and is reported separately, with
different evidence strength. Recent permits in this dataset mean
*recent relative to the last imported file*, not ongoing live monitoring.

The `/roofing/bulk/` dashboard includes two distinct panels and an
operator-initiated **Calculate both formulas** control. The API is GET-only
`/api/fun/roofing/bulk/formulas`, bounded by ZIP, interval, recent window,
and permit classification. It never restarts AI, calls models, emails
anyone, downloads external records, modifies the indexed data, or changes
the existing production homepage.

CLI comparison (after the completed official imports):

`python -B src/roofing/roofing_dual_formulas_v4.py --db "%LOCALAPPDATA%/FunIndustrial/RoofingBulkV2/roofing.sqlite3" --years 20 --recent-years 5`

## Formula C — similar-age neighborhood permit activity (V5)

**Reason for this separate formula:** investigate the hypothesis that older
houses in a comparable small area might experience some correlated roofing
work as shingles weather or age. Data from permits can test local *recorded
activity*, **not** infer a neighbor's leaks, worn shingles, a completed
replacement or the subject property's roof age.

The already-working Formula A (existing V3 research priority) and Formula B
(same-APN historical/recent permit gap) remain intact and are calculated
independently. Formula C is a *third* report on the same read-only route, with
user-adjustable filters:

- **X** = historical permit-gap years for Formula B (10–50, default 20).
- **R** = recent roof-permit window for B and C (1–10 years, default 5).
- **Construction age** = minimum building age (20–100, default 25).
- **±Y** = comparison band around a candidate property's construction year
  (0–15 years, default ±5).
- **Minimum peers** = at least 3–30 *other* selected residential parcels in
  the same named street and number 100-block, default 5.

For an eligible older parcel without a recent exact-APN roofing permit, C
finds other eligible properties with identical ZIP, normalized street name,
and street-number block (e.g. 100–199), whose construction years fall within
±Y years of its construction year. It counts **distinct other parcels** with
a roof-related permit in the last R years, then displays aggregate results by
ZIP. A subject property with its own recent permit is not labeled an
unpermitted-neighbor candidate. Unit/suite addresses, unknown years and
unparseable streets are not used for neighborhood comparisons.

This is **only a proxy for neighbors**, not geographic adjacency or actual
distance: long streets, multi-address parcels, street spelling differences,
subdivisions and missing unit information can mislead the grouping.
Conservative default reporting requires at least five comparable peers.
Reports include a denominator, local peer permit share, ZIP-wide reference
permit share, and an observational comparison ratio when there is enough
evidence; overlapping neighbor windows are *not independent* observations.

**Overlap control (V5 extension):** a ZIP-level
`unique_street_blocks_with_two_or_more_age_matched_recent_peer_permits`
counts a normalized same-street 100-number block **once** if at least one
eligible subject property has two or more recent, exact-APN,
age-comparable neighbor permit matches. This count is distinct from the
number of eligible subject properties. An additional capped list of up to
five unique qualifying street blocks **per ZIP** shows the block label,
distinct selected older parcels on that block, distinct APNs with recent
roofing permits, the number of qualifying subject windows, and the observed
construction-year range. These ZIP-level block counts should not be added
to the property counts. Multiple subjects within a block may share their
same observed permit neighbors; this is not an independent statistical
sample or proof of damage.
No statistical significance or roof-replacement probability is inferred.

Only official completed LA City permit sources and exact assessor APN joins
enter B and C. Other municipalities remain unverified; ZIP-only permit
matches do not establish that any subject property has a new roof.

The module is `src/roofing/roofing_neighbor_context_v5.py`. The same
**Calculate all three formulas** dashboard button calls it alongside V3 and
V4 with read-only SQLite; no new job, automated outreach, Qwen, REA,
Elektron access, database writes, or permanent raw data are introduced.
Seven isolated tests validate the street-block proxy, multiple recent peer
permits, construction-year tolerances, minimum peer counts, source isolation,
unique block deduplication, and A/B/C integration.

## V6 source-description audit of roof-permit keyword classifications

Run `src/roofing/audit_roofing_permit_descriptions_v6.py` independently of
the dashboard and source imports. It reads the existing local SQLite in
`mode=ro`, requests 12 recent exact-APN permit IDs per ZIP per existing
classification (`REPLACEMENT_LIKE` and other roof-related descriptions),
then streams the relevant official LA City permit archives. ZIPs default to
90037, 90049, 90731, and 90011; recent window defaults to five years.
This is a **purposefully stratified latest-permit sample**, not a random
sample, a census, a statistical replacement rate, or a formal classifier
accuracy estimate. In sparse source/ZIP groups fewer than 12 records
may exist.

Every archive used must match the exact filename and SHA-256 recorded by
the prior completed import receipt. A failed/missing source or mismatched
hash makes the check fail closed; no source is downloaded again. Original
work-description records are matched back to stored permit IDs; the audit
counts explicit reroof/replacement text, mixed repair/replacement terms,
repair/maintenance/leak terms, other roof-related language, and potentially
negated replacement text (e.g. "no reroof"), separately. It also checks
whether the current stored keyword classification agrees with the archived
work description.

**Important:** A matching description **never** establishes issuance status,
project completion, the roof's installation date, deterioration, need for
replacement, or a homeowner's intent. Ambiguous negations require manual
review. No address, owner/contact fields, raw descriptions, or permit IDs are
printed or saved by the audit. The tool returns aggregate category counts,
source/ZIP sample sizes, and explicit holds. It does not modify the roofing
database, existing three formulas, local dashboard, Qwen, REA or Elektron.

Operator command (PowerShell after updating the reviewed local branch):
```powershell
$r=Join-Path $HOME 'FunIndustrial-Roofing-Bulk-V2'
$db=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RoofingBulkV2\roofing.sqlite3'
$root=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RoofingBulkV2'
& python.exe -B (Join-Path $r 'src\roofing\audit_roofing_permit_descriptions_v6.py') --db $db --root $root
```
A nonzero exit and `*_HOLD` is a real audit hold, not a missing roofing need.

## Preflight

The guarded deployment reruns prior Node.js tests and the original Python
bulk tests plus \`test_selective_v3.py\` before replacing the 8802 worker. A
failure retains the previous service. GitHub publishing alone does not
activate the user's Windows PC or download public records.
