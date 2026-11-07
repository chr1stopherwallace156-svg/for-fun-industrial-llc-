# GSA Auctions → Fun Industrial 8789 dashboard (manual official-feed bridge)

## Qualification evidence

On November 7, 2026, the operator's Windows PowerShell preview successfully followed an approved GSA Auctions HTTPS 303 redirect to a signed S3 `active-auctions.json` download. It returned HTTP 200, 3,236,219 response bytes, **600 parsed lots / 600 reported active**, and 20 relevance-ranked example records. This established **read-only discovery** but did not populate the existing 8789 dashboard.

## What this adds

- `src/gsa-bridge.mjs`: normalizes the official auction JSON using the existing tested GSA adapter, requires at least one active lot, attaches a SHA-256 observation fingerprint and two-hour expiration, and merges the snapshot into the existing domestic opportunities API **without overwriting or deleting the grants baseline**.
- `src/http.mjs`: augments the existing `GET /api/opportunities` endpoint with the imported snapshot. Already integrated through the existing `GET http://127.0.0.1:8789/api/autonomy/opportunities` proxy, so **no 8789 dashboard source patch or restart is needed**.
- `GSA-Import-From-File.mjs`: writes a validated official observation snapshot atomically to the installed worker's `data/gsa-import.json`, logs a bounded evidence event and prints its expiry. No signed URL, raw response, credentials or private keys are persisted.
- `Import-GSA-Windows.ps1`: obtains the official live data using the previously qualified Windows HTTPS/S3 redirect path, writes a random temporary download file, invokes the installed importer, verifies the integrated 8789 API now reports `gsaSnapshot.state=active`, then deletes the temporary download.
- `Deploy-GSA-Dashboard-Bridge.ps1`: runs the bridge/import/adapter/preview tests, guards the installed process identities, backs up existing worker source, installs only the three needed modules and restarts **only Sidequest 8792** with rollback on failure. No changes to SQLite, current grants, React/UI files, Qwen, Ollama, NetBird, REA authorization or 8789 Node host.

The dashboard endpoint displays up to 300 combined records, reserving at least 40 positions for non-auction sources when there are that many, and the existing UI renders the first 45. Auction imports currently use an **operator-run request** and a limited demonstration key; this is **not scheduled continuous access**. Two hours after an import, the auction overlay is excluded and marked expired so old observed bids are not represented as current listings. `gsaSnapshot.importedLots` shows the actual imported total even when the UI only displays a subset. The raw one-time downloaded file is deleted after import.

## Run — after pulling GitHub

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-US-Opportunities';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_FAILED'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Deploy-GSA-Dashboard-Bridge.ps1');if($LASTEXITCODE -ne 0){throw 'GSA_BRIDGE_INSTALL_FAILED'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Import-GSA-Windows.ps1');if($LASTEXITCODE -ne 0){throw 'GSA_IMPORT_FAILED'}
```

Expected:
```
GSA_DASHBOARD_BRIDGE=PASS
GSA_IMPORT=PASS
GSA_8789_DASHBOARD=PASS
GSA_OFFICIAL_IMPORT=PASS
```

Verify:
```powershell
$r=Invoke-RestMethod 'http://127.0.0.1:8789/api/autonomy/opportunities';$r.gsaSnapshot|Format-List;$r.items|Where-Object kind -eq 'surplus_auction'|Select-Object -First 10 title,location,askPrice,deadline,url|Format-Table -Wrap
```

**Financial caution:** an observed auction bid isn't a purchase price, a valuation or guaranteed vehicle title. Independently inspect conditions, title, salvage restrictions, premium, taxes, pickup costs and transport before making any financial decision. No automated bid, payment or purchase operations are included.

## For unattended recurring GSA discovery

Obtain your own API key from https://api.data.gov/signup/, store it outside GitHub and Qwen prompts, and qualify an HTTP bridge that can schedule this same approved HTTPS download securely on the installed Windows host. The public `DEMO_KEY` is deliberately **not** configured for recurring background use. The Sidequest scheduler currently only calls the built-in Node adapter, which previously failed at Windows networking; that issue remains unresolved.
