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
<section class="panel" id="market-panel">
 <div class="section-header"><div><div class="overline">01 / MARKET TARGETING</div><h2>Where to focus</h2>
 <p>Rank locations using actual ingested parcel data. Keep properties with no matching permit eligible.</p></div><button class="btn secondary" id="load-markets" type="button">Refresh results ↻</button></div>
 <div class="filter-grid">
  <label>County<select id="filter-county"><option value="all">Both counties</option><option value="Los Angeles">Los Angeles</option><option value="San Bernardino">San Bernardino</option></select></label>
  <label>City starts with<input id="filter-city" maxlength="70" placeholder="All cities"></label>
  <label>Minimum building age<select id="filter-age"><option value="0">Any age / unknown</option><option value="15">15+ years</option><option value="20" selected>20+ years / unknown</option><option value="25">25+ years / unknown</option><option value="30">30+ years / unknown</option><option value="40">40+ years / unknown</option></select></label>
  <label>Roofing permit<select id="filter-permit"><option value="all">Include every category</option><option value="none">No roof permit found</option></select></label>
 </div>
 <label class="check"><input type="checkbox" id="include-unclassified" checked> Include parcels not confidently classified residential</label>
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
<section class="panel">
 <div class="overline">04 / MATHEMATICAL MODEL</div><h2>Why a property is prioritized</h2>
 <div class="formula">Priority = f(building age, recorded roof-work age, property category, evidence completeness)</div>
 <div class="two-col"><div><h3>What this can establish</h3><p>A property exists in an official parcel roll; a roof-related permit is recorded; a property is older than a selected age threshold; municipal records have been imported for certain periods.</p></div>
 <div><h3>What it cannot yet establish</h3><p>The roof's actual condition, the absence of work without permits, the complete history of other jurisdictions, whether a home is occupied, or a probability of profitable sales.</p></div></div>
 <p class="foot">Scores are transparent sorting heuristics until qualified inspections and real sales outcomes support model calibration. Before outreach, independently review applicable contractor advertising, privacy, and Do Not Call rules.</p>
</section>
</main></div></body></html>`;
