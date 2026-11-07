## GSA live JSON compatibility (November 7, 2026)

A one-time operator query using the official GSA Auctions API returned live listing JSON containing camelCase fields such as `propertyCity`, `propertyState`, `auctionStatus`, `biddersCount` and HTML `lotInfo` descriptions. The original adapter only recognized the PascalCase fields in the published older field reference. The connector is updated to accept both representations, strip HTML tags and common entities from descriptions, treat high bids as **observed bids, not purchase prices**, tolerate missing bid amounts, and process bounded larger feeds before final ranking.

- `src/domestic.mjs`: read-only parser; 25 MB per-request cap for GSA, up to 6,000 observed lots examined; dashboard shows the top 300 across all sources.
- `test/domestic.test.mjs`: live-shape fixture, missing bid and legacy naming checks.
- `GSA-Live-Preview.mjs`: one-time, read-only live test using GSA's rate-limited public `DEMO_KEY` or a key supplied through `GSA_API_KEY`; shows the 20 most relevant lots in the terminal; **does not alter snapshots or backend credentials**.
- `Repair-GSA-Feed.ps1`: upgrades only the installed Sidequest worker's parser, runs tests first, backs up its prior parser, preserves 8789 dashboard, and verifies the 8792 worker after restart.

From the already-cloned source checkout:

```powershell
$d=Join-Path $env:USERPROFILE 'FunIndustrial-US-Opportunities';git -C $d pull --ff-only;powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Repair-GSA-Feed.ps1')
```

To preview live public GSA lots once, separately:

```powershell
node "$env:USERPROFILE\FunIndustrial-US-Opportunities\autonomy-v2\GSA-Live-Preview.mjs"
```

A permanent api.data.gov key is still needed to enable GSA in the recurring Sidequest scan; the demo key is deliberately not configured for unattended repeated calls. Obtain a key at https://api.data.gov/signup/ and configure it privately in the Windows worker environment. Do not enter keys into GitHub source or send them in chat.

References:
- https://gsa.github.io/auctions_api/fields
- https://gsa.github.io/auctions_api/basics
