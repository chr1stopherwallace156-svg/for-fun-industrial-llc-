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
 <div class="overline">04 / PARALLEL MATHEMATICAL MODELS</div><h2>Two ways to investigate roofing history</h2>
 <p class="readout">Formula A stays unchanged. Formula B separately measures historical-versus-recent roof-related permits on the same parcel within each ZIP. Neither formula predicts that a roof definitely needs replacing.</p>
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
 <p><button id="run-dual-formulas" class="btn secondary" type="button">Calculate both formulas</button></p>
 <p class="readout" id="formula-note" role="status">Choose ZIP codes and X years, then calculate. All data stays on this PC; this is a read-only computation.</p>
 <div class="table-wrap"><table><thead><tr>
 <th>ZIP</th><th>Formula A: older parcels</th><th>A: mean score</th>
 <th>B: exact APN matches</th><th>B: latest permit ≥ X years</th>
 <th>B: recent permit parcels</th><th>B: recent repeat after ≥ X years</th>
 <th>B: recent permits / 1,000</th></tr></thead>
 <tbody id="formula-body"><tr><td colspan="8">No comparison calculated yet.</td></tr></tbody>
 </table></div>
 <h3>Sample parcels with dated permit evidence</h3>
 <div class="table-wrap"><table><thead><tr><th>ZIP</th><th>Assessor parcel ID</th>
 <th>Existing V3 research score</th><th>Latest roof-related permit</th><th>Years since record</th><th>Recent long-gap repeat observed?</th></tr></thead>
 <tbody id="formula-samples"><tr><td colspan="6">Calculate to see up to 12 example parcel IDs.</td></tr></tbody></table></div>
 <p class="foot">Only exact parcel-ID matches feed Formula B. Formula A may also use supported address matching. Both are local research indicators, never roof-condition or marketing-conversion probabilities. Municipality coverage is incomplete and original permit details should be checked before any follow-up.</p>
</section>
</main></div></body></html>`;
