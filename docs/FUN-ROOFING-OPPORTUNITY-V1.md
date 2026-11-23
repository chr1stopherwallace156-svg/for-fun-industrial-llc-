# Fun Industrial — Roofing Opportunity Intelligence V1

## Scope and access

This is a **Fun Industrial only** module and opt-in page at
\`http://127.0.0.1:8802/roofing/\`. The production \`/\` homepage, organized
\`/ui-preview/\` homepage, local Qwen, V1–V3 math, ML, REA and all previous
tools remain intact. The new UI appears in the organized workspace's quick
access and operations pages.

The module targets **Los Angeles County and San Bernardino County** through
county/city/ZIP filters, including properties with **no roofing permit found
in the records actually imported**. It is not a complete countywide property
database, nor proof of roofing condition, permit noncompliance, damage, or
owner interest.

## Source inventory

| Source | Integration | Evidence and limitations |
|---|---|---|
| LA City Building Permits Issued 2010–2019, \`dyxf-7hc4\` | **On-demand API sampling** | Operator clicks refresh; up to 1,000 roofing-description matches, not exhaustive |
| LA City Building Permits Issued 2020–present, \`pi9x-tg5x\` | **On-demand API sampling** | Same limit and caveat |
| LA County EPIC-LA | Source directory / external portal | Separate record access not implemented; county-only jurisdiction |
| San Bernardino County Accela | Source directory / external portal | Separate record access not implemented; unincorporated county jurisdiction |
| Victorville monthly issued permit CSV reports | Source directory + operator file import after normalization | Not automatically scraped |
| LA County official assessor roll 2021–2025 | Source directory / downloadable source | Includes year built; requires operator preparation into property inventory schema |
| San Bernardino Assessor parcel lookup | Source directory | Verify terms / bulk data rights before extraction |
| Other cities | Individual municipal feeds or operator-provided records | **Not automatically connected** |
| National Weather Service API | Operator clicks refresh | Five reference locations; ~7-day forecasts, not property damage claims |

The LA City public data and the LA County portal are **different jurisdictions**.
Do not infer a no-permit conclusion from LA City data when assessing properties
in Palmdale, Lancaster, Pasadena or other municipalities.

## Data normalization and imports

The system needs a **property inventory** before it can compute a no-permit
candidate list. The government issues permit records about some properties;
a list of permits alone is not a reliable list of all properties without permits.

Import CSV files at \`/roofing/\` using these headers.

Property inventory:

\`\`\`csv
county,city,address,zip,year_built,property_type
Los Angeles,Los Angeles,120 DEMO ST,90001,1987,Single family
San Bernardino,Victorville,450 DEMO WAY,92392,1991,Single family
\`\`\`

Roofing permits:

\`\`\`csv
county,city,address,zip,issue_date,work_description,permit_id
Los Angeles,Los Angeles,120 DEMO ST,90001,2003-08-02,REROOF,EXAMPLE01
\`\`\`

*These are fictional demonstration rows. Do not import them as genuine records.*

The user interface accepts up to 1,000 rows / 700 KB per **explicit upload**.
Only county, city, address, ZIP, year built, property type, issue date,
description and permit ID are retained; homeowner names, phone numbers,
emails, and other unrelated columns are not copied. Source data stays
locally in \`%LOCALAPPDATA%\\FunIndustrial\\RoofingOpportunityV1\\state.json\`.
Existing service ports and files are not changed by these imports.

For more than 1,000 records, split the property source into smaller CSV files.
The initial V1 backend caps data at 25,000 property inventory records and
30,000 permit records. This is a pilot capacity, **not coverage of every home
in either county**. Expanding beyond that requires a reviewed, disk-backed
importer and verified commercial-use rights.

## Scoring logic

* **No permit found:** No matching roof permit in the ingested records. The
  source may be incomplete and the roof's actual age is unknown.
* **Last recorded permit ≥20 years:** A roofing-related permit was matched
  to the property by verified ZIP + street, or exact city + street, and its
  issue year is at least 20 years earlier.
* **More recent recorded permit:** A more recent roof-related permit was
  observed, without a verified roofing condition.
* Market ranking groups candidates by county, city and ZIP **within the
  imported inventory only**. The initial 0–100 review-priority number is an
  explicit heuristic, **not a trained probability, revenue estimate, or
  verified customer lead**.

## Weather and next-week deployment

The NWS button collects forecasts for Los Angeles, Palmdale, San Bernardino,
Victorville and Ontario via \`api.weather.gov\`. Forecasts can change;
probability of precipitation is not evidence that a given roof will leak.
Never promise storm damage or make false urgency claims.

For near-term use:
1. Activate the reviewed \`Start-Fun-Everything-Roofing.ps1\`.
2. Open \`/roofing/\` and click **Get latest NWS forecasts**.
3. Click **Refresh LA City permit samples** to build a partial known-permit
   database for Los Angeles city only.
4. Obtain lawful property inventories with verified years built and normalize
   into the shown CSV schema. Upload each independently by operator click.
5. For San Bernardino County, verify the appropriate county/city source and
   convert its downloadable permits to the specified format.
6. Filter by county, city, ZIP, minimum age and permit status. Review results;
   do not interpret no-match as no prior roof replacement.
7. Before contacting residents, verify CSLB advertising and contractor
   license requirements, privacy/opt-out obligations and applicable
   Do Not Call rules. Any inspection and outreach require independent
   operator and customer decisions.

## Security and validation

The \`/api/fun/roofing/status\` and \`/api/fun/roofing/leads\` routes
are read-only. Mutations \`/import\`, \`/refresh-la\` and
\`/refresh-weather\` require a same-origin POST, a fixed operator-click
header and JSON request; input and remote responses have bounded sizes.
Requests use fixed official domains and no arbitrary third-party URLs.
No data enrichment, automated outreach, REA tools, model training, bids,
payments, login bypass, or Elektron access is present.

\`node --test test/roofing-opportunity-v1.test.mjs\` checks the import
constraints, LA neighborhood/ZIP matching, non-permit retention, mocked
official sources, forecast interpretation, and HTTP routes. The full activation
script also checks the existing organized dashboard and V3 routes before
accepting the new 8802 Node process, with rollback to the old source.

**Do not report a successful live ingest or Windows deployment until the
operator has run the activation and returned proof of the result.**
