# FIAL 4 Live Official Grant Verification — Active Dashboard

This is an **activated-capability release**, not a semantic-testing phase. The Windows launcher creates a standalone 127.0.0.1:8803 FIAL dashboard sidecar, using the existing 8802 dashboard when it is available, or a standalone active page when 8802 is unavailable. It does **not** restart or replace port 8802, Qwen, REA, the HTTPS gateway, Elektron, or other services.

## What runs automatically

The live sidecar requests the official California State Library Grants Portal dataset from the pinned government source on startup and every **six hours** while the 8803 process remains running. The UI has **Verify official source now**, which triggers exactly one bounded verification from an explicit operator click. A single-flight lock prevents concurrent downloads. No user-supplied URL or external tool execution is accepted.

Official source: https://publish.data.ca.gov/dataset/california-grants-portal

The verified source is a daily-updated government CSV. FIAL compares saved FIAL 4 grant IDs, names, and FIAL 2 source fields against the current data, flags missing/duplicate IDs, reports changed fields, and archives a new content-addressed CSV snapshot. It stores SQLite run history and write-once per-run JSON evidence under:

`%LOCALAPPDATA%\FunIndustrial\RealApplicationWorkerV1\fial\live-v4\`

The operation does **not** validate the full official grant notice or certify an applicant's eligibility. It verifies the published government feed, identifying what requires agency/eligibility follow-up.

## Single Windows PowerShell activation command

Run the following entire one-liner in PowerShell, from any directory. It installs into an **isolated** checkout `$HOME\FunIndustrial-FIAL4-Live`. Existing source checkouts, local ports and processes are preserved.

```powershell
$r=Join-Path $HOME 'FunIndustrial-FIAL4-Live';$b='feature/fial4-live-official-activation-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL4_LIVE_CLONE_HOLD'}};if((git -C $r remote get-url origin) -cne $u -or (git -C $r branch --show-current) -cne $b){throw 'FIAL4_LIVE_REPOSITORY_HOLD'};if(@(git -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL4_LIVE_LOCAL_CHANGES_HOLD'};git -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL4_LIVE_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Start-Fun-FIAL4-Live.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL4_LIVE_START_HOLD'}
```

The launcher checks source integrity and tests, the existing saved FIAL 4 baseline, 8803 process identity and port ownership, and protected listener snapshots before reporting activation. It never kills a process or retries/restarts an unknown listener.

The active UI is: **http://127.0.0.1:8803/** on the Windows PC. For iPhone Safari, use authenticated Termius local forwarding of **iPhone port 8803 to Windows 127.0.0.1:8803**, then open `http://127.0.0.1:8803/`. Do not expose 8803 on a public network.

## Success indicators

```
FIAL4_LIVE_INDEPENDENT_TESTS=PASS
FIAL4_LIVE_DASHBOARD=ACTIVE
FIAL4_LIVE_URL=http://127.0.0.1:8803/
FIAL4_LIVE_SCHEDULE=STARTUP_AND_EVERY_6_HOURS
FIAL4_LIVE_OFFICIAL_SOURCE=PASS
FIAL4_PROTECTED_SERVICES=NOT_TOUCHED
```

An `OFFICIAL_SOURCE=HOLD` means the dashboard may be running, but current government data could not be verified. Preserve the HOLD; retry with its real manual Refresh button after diagnosing network/source availability. When a grant is missing from the dataset or has changed identity, the feed can still be retrieved successfully while that grant remains explicitly held.

## Access boundary

- Official government feed **GET only**, fixed URL, bounded download with approved secure storage redirect.
- The local dashboard POST to refresh requires a same-origin, operator-click header and an empty JSON object.
- No model/REA tools, account sign-ins, grant applications, emails, purchases or spending.
- No separate semantic benchmark expansion and no extra authority for FIAL 4.
- Auto-refresh runs only while the local 8803 service is running. It is not registered as a Windows Startup Task in this release.
