# FIAL 5.9 — Fleet Opportunity Intelligence: Verified-Source Research Pipeline

**Fun Industrial = software operator. ELEKTRON INDUSTRIAL LLC = separate real-world business.**

## What is actually implemented

The existing Fun Industrial Operations console at \`http://127.0.0.1:8802/operations/\` now includes a local-only school-fleet research pipeline. It displays named school districts and LEAs, their historically published ZESBI application quantities, transparently scored research priority, preserved source citations, program deadlines and official procurement resource links. A source monitoring worker saves bounded public agency HTML or PDF evidence, SHA-256 hashes, original bytes and cycle history.

The pipeline is **not** a live contract feed, not certified vendor registration, not a list of current bus buyers, and not a fleet VIN/due-date database. The historical September 2026 funding list is a **funding reservation list**, not proof that the agency has already received an award or purchased any bus. Current solicitation status can change without the historical list changing.

## Primary source chain

1. California Energy Commission's November 3, 2026 [ZESBI Second Solicitation](https://www.energy.ca.gov/solicitations/2026-11/zero-emission-school-bus-and-infrastructure-zesbi-incentive-project-second) records at least **$55,000,000** of new bus and charger funding. Online application acceptance scheduled for **November 17, 2026, 10:00 AM Pacific**; pre-application began earlier. Up to 10% can be for qualifying School Transportation Program items (training, technical assistance, bus/charger repairs, transportation shop equipment and yard improvements) subject to restrictions. **Not** an automatic Elektron contract or proof of conversion eligibility.
2. Program manager's original five-page [ZESBI Funding List, dated September 9, 2026](https://californiazesbi.org/wp-content/uploads/2026/09/ZESBI-Funding-List-09.09.2026.pdf). The PDF explicitly says reservations are *not necessarily awards*, needs a later Incentive Recipient Agreement and may list multiple applications per LEA. Each curated row preserves the exact original page (1–5) and numbers of buses/chargers. Where an LEA appears twice, the separate applications remain auditable and are summed only for a clearly labeled historical research queue. Some agencies have zero chargers listed under the **first** solicitation; this does not mean a charger-less application qualifies for the **second** solicitation.
3. [ZESBI FAQ](https://californiazesbi.org/applicants/faqs/) and [eligibility](https://californiazesbi.org/applicants/eligibility/) establish second-round first-come-first-served priority **without first-solicitation tiers**, LEA ownership criteria, new zero-emission school buses and at least one charger per bus.
4. [UC Procurement](https://procurement.ucop.edu/), [CSU supplier resources](https://www.calstate.edu/csu-system/doing-business-with-the-csu/contract-services-and-procurement/supplier-resources), and [California Department of Education public school directory](https://www.cde.ca.gov/ds/si/ds/pubschls.asp) are monitored as public research entry points. They **do not** establish open individual fleet bids without specific current bid references.
5. Previously qualified FIAL 5.8.1 CARB OAL-approved **2030** ACF purchase milestone, school-fleet AB579 and October 2027 CTC month-level event remain separate; they are not silently rewritten by webpage changes.

## Source monitor behavior

- Six exact approved public HTTPS URLs, no arbitrary search, authentication or redirect-following
- 6–72-hour per-source TTL within the **existing** four-times-daily Windows work cycle (01:00, 07:00, 13:00, 19:00 when logged in)
- Maximum 210–220 KiB HTML or 1.9 MB PDF evidence, 9-second fetch timeout per source
- Immutable source snapshots, source-specific SHA-256 and last cycle JSON; no untrusted agency content is executed or passed automatically to Qwen
- First download always forms a baseline. Later changes are **reviewable webpage byte changes**, never automatic legal, procurement or bid claims
- Unavailable public sources show HOLD and explicit reasons; independent published LEA research still exists
- Research priorities are summed from published historical bus/charger counts and an operator-chosen planning region. **Not** expected revenue, weighted win probability, margin or evidence of actual current vehicle ownership
- No email sends, forms submitted, bids, orders, REA tool executions, vendor registrations, payments or model starts

## Priority research examples from the September 2026 source PDF

| LEA | Source PDF pages | Historical listed buses | Historical listed chargers |
|---|---|---:|---:|
| Victor Valley Union High School District, Victorville | 5 | 6 | 3 |
| Palmdale Elementary School District, Palmdale | 4 | 3 | 3 |
| Bakersfield City School District, Bakersfield | 1 | 32 | 20 |
| Kern County Office of Education, Bakersfield (two rows) | 3 | 40 | 28 |
| Moreno Valley Unified School District, Moreno Valley | 3 | 43 | 43 |
| San Marcos Unified School District, San Marcos (two rows) | 4 | 24 | 24 |

**Critical:** This historical list is NOT a list of applicants or grants in the November 2026 second solicitation. It is a starting point for verifiable outreach *research*, not an authorization to contact anyone.

## One Windows command for integrated installation

Run in Windows PowerShell:

\`\`\`powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-FIAL59-FleetIntel';$b='feature/fial5-9-fleet-opportunity-evidence-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL59_CLONE_HOLD'}};if((git.exe -C $r remote get-url origin) -cne $u -or (git.exe -C $r branch --show-current) -cne $b){throw 'FIAL59_SOURCE_IDENTITY_HOLD'};if(@(git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL59_SOURCE_DIRTY_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL59_SOURCE_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Activate-Fun-Fleet-Opportunity-V5-9.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL59_ACTIVATION_HOLD'};& node.exe (Join-Path $r 'scripts/Run-Fun-Fleet-Opportunity-V5-9.mjs') --diagnostic}
\`\`\`

The **first real** source cycle runs before the schedule is changed. If tests or evidence checks fail the task is not replaced. The old FIAL5.8.1 checkout remains unmodified, and the existing task's XML is backed up. Exactly four daily triggers are retained. The dashboard replacement requires old reviewed 8802 process identity, validates independent 8088/8789/8798/8801 health and uses the existing rollback mechanism on a failed new dashboard.

## Local success criteria

\`\`\`
FIAL59_OFFLINE_TESTS=PASS
FIAL59_FIRST_REAL_FLEET_OBSERVATION=PASS
FIAL59_FOUR_DAILY_TRIGGERS=PRESERVED
FIAL59_SCHEDULE=UPGRADED_IN_PLACE
FIAL59_FLEET_PRIMARY_DASHBOARD=PASS
FIAL59_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_VERIFIED
FIAL59_VERIFIED_OPEN_RFPS=0
FIAL59_ALL_IN_ONE=PASS
\`\`\`

GitHub CI verifies source and Windows mocked conditions, **not** activation on the operator's personal Windows PC. Inspect terminal results before claiming production state.

## Next evidence gates

1. Extract and independently verify **specific currently open** public purchasing notice IDs for school districts, counties, transit agencies and UC/CSU; store procurement URL, title, expiry date, project scope and submission route without emailing or bidding
2. Check actual fleet ownership, vehicle class, service needs and eligibility. ZESBI's *new-bus* grant should NOT be marketed as a conversion grant without affirmative eligibility proof
3. Verify ELEKTRON licensing/insurance/supplier qualifications against the actual procurement and incentive manuals before labeling an available vendor route
4. For genuinely promising leads, create review-only opportunity packets with original source evidence and next step; contact or bid only after the operator's express action
5. Track measured outcomes: verified active RFPs, bid submissions after authorized review, responses and completed invoices—never just number of generated leads
