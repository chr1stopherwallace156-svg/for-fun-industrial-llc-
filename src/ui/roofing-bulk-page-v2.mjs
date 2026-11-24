// Full-size countywide property inventory and permit-history research page.
// A parcel record is not a separate house; incomplete municipality data remains visible.
export const ROOF_BULK_PAGE=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">
<title>Fun Industrial | Property Intelligence</title>
<link rel="stylesheet" href="/api/fun/roofing/bulk/style.css">
<script src="/api/fun/roofing/bulk/client.js" defer></script>
</head><body>
<div class="layout"><aside class="sidebar">
  <div class="brand"><span class="brandmark">FI</span><div><strong>FUN INDUSTRIAL</strong><small>PROPERTY INTELLIGENCE</small></div></div>
  <nav aria-label="Workspace navigation">
    <a href="/ui-preview/">⌂ &nbsp; Workspace</a>
    <a href="/ui-preview/#chat">✧ &nbsp; Local AI</a>
    <a href="/ui-preview/#operations">▤ &nbsp; Operations</a>
    <a href="/math/v3/">∑ &nbsp; Math Research</a>
  </nav>
  <div class="side-bottom"><span class="statusdot"></span> Local research workspace<p>Public records. No automated marketing, purchasing, credential changes, or external tool execution.</p></div>
</aside>
<main>
<header class="hero"><div class="hero-text"><div class="overline">MARKET INTELLIGENCE / PROPERTY RECORDS</div><h1>Roofing Opportunity Intelligence</h1>
  <p>Actual countywide parcel files, complete published building-permit exports, and jurisdiction-aware matching. No permit sample caps.</p>
  <div class="chips"><span>LOS ANGELES COUNTY</span><span>SAN BERNARDINO COUNTY</span><span>LOCAL SQLITE</span></div>
</div><a class="btn secondary" href="/ui-preview/">Workspace home</a></header>
<section class="metrics" aria-label="Indexed inventory statistics">
 <article class="metric"><span>Properties indexed</span><strong id="total-properties">—</strong><small>Unique assessed parcels, not individually verified homes</small></article>
 <article class="metric"><span>Roof permit records</span><strong id="total-permits">—</strong><small>Matching roof-related permit descriptions</small></article>
 <article class="metric"><span>Candidates indexed</span><strong id="total-candidates">—</strong><small>Ranked, not confirmed roofing needs</small></article>
 <article class="metric"><span>Data completeness</span><strong id="data-completeness">Not verified</strong><small>Varies by jurisdiction and source history</small></article>
</section>
<section class="panel" id="roof-opportunities" aria-labelledby="roof-opportunity-heading">
 <div class="section-header"><div><div class="overline">AUTOMATIC LOCAL CAPABILITY / ROOFING RESEARCH</div>
 <h2 id="roof-opportunity-heading">Roofing opportunities by ZIP and street</h2>
 <p>When a complete local V9 report exists, Fun Industrial automatically offers two independent research pathways. No permit, roof-damage, or customer-interest assertion is made.</p></div>
 <button class="btn secondary" type="button" id="roof-opportunity-refresh">Check local reports ↻</button></div>
 <p class="readout" id="roof-opportunity-status" role="status">Looking for your completed local roofing research reports…</p>
 <div class="metrics" aria-label="Automatically detected location research">
  <article class="metric"><span>Qualifying street blocks</span><strong id="roof-opportunity-blocks">—</strong><small>Same-street 100-number address proxies</small></article>
  <article class="metric"><span>Qualified research properties</span><strong id="roof-opportunity-properties">—</strong><small>Not confirmed roofing jobs</small></article>
  <article class="metric"><span>Historical-permit pathway</span><strong id="roof-opportunity-historical">—</strong><small>Last recorded permit ≥ selected X years</small></article>
  <article class="metric"><span>No-matching-permit pathway</span><strong id="roof-opportunity-no-match">—</strong><small>No exact-APN match in selected records</small></article>
 </div>
 <div class="opportunity-actions" aria-label="Choose roofing research pathway">
  <button type="button" class="btn secondary" id="roof-opportunity-historical-button">Review historical-permit properties</button>
  <button type="button" class="btn secondary" id="roof-opportunity-no-match-button">Review no-match properties</button>
  <button type="button" class="btn secondary" id="roof-opportunity-other-button">Review intermediate-permit records</button>
 </div>
 <p class="readout" id="roof-opportunity-filters">Waiting for source-report parameters.</p>
 <h3>Automatically ranked street blocks</h3>
 <div class="table-wrap"><table><thead><tr><th>ZIP</th><th>Street block</th><th>Qualified properties</th><th>Recent permit parcels</th><th>Historical-path properties</th><th>No-match properties</th></tr></thead>
 <tbody id="roof-opportunity-block-body"><tr><td colspan="6">Reading verified local reports…</td></tr></tbody></table></div>
 <h3>Property research pathway <span id="roof-opportunity-pathway-title">—</span></h3>
 <div class="table-wrap"><table><thead><tr><th>ZIP</th><th>Address</th><th>Construction year</th><th>Existing A score</th><th>Last exact-APN permit</th><th>Recent peer permit parcels</th></tr></thead>
 <tbody id="roof-opportunity-property-body"><tr><td colspan="6">Select a pathway for property research locations.</td></tr></tbody></table></div>
 <p class="foot">Source: the latest complete and internally reconciled local V9 CSV set. Loading this page reads existing reports only; no model calls, automatic downloads, scraping, marketing, or outreach. Formula D remains optional status information and V8 inspection matching is not required. Construction age ≠ roof age; a permit record ≠ completed replacement; no matching permit ≠ no work.</p>
</section>
<section class="panel" id="selection-status">
 <div class="section-header"><div><div class="overline">SELECTIVE EXTRACTION / V3</div><h2>Keep what matters. Hold unknowns. Discard verified irrelevance.</h2>
 <p>Automatic after each successful full-source import. Only necessary parcel identifiers, locality, construction year and roof permit match enter the targeting index.</p></div></div>
 <div class="metrics" aria-label="Filtered roofing candidates">
  <article class="metric"><span>Ready for review</span><strong id="selection-selected">—</strong><small>Older plausible houses in verified imported property records</small></article>
  <article class="metric"><span>Enrichment holds</span><strong id="selection-held">—</strong><small>Missing address, age or residential classification; not silently discarded</small></article>
  <article class="metric"><span>Filtered exclusions</span><strong id="selection-excluded">—</strong><small>Confirmed out-of-scope non-residential parcels</small></article>
  <article class="metric"><span>Extraction state</span><strong id="selection-state">Not started</strong><small>Run automatically when an official source finishes indexing</small></article>
 </div>
 <p class="readout" id="selection-receipt" role="status">No validated selective extraction receipt yet.</p>
 <p class="foot">No permit found means no match in the records ingested, not proof of missing or aging roofing. Historical municipal coverage remains incomplete until verified for each city.</p>
</section>
<section class="panel" id="market-panel">
 <div class="section-header"><div><div class="overline">01 / MARKET TARGETING</div><h2>Where to focus</h2>
 <p>Rank locations using actual ingested parcel data. Keep properties with no matching permit eligible.</p></div><button class="btn secondary" id="load-markets" type="button">Refresh results ↻</button></div>
 <div class="filter-grid">
  <label>County<select id="filter-county"><option value="all">Both counties</option><option value="Los Angeles">Los Angeles</option><option value="San Bernardino">San Bernardino</option></select></label>
  <label>City starts with<input id="filter-city" maxlength="70" placeholder="All cities"></label>
  <label>Minimum building age<select id="filter-age"><option value="0">Any age / unknown</option><option value="15">15+ years</option><option value="20" selected>20+ years / unknown</option><option value="25">25+ years / unknown</option><option value="30">30+ years / unknown</option><option value="40">40+ years / unknown</option></select></label>
  <label>Roofing permit<select id="filter-permit"><option value="all">Include every category</option><option value="none">No roof permit found</option></select></label>
 </div>
 <label class="check"><input type="checkbox" id="include-unclassified"> Include records held for address/age/house-type verification</label>
 <p class="readout" id="market-note" role="status">Connect a full parcel inventory to populate results.</p>
 <div class="table-wrap"><table><thead><tr><th>County</th><th>City / ZIP</th><th>Candidate parcels</th><th>No matching roof permit</th><th>Last observed roof permit 20+ years</th><th>Mean review priority</th></tr></thead><tbody id="market-body"><tr><td colspan="6">No indexed parcels yet</td></tr></tbody></table></div>
 <p class="foot">Markets are ranked only within the imported inventory. This is not a housing census, roof inspection, or a likelihood-of-purchase model.</p>
</section>
<section class="panel">
 <div class="section-header"><div><div class="overline">02 / PROPERTY EVIDENCE</div><h2>Individual parcel review</h2>
 <p>Use permit matches and property construction year to prioritize follow-up verification—not to assert that any roof needs replacing.</p></div>
 <button class="btn secondary" id="load-parcels" type="button">Show parcels ↗</button></div>
 <div class="table-wrap"><table><thead><tr><th>County</th><th>City / ZIP</th><th>Assessor parcel ID</th><th>Address</th><th>Year built</th><th>Last roof-related permit</th><th>Evidence class</th></tr></thead><tbody id="parcel-body"><tr><td colspan="7">Open this view to load up to 100 matching parcels</td></tr></tbody></table></div>
 <p class="foot">A single assessor parcel can contain multiple units. No rooftop age, condition, homeowner contact information or customer interest is inferred from the available fields.</p>
</section>
<section class="panel">
 <div class="section-header"><div><div class="overline">03 / OFFICIAL FULL DATA IMPORTS</div><h2>Connect actual county data</h2>
  <p>Each operator click requests an entire official published file, streams it to disk, and builds an indexed SQLite record. This can use significant disk space and time.</p></div><button type="button" class="btn secondary" id="refresh-sources">Check import status ↻</button></div>
 <p class="readout" id="job-status" role="status">No sync requested in this session.</p>
 <div class="source-list" id="source-list"><div class="source-card">Loading source ledger…</div></div>
 <div class="notice"><strong>Not connected automatically:</strong> Other LA County cities and the county itself, plus San Bernardino municipal permit histories, require their own approved data feed. San Bernardino's official property characteristics ZIP uses a special format; a countywide govPIMS CSV can be imported after reviewing its columns.</div>
</section>
<section class="panel" id="parallel-roof-formulas">
 <div class="overline">04 / PARALLEL MATHEMATICAL MODELS</div><h2>Three complementary ways to investigate roofing history</h2>
 <p class="readout">Formula A keeps the existing property score. Formula B independently measures same-parcel permit intervals. Formula C compares recent roof-related permits among similar-age homes on the same street block. None proves leaks, worn shingles, or replacement need.</p>
 <div class="two-col">
  <div><h3>Formula A — Existing property research priority</h3>
   <div class="formula">S = clip(40 × age-relevance + 20 × old-permit indicator + 10 × no-record indicator + 15 × house-evidence + 15 × completeness, 0, 100)</div>
   <p>Existing V3 property-age, residential classification, and incomplete-evidence score, left untouched.</p></div>
  <div><h3>Formula B — Observed permit cycle by ZIP</h3>
   <div class="formula">Gap X = years since latest roof-related permit ≥ X
Repeat = same APN has recent and older roof-related permits separated by ≥ X years
ZIP activity = 1,000 × recent permit parcels ÷ selected older parcels</div>
   <p>A mathematical comparison of dated permit records. A permit is not proof of roof replacement, and a long recorded gap is not roof age.</p></div>
 </div>
 <div class="filter-grid">
  <label>ZIP codes (comma separated)<input id="formula-zips" value="90011,90049,90731,90037" maxlength="60" inputmode="numeric" aria-label="ZIP codes for parallel formulas"></label>
  <label>Historical interval X (years)<input type="number" id="formula-years" min="10" max="50" step="1" value="20"></label>
  <label>Recent permit window (years)<input type="number" id="formula-recent" min="1" max="10" step="1" value="5"></label>
  <label>Permit description type<select id="formula-kind">
    <option value="roof_related">All roof-related permit descriptions</option>
    <option value="replacement_like">Descriptions suggesting replacement</option>
   </select></label>
 </div>
 <label>Minimum construction age (years)
 <input type="number" id="formula-age" min="20" max="100" step="1" value="25"></label>
 <div class="two-col">
 <div><h3>Formula C — Similar-age neighbors with recent permit records</h3>
 <div class="formula">Comparable neighbors = same named street and 100-number address block, construction years ± Y
 Peer permit activity = comparable neighbor parcels with recent roofing permits ÷ qualifying peer parcels
 Compare local peer activity with ZIP-wide recent roofing-permit frequency</div>
 <p>The subject home's own permit is excluded. The street-block proxy is not measured physical distance; permits do not establish damage or why roofing work occurred.</p></div>
 <div><div class="filter-grid">
  <label>Similar construction year ± Y<input type="number" id="formula-peer-years" min="0" max="15" step="1" value="5"></label>
  <label>Minimum comparable neighboring parcels<input type="number" id="formula-min-peers" min="3" max="30" step="1" value="5"></label>
 </div><p class="foot">Too few neighbors → insufficient evidence, not a roofing risk assertion.</p></div>
 </div>
 <p><button id="run-dual-formulas" class="btn secondary" type="button">Calculate all three formulas</button></p>
 <p class="readout" id="formula-note" role="status">Choose ZIP codes and X years, then calculate. All data stays on this PC; this is a read-only computation.</p>
 <div class="table-wrap"><table><thead><tr>
 <th>ZIP</th><th>Formula A: older parcels</th><th>A: mean score</th>
 <th>B: exact APN matches</th><th>B: latest permit ≥ X years</th>
 <th>B: recent permit parcels</th><th>B: recent repeat after ≥ X years</th>
 <th>B: recent permits / 1,000</th><th>C: comparable-peer candidates</th><th>C: 2+ recent peer permits</th><th>C: unique qualifying street blocks</th><th>C: local-to-ZIP activity ratio</th></tr></thead>
 <tbody id="formula-body"><tr><td colspan="12">No comparison calculated yet.</td></tr></tbody>
 </table></div>
 <h3>Sample parcels with dated permit evidence</h3>
 <div class="table-wrap"><table><thead><tr><th>ZIP</th><th>Assessor parcel ID</th>
 <th>Existing V3 research score</th><th>Latest roof-related permit</th><th>Years since record</th><th>Recent long-gap repeat observed?</th></tr></thead>
 <tbody id="formula-samples"><tr><td colspan="6">Calculate to see up to 12 example parcel IDs.</td></tr></tbody></table></div>
 <h3>Formula C — distinct street-block clusters</h3>
 <p>Count each qualifying same-street number block once, even if many individual properties share the same neighbor-permit evidence. These are address-block proxies, not measured physical neighborhoods.</p>
 <div class="table-wrap"><table><thead><tr>
  <th>ZIP</th><th>Street number block</th><th>Selected older parcels</th>
  <th>Recently permitted parcels</th><th>Comparable candidates with 2+ peer permits</th>
  <th>Construction year range</th></tr></thead>
  <tbody id="unique-block-body"><tr><td colspan="6">Calculate to inspect independent block summaries.</td></tr></tbody>
 </table></div>
 <h3>Formula C — parcel examples for neighborhood verification</h3>
 <p>Examples show recorded roofing-permit activity on comparable nearby parcels—not evidence that the listed property's roof is leaking, worn, or due for replacement.</p>
 <div class="table-wrap"><table><thead><tr>
  <th>ZIP</th><th>Public parcel ID</th><th>Construction year</th><th>Similar-age peers</th>
  <th>Other parcels with recent roof permits</th><th>Peer permit share</th>
  <th>Subject roof condition</th></tr></thead>
  <tbody id="neighbor-example-body"><tr><td colspan="7">Calculate to inspect capped comparable-neighbor research examples.</td></tr></tbody>
 </table></div>
 <p class="foot">Only exact parcel-ID matches feed Formulas B and C. Formula A may also use supported address matching. The three methods provide separate research signals, never proof of leaks, worn shingles, roof age or commercial conversion. Municipal coverage is incomplete; verify original permit details before follow-up.</p>
</section>
</main></div></body></html>`;
