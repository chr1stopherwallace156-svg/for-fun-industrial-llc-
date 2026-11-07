# GSA Auctions live JSON qualification — 2026-11-07

## Evidence received

A live `GET https://api.gsa.gov/assets/gsaauctions/v2/auctions?api_key=DEMO_KEY&format=JSON` response contained camelCase fields including:

- `propertyCity`: Pullman; `propertyState`: WA
- `auctionStatus`: Active
- `biddersCount`: 2
- `lotInfo`: HTML describing a lot of used extreme-cold boots, with missing/repairable parts caution

This demonstrates that the feed returns live auction items, **not** that every listing is suitable for resale.

## Fixed

- Parsing now accepts both documented PascalCase keys and actual camelCase names.
- The extractor traverses bounded nested response wrappers instead of expecting `SaleNo` exactly.
- HTML auction descriptions are stripped to plain text before becoming summary data. The dashboard already uses `textContent` to display results safely.
- The record retains location, auction status, observed bidder count, deadlines and bid amount where supplied. Observed highest bid is **not** a final paid price.
- Unit tests reproduce the live-response shape, legacy shapes, numeric bid parsing and a mock authenticated GSA scan.
- Only the Sidequest worker parser module needs replacement; no new 8789 dashboard code or service permissions.

## Deploy the parser-only fix

Use the already cloned `%USERPROFILE%\FunIndustrial-US-Opportunities` checkout:

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-US-Opportunities';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_FAILED'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Deploy-GSA-Parser-Fix.ps1');if($LASTEXITCODE -ne 0){throw 'GSA_PATCH_FAILED'}
```

The script runs parser tests first, verifies existing worker ownership, backs up the installed module, restarts **only** the local Sidequest worker 8792 and validates the same-origin proxy through 8789. It attempts to restore the original module if the restart fails.

## One-time preview (no service restart)

Run the official demonstration feed exactly once, as permitted by the limited-use `DEMO_KEY`:

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-US-Opportunities';& node (Join-Path $d 'autonomy-v2\Preview-GSA-Live.mjs');if($LASTEXITCODE -ne 0){throw 'DEMO_GSA_NOT_AVAILABLE'}
```

This preview prints up to 16 relevant current lots; it does not mutate your worker's persisted results. The demonstration key is **not** put into the recurring scheduler.

## Production GSA integration

Continuous GSA monitoring requires an individually issued `GSA_API_KEY` for the worker process, available through https://api.data.gov/signup/. Do not paste it into chat or GitHub. Configure a protected local secret and load it into the worker process at startup. Until a personal key is configured, the dashboard correctly continues to show `GSA Auctions — API_KEY_REQUIRED` and will not claim that GSA auctions are being monitored.

GSA API field reference: https://gsa.github.io/auctions_api/fields

GSA API basics and demo limitations: https://gsa.github.io/auctions_api/basics
