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

## V7 — separate read-only permit status evidence (Formula D research)

The independently sampled permit-status check is
`src/roofing/audit_roofing_permit_status_v7.py`. It leaves A, B and C
unchanged and does not claim to determine a roof's replacement need.
It samples up to **30 latest records per ZIP per existing permit-description
classification** (up to 240 for the four study ZIPs), selecting only imported
roof permits joined by exact APN to eligible older Los Angeles parcels.

The status audit validates the original local official CSV archive's
SHA-256 against its completed import receipt, then reads only additional
`STATUS_DESC`, `STATUS_DATE`, `COFO_DATE` columns and the previously
projected public permit identifiers/descriptions needed for reconciliation.
The ordinary import retains its unchanged CSV field projection.

Categories include **Permit Finaled**, **CofO Issued**, **Issued but not
finaled**, **Expired/Cancelled/Revoked**, **Other/unrecognized**, and
**Missing**. Exact normalized status labels drive the categories; uncertain
labels remain **Other/unrecognized**, never promoted by substring or
inference. Status and occupancy date inconsistencies trigger an explicit
review hold, and the script keeps raw status text, street addresses and
permit/APN identifiers out of its report. A `COFO_DATE` is reported as a
separate evidence indicator; it does not establish actual roof replacement.
Even `Permit Finaled` requires verifying inspection and project scope
before asserting the roof work was completed.

The check does not infer roof age, deterioration, leaks, permit-program
completeness, or any homeowner sales interest. The source data is from
LA City permits and **does not cover all LA County jurisdictions**.
The sample is purposefully selected by recency and existing permit class,
not a random sample or census. Independent formal verification requires
checking relevant inspection records and their permitted work scope.

PowerShell (read-only; does not restart the dashboard):
```powershell
$r=Join-Path $HOME 'FunIndustrial-Roofing-Bulk-V2'
$root=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RoofingBulkV2'
python.exe -B (Join-Path $r 'src\roofing\audit_roofing_permit_status_v7.py') --db (Join-Path $root 'roofing.sqlite3') --root $root
```

Nine offline tests cover the hash gate, source receipts, APN mismatch,
status categories, ambiguity, COFO nonfinal inconsistency, future/invalid
status date and refusal to copy private fields into output. The normal
one-port service and Elektron are not affected by an audit.

## V11 — discoverable Roofing Opportunities and operator-clicked recalculation

**Where it is:** the production control center `http://127.0.0.1:8802/`
remains untouched, by design. Open
`http://127.0.0.1:8802/roofing/bulk/#roof-opportunities` directly,
or select **Roofing Opportunities** in the organized workspace
`http://127.0.0.1:8802/ui-preview/`. The roofing page also contains
a highlighted sidebar link and a top-page shortcut to the section.

The separate V10 research section now includes independent controls for
ZIPs (1–10 comma-separated US five-digit ZIPs), minimum house construction
age (20–100), historical permit X-years (10–50), recent neighborhood
permit years (1–10 and below X), permit kind (`replacement_like` or
`roof_related`), same-age cohort ± years (0–15), and minimum peers (3–30).

**No recalculation occurs automatically when the UI opens.** Reading a
saved report is read-only. The only way to request refreshed output
through the UI is an explicit click on **Recalculate these locations**.
It calls a same-origin, operator-click protected POST
`/api/fun/roofing/bulk/recalculate` with exactly seven validated
fields. The reviewed backend runs the existing V9 local analysis over
SQLite `mode=ro`, writing only *new uniquely timestamped local CSV
research exports*. It then verifies the freshly completed report set
before showing the new ZIP, street, property and historical/no-match
counts. It never modifies assessor/permit sources, Formula A–D, or
the source DB. No Qwen, REA, email, paid actions or outreach occurs.

A bounded single-recalculation gate avoids concurrent operator runs;
a source import and research recalculation cannot overlap. The button
disables during the request, the browser presents progress/error text,
and existing completed V9 exports remain available if a new run fails.
There is no recurrent polling or automated high-CPU refresh. Local
recomputation is bounded by a 120-second backend deadline, 1–10 ZIPs,
the existing 1,000-block-per-ZIP/20,000-property limits and a strict
timeout; large requests fail closed rather than changing background
system work. The frontend timeout is 135 seconds.

A protected update of only the already-reviewed `8802` service is
required for new routes to appear in a running Node process. Standard
`Activate-Fun-Roofing-Bulk-V2.ps1 -CheckOnly` tests and static syntax
validation run before process changes; the full activation uses guarded
8802 replacement with rollback and checks that the direct links,
refresh controls and saved-data endpoint are present. The original
homepage, unrelated local services and Elektron are out of scope.

## V10 — automatic Roofing Opportunities offers on the existing roofing page

The separate roofing research page `http://127.0.0.1:8802/roofing/bulk/`
now includes a **Roofing Opportunities by ZIP and street** section. On page
open, the UI makes bounded, read-only, same-origin requests to
`/api/fun/roofing/bulk/opportunities` and, if a complete V9 report exists,
automatically displays aggregate counts, top street blocks, historical
permit candidates, and a small historical property-address preview.
Operator-clicked buttons show the **no-matching-permit** pathway or
**other recent/intermediate permit** pathway. The page can refresh the
local research snapshot on demand without downloading permits, recomputing
the model, or changing the stored data.

The V10 Python reader `src/roofing/roofing_opportunities_v10.py` selects
the most recent `roofing_qualified_property_research_*.csv` timestamp
under `%LOCALAPPDATA%\FunIndustrial\RoofingBulkV2\research_exports`
and opens only a **complete quartet with that identical timestamp**:
ZIP summary, ranked street blocks, property research and recent
permit locations. If any component is missing, V10 returns a hold,
never borrowing stale files from another run. It validates ZIP, street
block, distinct public parcel IDs, property counts and recent-permit
location totals. Source provenance is limited to the previously generated
V9 reports; **internally reconciled** does not imply independent proof
of an actual new roof or exhaustive city coverage.

Displayed pathways stay independent:

- **HISTORICAL**: selected public property has a last recorded exact-APN
  permit of the chosen keyword kind at least X years old.
- **NO_MATCH**: no matching exact-APN record of that chosen keyword kind
  in the imported LA City sources. This is **not** evidence of no roofing
  work.
- **OTHER**: selected property has an intermediate/other recorded permit
  outside the strict X-year old/absent groups.

All are already members of the V9 same-street, similar-age,
recent-peer-permit research cohort. V10 *does not change* Formula A–D or
add a predictive roofing-condition score. Roof age, damages, sales intent,
owner identity and contacts are not inferred or retrieved.

No scheduled background tasks, cross-site queries, local model
inferences, alerts, messages, mail, calls, exports or outreach are
performed by dashboard reads. The original `/` homepage and other
services are unchanged. The updated server route requires a controlled
redeployment of only the reviewed 8802 service; copying new GitHub files
to disk does **not** instantly update a currently running Node process.
The standard `Activate-Fun-Roofing-Bulk-V2.ps1` verifies existing
homepage and interfaces, new opportunity route and security holds before
reporting activation; its `-CheckOnly` mode changes no processes.
A failed live update should restore the previous 8802 process using
the existing rollback.

## V9 — roofing location research is the operational objective

**Goal:** find the actual ZIP codes, 100-number street blocks, and publicly
recorded property locations worth researching for roofing services, rather
than requiring proof of completed roofing from a separate inspection dataset.
Formulas A (existing older-property priority), B (real same-APN historical
permit cycle), C (peer street-block recent permit activity) and independent
optional D (status information) are preserved. V8 inspection matching is
**optional and not part of this targeting workflow**. No homeowner contact
data, messages, sales actions, automatic outreach or new scoring formula.

Run `src/roofing/export_roofing_location_research_v9.py` against the
existing qualified local SQLite data. It requires all four official-import
receipts and read-only database access. It uses the *identical Formula C
age-cohort and permit matching logic* used on the dashboard but collects
**all** qualifying 100-number street blocks instead of only five preview
examples per ZIP. The output is four ordinary UTF-8 CSV files, written
only under `%LOCALAPPDATA%\FunIndustrial\RoofingBulkV2\research_exports`:

1. `roofing_zip_market_summary_*.csv` — ZIP, number of qualified street
   blocks and qualified unique property research candidates.
2. `roofing_ranked_street_blocks_*.csv` — one row per qualifying street
   block, sorted by number of independently qualified properties and
   distinct recent roof-permit parcels; construction-year ranges.
3. `roofing_qualified_property_research_*.csv` — the exact addresses,
   public APNs, building construction year, existing A priority, most recent
   *exact-APN* roof-related permit, years since permit, X-years threshold
   check, and nearby age-matched properties with qualifying permit records.
4. `roofing_recent_permit_locations_*.csv` — the separately matched
   public property addresses of recent roofing-permit parcels in the
   qualifying blocks, latest permit date and keyword classification.
   This shows where **recorded activity** occurs, not verified installation.

Configurable independent inputs: `--years X` (historical same-APN
roof permit threshold, 10–50), `--min-building-age X` (20–100),
`--recent-years R` (1–10 and smaller than historical X),
`--permit-kind roof_related|replacement_like`,
`--peer-years` (0–15) and `--min-peers` (3–30).
The existing A scores are read from the verified V3 index and **not changed**.

Recommended first batch:
```powershell
$r=Join-Path $HOME 'FunIndustrial-Roofing-Bulk-V2';$db=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RoofingBulkV2\roofing.sqlite3';& python.exe -B (Join-Path $r 'src\roofing\export_roofing_location_research_v9.py') --db $db --zips 90037,90049,90731,90011 --years 20 --min-building-age 25 --recent-years 5 --permit-kind replacement_like --peer-years 5 --min-peers 5
```

The 100-number street block is a **same-street address-number proxy**,
not geocoded geographic adjacency or confirmed walking proximity.
A building built 30 years ago may have a brand-new roof.
A permit containing `REROOF` is **not confirmation** of completed
replacement; a missing permit match does **not** establish that no roofing
work occurred. Older buildings and permit history indicate *where to
research*, not roof damage, replacement need, or a probability of purchase.
The LA City permit history does not cover every municipality in LA County.
Always confirm before any commercial claims, and comply with local outreach
rules. The CSVs are local-only; they are not uploaded to GitHub.

## Historical inspection eligibility cutoff after 12 newest permits had no matches

The initial V8 12-permit sample across 90037, 90049, 90731 and 90011
was uniformly issued in November 2026. All 12 permit numbers passed the
local format gate, but none matched the separately published inspections
dataset. This is **not** evidence that the permits were never inspected:
inspection data can lag recent issuance. A direct identifier mismatch or
source coverage issue also remains possible.

Use `--issued-before 2026-10-01` to select the latest eligible permits
with issue dates **on or before 2026-09-30**, without changing the default
V8 sample. This is an **exclusive** date boundary. The existing five-year
lower bound stays in effect. Historical results remain a convenience
sample, not a coverage estimate or proof of completion.

For the exact same masked ID-shape and issuance-month diagnostic, the
read-only `diagnose_inspection_permit_shapes_v8.py` also accepts
`--issued-before 2026-10-01`. Neither script rewrites the original
SQLite database, dashboard, or roof-neighborhood formulas. The remote
probe continues to use only the fixed verified HTTPS source, strict
permit-ID matching, limited rows and data size, and no row persistence.

Run both sequentially, if desired (read-only, one command line):
```powershell
$r=Join-Path $HOME 'FunIndustrial-Roofing-Bulk-V2';$db=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RoofingBulkV2\roofing.sqlite3';& python.exe -B (Join-Path $r 'src\roofing\diagnose_inspection_permit_shapes_v8.py') --db $db --per-zip 3 --issued-before 2026-10-01;if($LASTEXITCODE -ne 0){throw 'HISTORICAL_SHAPE_HOLD'};& python.exe -B (Join-Path $r 'src\roofing\probe_ladbs_inspections_v8.py') --db $db --per-zip 3 --issued-before 2026-10-01
```

## V8 — independent LA building-inspection matching preflight

The official LA City Building and Safety Inspections dataset
`9w5z-rg2h` publishes `permit`, `permit_status`, `inspection`,
`inspection_result` and `inspection_date`. The V8 tool performs a tiny
read-only API query to this exact official source, without mirroring the
roughly 12-million-row dataset.

`src/roofing/probe_ladbs_inspections_v8.py` samples up to **3 recent,
replacement-like exact-APN matched permits per ZIP** (maximum configurable
five per ZIP across four currently selected LA ZIPs). It uses the existing
completed LA City permit source and its SQLite index in read-only mode,
normalizes bounded public permit numbers, and requests only selected fields
from the fixed official Socrata REST endpoint. A maximum of 500 remote
inspection rows and 1.5 MB JSON response is enforced; a response at the
cap triggers an uncertainty hold instead of pretending to be exhaustive.

Reports aggregate sample sizes and whether selected public permit numbers
appear in the official inspection dataset. A positive **Final inspection
type + Approved/Passed result + valid inspection date** is counted as
*approved final-inspection evidence only*: **not proof** that a replacement roof
was actually installed, that it matched a specific work scope, or that a
roof remains in particular condition. Separate counters record `Permit Finaled` in the official inspection
result and `permit_status` fields, without treating that wording as an
`Approved` or `Passed` final inspection result. The same permit may occur
in more than one evidence counter; do not sum these as distinct projects.
Unknown inspection types/results,
no returned match, API throttling/unavailability, dataset lag and source
coverage gaps are not interpreted as completed, missing or failed roofing
work. It never prints permit numbers, APNs, addresses or contact details.

The tool neither updates A/B/C/D nor stores rows, schedules jobs, makes
contact, or restarts the dashboard. Network access is limited to one
operator-triggered GET to the pinned `data.lacity.org` source with TLS,
redirect rejection and bounded result size. Nine offline no-network tests
cover joins, permit-number filtering, no-record uncertainty, malformed
calendar dates, response limits, source receipts and input bounds.
The inspection dataset is City of LA, **not LA County-wide** coverage.

Run with existing Windows Python and local database after the reviewed
GitHub branch is updated (no service restart):
```powershell
$r=Join-Path $HOME 'FunIndustrial-Roofing-Bulk-V2'
$db=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RoofingBulkV2\roofing.sqlite3'
python.exe -B (Join-Path $r 'src\roofing\probe_ladbs_inspections_v8.py') --db $db --per-zip 3
```

## Preflight

The guarded deployment reruns prior Node.js tests and the original Python
bulk tests plus \`test_selective_v3.py\` before replacing the 8802 worker. A
failure retains the previous service. GitHub publishing alone does not
activate the user's Windows PC or download public records.
