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

## Preflight

The guarded deployment reruns prior Node.js tests and the original Python
bulk tests plus \`test_selective_v3.py\` before replacing the 8802 worker. A
failure retains the previous service. GitHub publishing alone does not
activate the user's Windows PC or download public records.
