# FIAL 5.8.1 — September 2026 CARB Amendment and October 2026 BLS Data Integrity

## Problem surfaced by live FIAL 5.8

A local PC cycle reported eight configured official sources, two source holds, and the near-term `acf-state-local-purchasing` January 1, 2027 alert. The user's formatted PowerShell output showed a CPI field as `511`, which may be a truncated representation of a three-decimal number rather than the actual stored value; **the raw JSON was not provided and the discrepancy has not been diagnosed as a data-corruption fact**.

Two independent official records resolve the substantive interpretation problems:

1. CARB's September 10, 2026 Office of Administrative Law-approved Advanced Clean Fleets amendment, referenced at [CARB Rulemaking 2025 ACF](https://ww2.arb.ca.gov/rulemaking/2025/acfab1594) and CARB [board Resolution 25-9](https://ww2.arb.ca.gov/sites/default/files/barcu/board/res/2025/res25-9.pdf), extended the 50% state/local ZEV purchase schedule and moved the 100% purchasing stage to **2030**, with additional exceptions and flexibilities. Old CARB deadline summary pages still display the superseded January 2027 rule. The former 47-day countdown was **not** a valid current mandate.
2. BLS's [October 2026 CPI release, November 10, 2026](https://www.bls.gov/news.release/cpi.nr0.htm) reports the unadjusted CPI-U All Items index **337.511**. The monitor has a stable historical cross-source sanity check for `CUUR0000SA0 / 2026-10`; it rejects 511 (as a full numeric value) while accepting 337.511.

Clean Truck Check's four-times-annual OBD milestone remains **October 2027**, with **month-level precision**, not an invented exact October 1 legal due date. Individual vehicle due dates are available in its CTC-VIS account.

## What changed

- Replaces the `acf-state-local-purchasing` rule's old `2027-01-01` milestone with the amended `2030-01-01`, tagged as a 2026 OAL-approved regulation. Explicitly records `supersedes: 2027-01-01` and all relevant exception caveats.
- Pins the ACF official monitoring source to CARB's amendment proceeding. It no longer derives the deadline solely from a stale general TruckStop schedule.
- When the rule-catalog version changes, forces an incremental source rebaseline, ignoring the normal 24–48-hour TTL **once** to revalidate the changed source selection and economic data.
- Checks the published historical October 2026 BLS CPI value before trusting or graphing it. Invalid cached economic series are withheld until successfully refreshed, not silently carried forward or altered to match the expected anchor.
- Rebased official source URLs are labeled `SOURCE_URL_CHANGED_NO_INFERRED_AMENDMENT`, not falsely reported as changes in substantive law.
- Dashboard shows a clear `DATA INTEGRITY HOLD` if an old catalog or invalid CPI is still cached and identifies the superseded 2027 mandate when the repaired catalog is active.
- Adds CLI `--diagnostic`, which produces standalone lines including `FIAL581_HELD_SOURCE=<id> REASON=<reason> URL=<url>`, and `FIAL581_ECONOMIC_SERIES=<id> MONTH=<yyyy-mm> VALUE=<full numeric>`. No format-table truncation.
- Maintains existing FIAL5.5–FIAL5.8 business operations and four local cycles; no Gmail authorization, messages, government filings or REA calls.

## One Windows command: repair, restart only reviewed 8802, show diagnostic

```powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-FIAL581-DataIntegrity';$b='repair/fial58-2026-amendment-data-integrity-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL581_CLONE_HOLD'}};if((git.exe -C $r remote get-url origin) -cne $u -or (git.exe -C $r branch --show-current) -cne $b){throw 'FIAL581_SOURCE_IDENTITY_HOLD'};if(@(git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL581_DIRTY_SOURCE_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL581_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Activate-Fun-Regulatory-Economic-V5-8.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL581_REPAIR_ACTIVATION_HOLD'};& node.exe (Join-Path $r 'scripts/Run-Fun-Regulatory-Economic-V5-8.mjs') --diagnostic;if($LASTEXITCODE -ne 0){throw 'FIAL581_DIAGNOSTIC_HOLD'}}
```

The installer requires the exact reviewed prior repository **`FunIndustrial-FIAL58-RegulatoryIntelligence`**, current scheduled worker action, all four triggers, and the old runner Git hash. It executes a real local cycle with the revised catalog, checks the new 2030 receipt and protected ports, then points the existing task at the new version with a backed-up XML schedule. Its dashboard deployer verifies the reviewed old `8802` source and keeps FIAL5.8 as rollback. It does **not** create another scheduler, model, or API server.

**Deployment to a personal PC requires running the command. GitHub CI does not prove local activation.**

## Expected markers

```
FIAL58_FIRST_REAL_CYCLE=PASS
FIAL58_FOUR_DAILY_TRIGGERS=PRESERVED
FIAL58_PRIMARY_DASHBOARD_CONSOLIDATION=PASS
FIAL581_SUPERSEDED_2027_FLEET_MILESTONE=QUARANTINED
FIAL581_AMENDED_ACF_2030_MILESTONE=ACTIVE
FIAL581_DATA_INTEGRITY_REPAIR=PASS
FIAL581_MONITOR_STATE=REAL_PUBLIC_DATA_CHECK_COMPLETED
FIAL581_CURRENT_ACF_PURCHASE_DATE=2030-01-01 ...
FIAL581_ECONOMIC_SERIES=CUUR0000SA0 MONTH=2026-10 VALUE=337.511 ...
FIAL581_HELD_SOURCE=<id> REASON=<specific reason> URL=<official source>
FIAL581_DIAGNOSTIC=COMPLETE_READ_ONLY
```

A source hold is still a source hold; no auto-resolving, inventing bid opportunities, inferring individualized vehicle test due dates or falsely updating legal interpretation from mere hash changes.

**Safety:** The exact user's business contact details and Gmail credentials are not committed in this patch. The existing FIAL5.7 Google authorization remains optional and unmodified.
