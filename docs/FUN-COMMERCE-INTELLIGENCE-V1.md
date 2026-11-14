# Commerce Intelligence V1 — Google Trends + Shopify, read-only

## Scope
- Google US **Trending Now RSS**: `https://trends.google.com/trending/rss?geo=US`; no Google API key; one operator-requested GET, no redirects, no automated polling. Shows the newest limited feed items (typically 10), NOT the full Trends Explorer timeline. Captures retrieval UTC, source SHA-256, and original RSS bytes in local content-addressed files.
- Official **Google Trends API**: currently an invitation-only alpha; there is no general-public JSON API credential to plug into this implementation. Apply separately: https://developers.google.com/search/apis/trends
- Shopify GraphQL Admin API `2026-10`: optional read-only product catalog (up to 50 products, first 5 variants) and a limited order-total snapshot (up to 20 orders), with timestamps and raw response SHA-256, **no customer PII**. No write mutations and no model-training authority.
- Cross-source title-word overlap is exploratory only: not statistically verified product demand, profitability, supplier access, or eligibility.
- Google data is news/search interest, not SKU-level sales. Shopify prices are listed prices, not verified costs or profit.
- JSON snapshots are in `%LOCALAPPDATA%\FunIndustrial\CommerceIntelligenceV1`; RSS raw files are content-addressed SHA-256. No access tokens, app secrets or payment data are saved.

## PC activation
Run the existing GitHub fast-forward and `Activate-Fun-Commerce-V1.ps1`. It checks source identity, runs all offline tests, verifies required services, snapshots protected listeners, and restarts only **8802** when needed. It creates a separate fallback worktree at the known previous hub commit before stopping the old 8802 process and attempts to restart it if the new hub fails. The script then attempts exactly ONE operator-requested RSS fetch, prints its source digest and up to eight live topics. A Google outage does not undo an otherwise healthy dashboard.

The original 8789 dashboard, unified Qwen 8798, scikit-learn 8801, REA 8797, automatic local 8796, Qwen 8088, compute 8791, gateway 8443 and Elektron 11434 remain outside the restart scope.

## APIs
- `GET /api/commerce/status` — cached status; **no external request**
- `GET /api/commerce/data` — cached evidence; **no external request**
- `GET /api/commerce/widget.js` — dashboard widget code
- `POST /api/commerce/trends/refresh` — explicit operator request; accepts exactly JSON `{}`, same-origin and header `x-fi-commerce: operator-click`
- `POST /api/commerce/shopify/refresh` — explicit operator request; same gate; requires separate local Shopify authentication

No arbitrary URL fields, no REA functions, no Shopify mutations, no automatic purchasing/publishing, no background poller.

## Local Shopify setup (separate from the Shopify connector in ChatGPT)
The Shopify app connected in ChatGPT does **not** automatically authorize the Windows PC.

Use a store-installed app with only the `read_products` scope, and optionally `read_orders`. For a Dev Dashboard app that is installed on a store in the **same Shopify organization**, the client credentials grant can exchange a client ID and secret for a short-lived token. The feature accepts these environment variables in the **8802 Node process**:

- `FUN_SHOPIFY_SHOP_DOMAIN=<your-store>.myshopify.com`
- `FUN_SHOPIFY_CLIENT_ID=<app client id>`
- `FUN_SHOPIFY_CLIENT_SECRET=<app client secret>`

Alternatively, for a separately acquired and permitted Admin access token: `FUN_SHOPIFY_ADMIN_TOKEN`. The module does not log, write to GitHub, or persist credentials; OAuth and shop-token creation remain an explicit merchant setup step. Do not paste secrets in chat. On-demand client-credentials access tokens are cached only in process memory until expiry. If your app/store does not qualify for client credentials, use Shopify's supported authorization flow first; this module does not silently bypass Shopify permissions.

Shopify references:
- https://shopify.dev/docs/api/admin-graphql
- https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens

## Testing
`node --test intelligence-checks/commerce-intelligence-v1-case.mjs` (network-free) checks parser, digest and RSS storage, tokenless hold, two read-only GraphQL operations, client credentials, lexical overlap and same-origin request boundaries.

The live RSS fetch and Windows process activation can be verified **only on the user's PC**. A clean source tree and the existing services are prerequisites. If an offline test or source check fails, the activation script makes no process changes. The production app remains safe with Shopify unconfigured.
