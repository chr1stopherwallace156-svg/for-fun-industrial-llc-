# FIAL5.12 — Verified buyer qualification: construction vs school-bus maintenance

## Scope and first two opportunity pathways

**Fun Industrial is decision-support software; ELEKTRON INDUSTRIAL LLC is the separate real-world business.** The software does not infer verified credentials, prior contracts, approved vendor status or procurement eligibility.

**1. City of Long Beach EV fleet charging depot.** The official issuer listing https://longbeachbuys.buyspeed.com/bso/external/bidDetail.sda?docId=PW-26-800&external=true&parentUrl=close provides bid ID PW-26-800, R-7282, bid opening November 20, 2026, 11:00 a.m. Pacific, and a scope of five dual-port DC fast chargers, battery energy storage, electrical switchgear, conduit, wiring and site works. It also states **mandatory** October 27 pre-bid conference and job-site walkthrough. Attendance is NOT VERIFIED. Published specs and addenda require separate review of Class B, C-10, EVITP, IBEW, prevailing wage, bonding, insurance, prior projects and subcontractors. This is a construction bid, not proof ELEKTRON can act as a prime or subcontractor.

**2. ZESBI eligible school-bus repairs, diagnostics and training.** Official eligible-cost page https://californiazesbi.org/applicants/eligible-costs/ and official detailed document https://californiazesbi.org/wp-content/uploads/2026/03/ZESBI-Eligible-Costs.pdf enumerate zero-emission school-bus repairs outside warranty, ZE maintenance contracts, EVSE diagnostics, high-voltage shop equipment, parts and training. These are eligible program costs subject to conditions, **not** a supplier request for proposals or an award to ELEKTRON. Need a real funded school district, a signed eligible scope and its purchasing route before there is an actionable sales lead.

California Contractors State License Board describes the C-10 electrical classification at https://web.cslb.ca.gov/About_Us/Library/Licensing_Classifications/Licensing_Classifications_Detail.aspx?Class=C10. ELEKTRON's corresponding license, qualified electrical contractor partner, EVITP staff, insurance, bidding attendance and warranty scope all remain UNVERIFIED.

## Installed architecture and safety

- Source monitor checks precisely three pinned official HTTPS pages: Long Beach buyer bid, ZESBI eligible-costs, CSLB C-10 classification. It uses GET only, manual redirect refusal, 9-second timeout, ~350–650 KB per-source ceiling, and 6–72-hour incremental polling only in the existing four-cycle Windows worker.
- Source bytes are hashed with SHA-256 and retained locally in AppData, never committed to GitHub. Changed or missing data is HOLD until reviewed.
- Two research categories: DIRECT_CONSTRUCTION_SOLICITATION and PROGRAM_ELIGIBLE_COST_PATHWAY_NOT_A_PROCUREMENT. Both have direct_bid_ready=false and verified_eligibility=false. Published deadlines expire in read-only status, including without new network calls.
- New existing-dashboard Operations panel on 127.0.0.1:8802 and bounded optional local Qwen context. No new Qwen instance, new server, autonomous REA, bid submission, email, grant application, contractor registration, payments or permission changes.
- Existing FIAL5.11/5.10/5.9/5.8.1 and older executive, financial and sourcing capabilities remain intact. The Windows task retains exactly four daily triggers. Only the approved 8802 node process may undergo identity-checked replacement with FIAL5.11 rollback; Qwen 8088, Cognee 8789, REA, Elektron Ollama 11434 are protected.

## Single-command activation, including missing FIAL5.11 predecessor

Because the PC only has user-confirmed live FIAL5.10 from this conversation, the FIAL5.12 activation script checks for FIAL5.11 first; if absent, it **only** bootstraps the previously qualified FIAL5.11 against the known FIAL5.10 scheduler and dashboard, then checks FIAL5.11 live status before upgrading to FIAL5.12. Unknown processes, modified Git checkouts or schedule actions trigger HOLD, not forced restarts.

Run in Windows PowerShell as one command:

\`\`\`powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-FIAL512-BidReadiness';$b='feature/fial5-12-bid-readiness-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r -PathType Container)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL512_CLONE_HOLD'}};$origin=(& git.exe -C $r remote get-url origin|Out-String).Trim();$branch=(& git.exe -C $r branch --show-current|Out-String).Trim();if($origin -cne $u -or $branch -cne $b){throw 'FIAL512_SOURCE_IDENTITY_HOLD'};if(@(& git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL512_SOURCE_DIRTY_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL512_SOURCE_UPDATE_HOLD'};& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $r 'Activate-Fun-Bid-Readiness-V5-12.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL512_ACTIVATION_HOLD'};& node.exe (Join-Path $r 'scripts/Run-Fun-Bid-Readiness-V5-12.mjs') --diagnostic;if($LASTEXITCODE -ne 0){throw 'FIAL512_DIAGNOSTIC_HOLD'}}
\`\`\`

Expected success markers from the user's PC:

FIAL512_FIAL511_BOOTSTRAP=PASS (or FIAL512_FIAL511=ALREADY_LIVE), FIAL512_OFFLINE_TESTS=PASS, FIAL512_FIRST_LIVE_BID_READINESS=PASS, FIAL512_FOUR_DAILY_TRIGGERS=PRESERVED, FIAL512_BID_READINESS_PRIMARY_DASHBOARD=PASS, FIAL512_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_PASS, FIAL512_DIRECT_READY_BIDS=0, FIAL512_ALL_IN_ONE=PASS.

A website source HOLD does not constitute an eligible bid. GitHub qualification alone is not proof the user's actual PC has completed activation.

**Next revenue gate:** independently establish a specific school district's approved repair/diagnostics/maintenance procurement, real service needs and ELEKTRON's corresponding legal and technical qualifications. Then prepare an operator-reviewed buyer packet; do not send without explicit approval.
