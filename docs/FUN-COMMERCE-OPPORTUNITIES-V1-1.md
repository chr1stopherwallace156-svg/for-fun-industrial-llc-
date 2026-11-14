# Fun Industrial Commerce Intelligence V1.1 — evidence-first research queue

## Purpose
Improve the existing Commerce Intelligence V1 dashboard on loopback `127.0.0.1:8802` without replacing it. Existing Google Trending Now RSS (US) and optional read-only Shopify snapshots are used to create **research leads**, not fake sales forecasts. This stage intentionally does not treat search traffic as buying intent or listed prices as profit.

## What's added
- `GET /api/commerce/opportunities`: entirely read-only deterministic report based only on locally cached `trends.json` and `shopify.json`. No requests to Google, Shopify, Qwen or REA; no timers or training.
- Source status reports captured UTC, SHA-256 digest and age in hours. Trends older than 48 hours receive `source_stale_review_only`.
- A small, explicit product-vocabulary category classifier excludes most news/sports/people search topics from the product research queue. It does not claim universal accuracy.
- If an authenticated Shopify catalog exists, require **at least two shared title words** before calling a trend a catalog-title match. Report the listed price only, with currency unverified; no supplier cost or margin claims.
- If no Shopify product matches, product-related trends appear in a separate `research_leads` queue with supply, wholesale cost, shipping, fees, returns and demand-validation evidence gaps.
- Heuristic priority order is only a research triage convention, not an ML prediction, estimated revenue or expected net profit.
- The dashboard presents Google topics, catalog evidence and V1.1 research queue with text-safe DOM rendering.

## Boundaries and honest limitations
- The public US Google Trending Now RSS usually contains news, events, people and sports. A successful live fetch can correctly produce **zero product leads**.
- The Shopify store connected within ChatGPT is a different connection from the PC. Unless separate read-only Shopify Admin credentials are configured inside the 8802 process, `shopify_product_count=0` and no actual product/supplier matches can be reported.
- Shopify catalog products are **retail listings**, not a live wholesale feed. Supplier cost, inventory eligibility and shipping costs remain unverified even with product titles matched.
- The V1.1 ranker uses conventional deterministic software only. scikit-learn's earlier IsolationForest test proves that real computation works with supplied data, but does **not** prove that Google Trends topics predict sales.
- No Shopify mutations, REA tool calls, purchasing, publishing, training or external HTTP operations are performed by the opportunities endpoint. No cron/poller runs.

## Test and activation
New source and test:
- `src/commerce/opportunity-ranking-v1-1.mjs`
- `intelligence-checks/commerce-opportunities-v1-1-case.mjs`

The existing `Start-Fun-ML-Dashboard-V3.ps1 -CheckOnly` now includes the V1.1 offline tests. The existing `Activate-Fun-Commerce-V1.ps1` performs these tests and health preflight before restarting only the 8802 hub. Its fallback commit has been advanced to the last known working Commerce V1 source (`619309d8679ec775ba3fe4635be6fe0d007c2896`). The deployment verifies the V1.1 report route and returns the number of catalog matches and research leads. The existing one-time Google RSS refresh remains an operator-initiated part of the launch. No automatic polling starts.

On a normal PC with the repo checked out clean on `feature/fun-ml-unified-dashboard-v3-20261113`, run the already documented Git fast-forward + `Activate-Fun-Commerce-V1.ps1` command once.

Expected verification markers:
```
FUN_COMMERCE_TESTS_AND_SERVICE_PREFLIGHT=PASS
FUN_COMMERCE_HUB_ACTIVATION=PASS
FUN_COMMERCE_V1_1_RESEARCH_QUEUE=PASS STATE=...
FUN_COMMERCE_V1_1_CATALOG_MATCHES=...
FUN_COMMERCE_V1_1_PRODUCT_RESEARCH_LEADS=...
```

A healthy V1.1 deployment can report zero opportunity leads if no current product-related trends are found. That is correct, not a failure.

## Future scope (not implemented)
- Legitimate supplier feeds and manual wholesale quotes with cost provenance
- Currency-aware landed-cost/margin calculations
- Real historical sales and conversion modeling
- Time-bounded trend histories with actual approved Google Trends API access
- Review-gated user-authorized Shopify changes
