# FIAL5.8 — Regulatory, Institutional Fleet and Economic Intelligence

**Fun Industrial is software; ELEKTRON INDUSTRIAL LLC is the operating business.**

## Objective

Enable the existing Fun Industrial four-times-daily executive worker to know *where to look* for official changes, track dated regulatory milestones, preserve source fingerprints and history, and identify plausible fleet and equipment business research across California public fleets, school districts, community colleges, CSU, UC, transit and airport shuttle operators.

This is NOT a declaration of compliance, a legal filing system, or a fleet/contract acquisition system. Exact vehicle testing deadlines must come from the CTC-VIS account for that specific vehicle. Public bid listings and customer opportunities are not confirmed merely because a supplier portal exists.

## Implemented, no Gmail OAuth required

- **Eight bounded official endpoints**: CARB Clean Truck Check, CARB deadline schedules, CARB school-fleet regulations, CARB on/off-road heavy-duty resources; University of California Procurement; CSU Supplier Resources/CSUBUY; U.S. Bureau of Labor Statistics API v1 (keyless POST for CPI-U and unemployment); and the U.S. Federal Register topic-filtered JSON API. Federal notices are **unreviewed leads**, not California compliance requirements.
- No generic search-engine scraping. All HTTPS destinations, including the exact Federal Register query, are fixed in reviewed source and validated before requests.
- First official source download creates a **baseline**, never a fabricated rule change. Later differing bytes yield a SHA-256 source change requiring human review. No automatic statutory or regulatory amendment inference.
- File evidence is saved as immutable source snapshots in `%LOCALAPPDATA%\FunIndustrial\ExecutiveOperatorV1\RegulatoryEconomicV58\`. Existing snapshots and history are retained; the last-cycle ledger is overwritten atomically with its latest receipt, and the last 48 cycle summaries are preserved.
- `24–48 hour` source-specific refresh windows within the existing 01:00/07:00/13:00/19:00 logged-on Windows cycles. No continuous polling, extra Qwen instance, external SMTP process, or new database.
- Two **actual** official BLS economic series: `CUUR0000SA0` CPI-U all items (U.S. national index) and `LNS14000000` civilian unemployment rate (U.S. national percentage). Historical monthly points are plotted without forecasts. These are **not** electricity prices, battery landed costs, local procurement data or verified Elektron expenses.
- Major CARB regulatory anchors annotated with domain, published time precision, applicability, exemptions, primary link and evidence requirements, plus dates such as January/April 2027, October 2027, 2035, 2040 and 2045. The year **2037 is intentionally unverified**.
- On the existing `http://127.0.0.1:8802/operations/`, readable date timeline, native SVG historic BLS graphs, official-source statuses, checksum excerpts and education procurement research categories. Source content is not inserted as executable HTML.
- Qwen receives a small extra *read-only structured source-reference context* when a question matches regulatory, fleet, school/university or economic topics; source HTML and unverified third-party instructions never enter Qwen context. Existing Cognee, REA, commerce and Qwen endpoints are unchanged.

## Example official milestones with distinct meanings

- **October 2027**: Covered OBD-equipped Clean Truck Check vehicles move to four emissions compliance tests annually. This is a **month-level milestone**; individual dates are recorded in CTC-VIS. Agricultural vehicles and defined non-commercial motorhomes differ. [CARB CTC](https://ww2.arb.ca.gov/vehicle-owners-emissions-compliance-testing-requirements-clean-truck-check).
- **January 2027**: Current CARB state/local government ACF purchase schedule reaches 100% ZEV or qualifying NZEV purchases (subject to amendments, category and exemptions), **not all existing fleet vehicles**. [CARB ACF schedule](https://ww2.arb.ca.gov/zero-emission-regulation-deadline-schedules-truckstop).
- **April 1 annual reporting**: ACF state/local fleet annual reporting context, only if a covered agency is subject to it. Individual institutions are not presumed compliant or noncompliant. [CARB ACF](https://ww2.arb.ca.gov/advanced-clean-fleets-truckstop).
- **January 2035**: Under AB 579, covered newly purchased or contracted school buses must be zero-emission where feasible; not a blanket retirement deadline for existing buses. [CARB school-fleet guide](https://ww2.arb.ca.gov/our-work/programs/school-buses/regulations-affecting-school-fleets).
- **2029 and 2040**: Innovative Clean Transit requirements for covered transit agencies, not automatically school district/UC shuttle operations. [CARB program schedule](https://ww2.arb.ca.gov/zero-emission-regulation-deadline-schedules-truckstop).
- **2045**: California statewide carbon-neutrality policy, not a universal individual fleet replacement date. [CARB GHG limits](https://ww2.arb.ca.gov/ghg-limits).
- **2037**: Research watchpoint only, with no confirmed authority or obligation.

## Procurement and education sectors

UC: official [UC Procurement public resources](https://procurement.ucop.edu/), which links to CalUsource public bids and supplier registration. CSU: official [Supplier Resources and CSUBUY information](https://www.calstate.edu/csu-system/doing-business-with-the-csu/contract-services-and-procurement/supplier-resources). The program monitors **public entry pages for changes**; it does not authenticate, scrape portals, extract bid deadlines, submit a supplier application or claim procurement awards.

To determine an actual district/college/university need, verify its legal agency identity, owned vehicle/equipment classes, applicability, public bid URL or buyer contact, approved budget and deadlines independently. A government incentive is not the same as a signed contract.

## Single-step Windows activation

One copy/paste PowerShell command:

```powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-FIAL58-RegulatoryIntelligence';$b='feature/fial5-8-regulatory-economic-intelligence-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL58_CLONE_HOLD'}};if((git.exe -C $r remote get-url origin) -cne $u -or (git.exe -C $r branch --show-current) -cne $b){throw 'FIAL58_SOURCE_IDENTITY_HOLD'};if(@(git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL58_SOURCE_DIRTY_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL58_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Activate-Fun-Regulatory-Economic-V5-8.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL58_ACTIVATION_HOLD'}}
```

The orchestrator preflights reviewed checkout, tests, source hashes and protected listener identities, executes one real public-data cycle, upgrades the **existing** four-trigger Task Scheduler job in place with backup and rollback, upgrades only the **existing 8802** dashboard with pinned FIAL5.7 rollback, and checks one existing Qwen/Cognee live request.

Expected markers: `FIAL58_FIRST_REAL_CYCLE=PASS`, `FIAL58_SCHEDULE=UPGRADED_IN_PLACE`, `FIAL58_FOUR_DAILY_TRIGGERS=PRESERVED`, `FIAL58_PRIMARY_DASHBOARD_CONSOLIDATION=PASS`, `FIAL58_ALL_IN_ONE=PASS`.

Qualifying in GitHub CI proves Windows source/fixture checks, **not** activation on the user's local PC; local terminal evidence is required for that claim.

## What is still missing

A verified customer vehicle inventory/CTC-VIS export and actual per-asset deadlines, university or school procurement portal results, supplier/bid-specific deadlines, fuel/electricity cost series, California economic data, verified API program offers and automatic personalized alerts. These require distinct sources or customer records, explicit authorization and their own independent tests. Never convert a general deadline or a national economic statistic into a made-up obligation or supplier opportunity.

**No Gmail connection is needed, and this release does not send emails, submit filings, authorize purchases, use REA tools or alter Elektron operations.**
