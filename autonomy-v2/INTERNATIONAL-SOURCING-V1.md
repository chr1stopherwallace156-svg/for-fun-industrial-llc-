# Fun Industrial International Sourcing V1 — Japan, South Korea, Vietnam

**Scope: production-quality source registry and qualified-format intake, not yet unattended international stock discovery.** This independent Fun Industrial project extends the installed Sidequest 8792 backend and unified **8789 → Autonomy** UI. It does not touch Elektron Industrial or the existing GSA and Grants.gov datasets.

## Included source management

The new `src/international.mjs` module registers these sources with explicit availability labels:

| Source | Country | Type | Access |
|---|---|---|---|
| KSI Government Auctions (https://kankocho.jp/) | Japan | vehicles, machinery, public asset auctions | public website / operator-reviewed; no verified listing API |
| JETRO (https://www.jetro.go.jp/en/) | Japan | manufacturer and supplier discovery | public site; no verified inventory feed |
| KAMCO OnBid (https://www.onbid.co.kr/) | South Korea | movable asset and vehicles | official API requires `data.go.kr` key and dataset approval |
| Vietnam National Asset Auction Portal (https://dgts.moj.gov.vn/) | Vietnam | public auction notices | public site / operator-reviewed; no verified listings API |
| Open Supply Hub (https://opensupplyhub.org/) | Global | factory/facility lookup | research only, **not** a seller or inventory source |

The registered Korean services are listed at:
- https://www.data.go.kr/data/15157232/openapi.do — OnBid movable property list
- https://www.data.go.kr/data/15157233/openapi.do — OnBid vehicle list

**We have not connected a Korean API key or imported live OnBid records.** GSA's public `DEMO_KEY` is unrelated to these Korean APIs. Never paste credentials into this repository or chat.

### Categorization and manufacturer names

- Categories: bulk_lots, vehicles, industrial_equipment, electronics_components, textiles, furniture, property, general
- Manufacturer aliases in English/Japanese/Korean: Toyota, Hyundai, Samsung, Honda, Kia, Mitsubishi, Daewoo
- Ports and geographic anchors: Tokyo, Yokohama, Busan, Incheon, Ho Chi Minh City, Hai Phong, Los Angeles, Long Beach, with code/country consistency checks
- Candidate records: source-specific listing IDs, country, origin port, category, make/model, local currency, price type, `lot_total` versus `per_unit` price basis, quantity, observed timestamp, condition and original HTTPS listing
- No invented inventory, scraped login credentials, property-owner family inferences, purchases, bids, account creation or CAPTCHA bypass.

## Install the new international dashboard

From the existing `FunIndustrial-US-Opportunities` checkout, clone this *separate feature branch* to avoid corrupting the active domestic checkout:

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-International-Sourcing';if(Test-Path $d){throw "CLONE_TARGET_EXISTS=$d"};& git clone --depth 1 --single-branch --branch feature/international-sourcing-v1-20261107 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $d;if($LASTEXITCODE -ne 0){throw 'CLONE_FAILED'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Deploy-International-Sourcing.ps1');if($LASTEXITCODE -ne 0){throw 'INTERNATIONAL_DEPLOYMENT_FAILED'}
```

The installer runs source syntax checks, the international/CSV/dashboard patch tests, GSA regression tests, the existing 8789 platform test suite, verifies 8789/8792 process identity and existing 229 REA capabilities, backs up all changed files, upgrades the existing worker, restarts **only its Sidequest Node service and the 8789 dashboard Node process**, reconnects REA without broadening its pre-existing tool scope, and checks the original GSA/domestic API and the new international route. It does not change Qwen, Ollama, NetBird, compute or SQLite. It attempts rollback and prior-service restart if qualification fails.

Expected: `INTERNATIONAL_SOURCING_V1=PASS`, `COUNTRIES=JP,KR,VN`, `INVENTORY_COUNT=0` until real operator-approved listings are imported. A source directory is **not evidence of live supply**.

## Import an approved listing

The CSV header-only file is `autonomy-v2/data/international-intake-template.csv`. Fill rows only with genuine links from the specific allowed source sites in the registry. Supported `sourceId` values for inventory are `JP_KSI`, `KR_ONBID_MOVABLE`, `KR_ONBID_VEHICLE`, `VN_MOJ`, `JP_JETRO`. Open Supply Hub is not an inventory marketplace.

Use this one-liner to import **your completed** CSV:

```powershell
& node (Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github\Import-International.mjs') (Join-Path $env:USERPROFILE 'FunIndustrial-International-Sourcing\autonomy-v2\data\international-intake-template.csv')
```

If the template is still header-only, the import succeeds but adds **zero listings**. The importer accepts `.csv` or `.json` up to 2 MB, validates HTTPS source origin, country, currency, origin port, bounded quantities and IDs, and keeps prior leads while merging up to 500 total records. Invalid rows fail the entire input. Sensitive data, arbitrary URLs, unfamiliar source IDs and auto-bidding are rejected. Imported items are labeled `operator_supplied_public_listing_unverified`. Real or observed listing prices do not establish net profit.

Verify:

```powershell
$r=Invoke-RestMethod 'http://127.0.0.1:8789/api/autonomy/international';$r|Select-Object scope,mode,importedAt,ageHours,stale,autoSourcesActive;$r.summary;$r.sources|Select-Object name,country,access|Format-Table -AutoSize
```

## Landed-cost scenario (not a profit guarantee)

Complete `autonomy-v2/data/international-landed-cost-template.json` with evidence-backed USD per 1 JPY/KRW/VND, ocean freight, U.S. inland freight, insurance, tariffs/duties, brokerage, port/storage, inspection, other costs and expected verified resale total. Set `priceBasis` to `lot_total` or `per_unit`; for per-unit costs, the listing must have an explicit quantity. Neither the importer nor Qwen invents FX or duties.

```powershell
& node (Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github\Estimate-International-Cost.mjs') 'C:\absolute\path\to\completed-costs.json' '<imported-lead-id>'
```

The estimate returns merchandise USD, total scenario landed cost, scenario gross margin and an uncertainty warning. It cannot conclude profitable/exportable until supplier, goods, customs status, classification, freight and U.S. customer demand are verified.

Current government guidance: https://www.cbp.gov/trade/basic-import-export and https://www.trade.gov/import-tariffs-fees-overview. Customs and HS duties depend on the actual item and rules in force at entry.

## Open source expansion points

- https://github.com/apify/crawlee — Node.js browser/source crawler; **not deployed**, must be configured per-site with rate limits, TOS/robots compliance and session controls
- https://github.com/opensupplyhub/open-supply-hub — open-source manufacturing facility directory software; **facilities ≠ verified sale inventory**; API access may require a token/subscription
- https://github.com/XamTE/onbid_mcp — community-built read-only OnBid MCP; **not installed, audited or given access**, uses individual data.go.kr keys
- https://github.com/docling-project/docling — document parsing for contracts, item lists, packing lists and invoices; not installed

Next gated modules: qualify Korean OnBid API keys and real response schemas; evaluate permitted Japan and Vietnam site connectors; compare landed costs against U.S. sold-price evidence; monitor fraud/stock changes. Housing/probate functionality is deferred as requested.

This V1 does not claim any particular international crate/container, supplier, live auction listing or profit margin exists. Access privileges and export eligibility must be checked separately.
