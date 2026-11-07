# GSA Auctions — Windows PowerShell HTTPS preview

## Why this route exists

A user successfully fetched real GSA auction JSON through Windows PowerShell `Invoke-WebRequest`, but Node `fetch` in the same Windows environment returned `fetch failed` without an HTTP status. This may be a proxy, DNS, or TLS routing mismatch; the exact cause has **not yet been diagnosed**.

The read-only workaround deliberately uses the already working Windows HTTPS request mechanism, leaving normal certificate verification enabled. It then parses the downloaded JSON through the same `normalizeGSA` code used by the Sidequest worker. The response is stored **only in a random temporary file**, deleted in `finally`; no credentials or response bodies are committed to GitHub.

## On the existing source checkout (PowerShell)

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-US-Opportunities';git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GITHUB_PULL_FAILED'};node --test (Join-Path $d 'autonomy-v2\test\gsa-windows-preview.test.mjs');if($LASTEXITCODE -ne 0){throw 'OFFLINE_TEST_FAILED'};powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Preview-GSA-Windows.ps1');if($LASTEXITCODE -ne 0){throw 'GSA_WINDOWS_PREVIEW_FAILED'}
```

The preview defaults to GSA's rate-limited `DEMO_KEY` when `GSA_API_KEY` is unset. A personal API key may be set in the invoking process environment; **never paste it into chat or commit it to GitHub**. Reported errors redact raw and URL-encoded key strings.

On success, the output includes:
- `GSA_WINDOWS_REQUEST=PASS HTTP=200`
- `GSA_WINDOWS_PREVIEW=PASS`
- `AUCTION_LOTS_PARSED=<count>` and up to 20 ranked auction records
- `GSA_PREVIEW_PIPELINE=PASS WORKER_UNCHANGED=TRUE`

If the request receives HTTP 403/429, the demonstration key may have reached its limits. The preview's success does **not** authorize a recurrent feed; recurring GSA scans require a personal key and a verified fix for Node's HTTPS access (or a separately qualified Windows HTTP bridge in the Sidequest worker).

No bidding, purchases, website login, OAuth, CAPTCHA solving, or REA tool calls are performed.

Official references: https://gsa.github.io/auctions_api/basics and https://api.data.gov/signup/
