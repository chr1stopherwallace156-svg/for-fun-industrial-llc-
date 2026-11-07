# Fun Industrial — Asia Company Sourcing V2 (12 markets)

This release expands the working **8789 international sourcing panel** from three countries to 12 Asia markets, without requiring Korean phone verification or changing the U.S. GSA / Grants.gov backend. **It provides an approved source registry and operator-supplied company/listing intake, NOT automatic live supplier crawling or verified price quotes.**

## Sources: company-first, not government-only

| Region | Source | Type | Public starting point |
| --- | --- | --- | --- |
| Japan | J-GoodTech | SME manufacturers and suppliers; supplier contact can require membership | https://jgoodtech.smrj.go.jp/pub/en/ |
| Japan | JETRO | Research and supplier matching | https://www.jetro.go.jp/en/ |
| Japan | Japan Machinery Trader | Used machinery listing research; individual page verification required | https://www.japanmachinerytrader.com/en/browse |
| South Korea | KOTRA buyKOREA | Korean company export products and overseas buyer inquiries | https://www.buykorea.org/ |
| South Korea | KAMCO OnBid | Government auction registration/API still needed; OPTIONAL only | https://www.onbid.co.kr/ |
| Taiwan | Taiwantrade | Industrial manufacturers, products, components, packaging | https://www.taiwantrade.com/ |
| Thailand | DITP Thaitrade | Thai exporters, products and wholesale inquiries | https://www.thaitrade.com/ |
| Indonesia | Ministry of Trade InaExport | Certified suppliers and company-product directory | https://www.inaexport.id/ |
| Malaysia | MATRADE Malaysia Products Directory | Packaging/containers, electronics, machinery and exporters | https://myexport.matrade.gov.my/apps/mpd/ |
| Philippines | DTI Tradeline | Supplier/exporter research | https://tradelinephilippines.dti.gov.ph/ |
| Vietnam | MOIT GoGlobal | Manufacturer/company directory | https://goglobal.moit.gov.vn/en/form/directory |
| China | Made-in-China | Manufacturers, bulk orders, factory products | https://en.made-in-china.com/ |
| Multi-country Asia | Alibaba | Wholesale, OEM/ODM manufacturers, pallet quantities and container orders | https://www.alibaba.com/ |
| Multi-country Asia | HKTDC Sourcing | Company profiles, products and Hong Kong-led trading networks | https://sourcing.hktdc.com/en |

Singapore and India are also included through multi-country Asian company platforms, and Hong Kong is recognized separately from China for origin, currency and customs research. Open Supply Hub continues as facility research only, NOT actual merchandise inventory.

## Fields and search

The same source-name, manufacturer and multilingual taxonomy supports additional categories `packaging_materials`, `shipping_containers`, `automotive_parts`. Each candidate company/product record includes `companyName`, `recordType` (supplier profile / product listing / auction lot), `minOrderQuantity`, `incoterm`, product, country, region, source URL and source observation time. Global marketplaces **require a concrete Asian country of goods origin**; platform headquarters cannot be used as origin.

Unverified shipping terms and missing prices **must not** be turned into profit conclusions. The landed-cost estimator requires explicit price, unit-vs-lot basis, exchange rate, freight, duty/tax and resale scenario evidence.

## Install into the CURRENT working Fun Industrial 8789/8792 platform

A **new separate GitHub branch** preserves the original V1 checkout, already-deployed dashboard, and the unrelated Europe exploratory branch. Clone it once and deploy an incremental patch:

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Asia-Sourcing';if(-not(Test-Path $d)){& git clone --depth 1 --single-branch --branch feature/asia-company-sourcing-v2-20261107 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $d;if($LASTEXITCODE -ne 0){throw 'ASIA_CLONE_FAILED'}}else{& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'ASIA_PULL_FAILED'}};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Deploy-Asia-Supplier-Sources.ps1');if($LASTEXITCODE -ne 0){throw 'ASIA_V2_DEPLOY_FAILED'}
```

The deployment checks existing platform and worker identities, runs the V1+V2 offline and domestic/GSA test suite, preserves 229 REA registry names and pre-existing scope, backs up source and UI files, copies **only** `src/international.mjs` and `Import-International.mjs`, updates the existing international UI with additional country options, restarts only 8792 and 8789, verifies the unchanged U.S. opportunity route, and attempts rollback if a step fails. It does not stop Ollama/Qwen/llama.cpp/NetBird or run REA tools.

Expected `ASIA_COMPANY_SOURCING_V2=PASS`, `ASIA_COUNTRIES=12`, `REGISTERED_SOURCES=18`, `INVENTORY_COUNT=0` until a REAL public company or goods listing is imported.

## Import company profiles or goods opportunities

Use `autonomy-v2/data/international-intake-template.csv` from the Asia checkout, populated with **real** URLs and company records. The importer rejects arbitrary websites and requires a supported country for multi-country sources.

```powershell
& node (Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github\Import-International.mjs') (Join-Path $env:USERPROFILE 'FunIndustrial-Asia-Sourcing\autonomy-v2\data\international-intake-template.csv')
```

A header-only CSV produces **zero companies** and is not a live sourcing scan.

For a company record supply `recordType=supplier_profile`; for a priced product supply `recordType=product_listing`, `priceLocal`, `priceBasis`, `quantity`, and a verified origin. Price, MOQ, Incoterm and stock might remain unknown. Public B2B browsing does **not** authorize automated scraping of sites that restrict access, nor bypass login, geofencing or CAPTCHAs.

## Opportunity sequence and safety

1. Start with publicly browsable exporter and manufacturer directories and genuine company profiles for bulk goods, packaging, industrial machinery and components.
2. Request itemized wholesale prices and minimum-order quantities through approved business channels.
3. Investigate freight for 20-/40-foot containers and smaller LCL shipments; verify tariff classification and anti-dumping duties with a licensed broker.
4. Compare independently evidenced U.S. resale demand and ALL landed costs; keep every result as scenario-only until a buyer/quote is verified.

**Not implemented:** automatic supplier crawling, credentialed marketplace APIs, automated outreach, guaranteed profitable deals, live Asian listings, import customs clearance, payments, bids, orders or house/property sourcing. The original Korean government OnBid APIs remain optional, not a prerequisite.
