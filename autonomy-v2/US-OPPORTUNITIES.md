# Fun Industrial Opportunity Intelligence — United States V1

This module extends the existing Sidequest coordinator and unified dashboard. **It is a limited first live-discovery pipeline, not a full scraper or an automated bidder.** The initial connectors are official public APIs. No account creation, purchase, payment, CAPTCHA solving, unsolicited contact, probate-family inference, or browser automation is enabled by this release.

## What it does

- Schedules the `DomesticScan` Sidequest worker every six hours and runs it once when the coordinator starts.
- Reads the public Grants.gov `search2` API with the keywords **vehicle** and **manufacturing**. This endpoint does not require authentication.
- When operator-supplied keys are available, reads GSA Auctions surplus lots and SAM.gov *solicitation* notices from their official APIs. Neither key is required for installation; both are listed as unavailable without it. Upstream outages and schema differences are shown as errors instead of fabricated records.
- Incorporates manually entered public auction, salvage vehicle, probate sale, lot, property, or supplier opportunities from `data/domestic-manual.json`. The included example file is **not** imported as a listing.
- Deduplicates opportunities, ranks them by **topic relevance only**, stores evidence labels, displays official/source links, and creates a review task for new discovered leads after the first baseline scan.
- Makes the data available under the existing **8789 → Autonomy → U.S. opportunities** panel. The **Scan U.S. sources** button queues one read-only background scan, with a one-minute server-side cooldown.
- Preserves the SQLite job database, prior tool registry, research evidence, platform service launcher and approval boundaries.

## Install from GitHub (Windows PowerShell)

Clone the feature branch and deploy. This is separate from the installed worker's existing GitHub clone:

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-US-Opportunities';git clone --depth 1 --single-branch --branch feature/opportunity-intelligence-us-v1-20261107 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $d;if($LASTEXITCODE -ne 0){throw 'CLONE_FAILED'};powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Deploy-US-Opportunities.ps1')
```

The deployment validates Node syntax, runs all U.S. adapter and UI patcher tests, checks process identity, backs up runtime source and the existing service modules, runs the live dashboard's Node regression tests, and then briefly restarts **only** the 8792 Sidequest worker process and **8789** dashboard Node host. It reconnects REA, verifies the 229-tool inventory and new same-origin routes, enqueues a bounded initial scan, and reports the backup directory. On failure it restores source and attempts to restart the prior services.

The runtime's own `%LOCALAPPDATA%\FunIndustrial\AutonomyLab\autonomy-v2-github\data` directory remains in place. Existing `domestic-manual.json` is never overwritten.

## Source configuration

**Free source**: Grants.gov `POST https://api.grants.gov/v1/api/search2`. Findings are **grant eligibility leads**, not merchandise to buy or confirmed revenue.

**Optional sources**:
- GSA Auctions API: `https://api.gsa.gov/assets/gsaauctions/v2/auctions`. Requires `GSA_API_KEY` issued by api.data.gov for the federal surplus feed. Its availability and response structure can change.
- SAM.gov Get Opportunities API: `https://api.sam.gov/opportunities/v2/search`. Requires `SAM_GOV_API_KEY`, generated in SAM.gov account details, for federal solicitations. Additional notices, attachments, bid actions and supplier eligibility require separate validation.

Do not put API keys in GitHub, source files, screenshots, logs, chat messages or Qwen context. The installed Windows user must securely configure allowed environment variables before launching the worker. The worker does not ask for your Gmail password.

**Operator intake**: edit this local file (not GitHub)

`%LOCALAPPDATA%\FunIndustrial\AutonomyLab\autonomy-v2-github\data\domestic-manual.json`

Each item contains `id`, `title`, optional `url` (HTTPS), `location`, `deadline`, `askPrice`, and `notes`. Input is bounded to 100 entries and displayed as *operator-entered; unverified*.

## Exact verification commands

```powershell
Invoke-RestMethod 'http://127.0.0.1:8789/api/autonomy/opportunities' | Select-Object checkedAt,scope,summary
Invoke-RestMethod 'http://127.0.0.1:8789/api/autonomy/status' | Select-Object state,pid
```

For any opportunity, independently verify availability, permitted participation, title/ownership, eligibility, buyer premium, tax, transport, storage, insurance, customs, refurbishment, inspection, and expected resale demand before using it to make a financial decision. Scores are **not ROI estimates**; no bid or money movement is enabled.

## International follow-on

After qualifying official U.S. sources and monitoring accuracy, add separately reviewed Japan, South Korea, and Vietnam connectors. Require local-language provenance, currency conversion, seller legitimacy, export eligibility, HS tariff codes, import duty and customs fees, shipping/insurance, U.S. product-safety requirements, payment and fraud checks, and actual landed-cost modelling.

Potential category leads: industrial surplus, machinery, electronics components, automotive parts, used production equipment, pallets and liquidation lots. No claim of profitable or exportable deals is made until source evidence supports one.

## Reference documentation

- Grants.gov Search2 API: https://grants.gov/api/common/search2
- GSA Auctions API: https://gsa.github.io/auctions_api/basics
- SAM.gov Get Opportunities Public API: https://open.gsa.gov/api/get-opportunities-public-api/
