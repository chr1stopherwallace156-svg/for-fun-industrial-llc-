// Public-record, consent-aware roofing opportunity research workspace.
export const ROOF_UI_HTML=String.raw`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0b1420">
<title>Fun Industrial · Roofing Opportunity Intelligence</title>
<link rel="stylesheet" href="/api/fun/roofing/style.css">
<script src="/api/fun/roofing/client.js" defer></script>
</head><body><div class="workspace">
<aside class="sidebar"><div class="brand"><span class="mark">FI</span><div><strong>FUN INDUSTRIAL</strong><small>PROPERTY INTELLIGENCE</small></div></div>
<nav aria-label="Workspace"><a href="/ui-preview/">⌂ &nbsp; Organized home</a><a href="/ui-preview/#operations">▤ &nbsp; Operations</a><a href="/ui-preview/#chat">✧ &nbsp; Local AI Chat</a><a href="/math/v3/">∑ &nbsp; Research V3</a><a href="/" class="subtle">Original Dashboard</a></nav>
<div class="aside-note"><span class="dot"></span> LOCAL RESEARCH<div>Read-only public data. No automatic outreach, payments, REA permissions, or model execution.</div></div></aside>
<main><header><div><p class="eyebrow">FUN INDUSTRIAL / MARKET INTELLIGENCE</p><h1>Roofing Opportunities</h1>
<p class="subtitle">San Bernardino &amp; Los Angeles counties. Filter public evidence into review candidates, without guessing roof condition or treating missing permits as proof.</p></div>
<a class="button secondary" href="/ui-preview/">Back to workspace</a></header>
<section class="intro-grid" aria-label="Current inventory">
<div class="kpi"><span>Properties indexed</span><strong id="roof-property-count">—</strong><small>From operator-supplied property inventories</small></div>
<div class="kpi"><span>Roofing permit records</span><strong id="roof-permits">—</strong><small>Imported or live public-source samples</small></div>
<div class="kpi"><span>Review candidates</span><strong id="roof-leads">—</strong><small>Not verified roofing needs</small></div>
<div class="kpi"><span>Last updated</span><strong id="roof-updated">—</strong><small>Local evidence snapshot</small></div></section>
<section class="panel" aria-label="Filter candidates">
<div class="section-head"><div><p class="eyebrow">01 / PRIORITIZE</p><h2>Target area &amp; property filters</h2></div><span class="tag">No-permit properties included</span></div>
<div class="filters">
<label>County<select id="roof-county"><option value="all">Both counties</option><option>Los Angeles</option><option>San Bernardino</option></select></label>
<label>City contains<input id="roof-city" maxlength="80" placeholder="Any city"></label>
<label>Minimum building age<select id="roof-age"><option value="15">15+ years</option><option value="20" selected>20+ years</option><option value="25">25+ years</option><option value="30">30+ years</option><option value="40">40+ years</option></select></label>
<label>Roof permit history<select id="roof-category"><option value="all">All candidates</option><option value="NO_PERMIT_FOUND_IN_INGESTED_RECORDS">No roofing permit found</option><option value="LAST_RECORDED_ROOF_PERMIT_20_PLUS">Last record 20+ years ago</option><option value="RECENT_ROOF_PERMIT_FOUND">Recent recorded permit</option></select></label>
</div>
<div class="bar"><button id="roof-filter" class="button" type="button">Apply filters</button>
<span class="help">No permit found means no match in ingested records; source coverage may be incomplete.</span></div>
<p id="roof-lead-status" class="help">Loading saved candidates…</p>
<div class="table-scroll"><table><thead><tr><th>Area</th><th>Property address</th><th>Year built</th><th>Recorded roof permit</th><th>Category</th><th>Review priority*</th></tr></thead><tbody id="roof-lead-table"><tr><td colspan="6">No imported property inventory yet.</td></tr></tbody></table></div>
<p class="footnote">*Priority is a provisional sorting heuristic, not a validated probability of replacement, inspection finding, sale, or profit. Address matches need independent review.</p></section>
<div class="cols">
<section class="panel" aria-label="Public data sources"><p class="eyebrow">02 / EVIDENCE</p><h2>Official data connections</h2>
<p class="help">The Los Angeles City API samples can be retrieved on demand. Other municipalities and county portals require permitted files or separate integrations. Countywide coverage is not yet complete.</p>
<div class="bar"><button id="roof-la-refresh" class="button secondary" type="button">Refresh LA City permit samples</button><span class="help">Up to 1,000 matching records per dataset; not exhaustive</span></div>
<p role="status" class="help" id="roof-import-status">No refresh requested.</p>
<div class="source-list" id="roof-source-list">Loading official source directory…</div></section>
<section class="panel" aria-label="Rain outlook"><p class="eyebrow">03 / WEATHER</p><h2>Upcoming rain outlook</h2>
<p class="help">National Weather Service forecasts for five representative locations. Not property-level forecasts, roof inspections, or storm-damage confirmation.</p>
<div class="bar"><button id="roof-weather-refresh" class="button secondary" type="button">Get latest NWS forecasts</button></div>
<p role="status" class="help" id="roof-weather-status">No forecast requested.</p>
<div id="roof-weather-list" class="weather-list"><p class="help">Forecast data appears here after a refresh.</p></div></section>
</div>
<section class="panel" aria-label="Import records"><div class="section-head"><div><p class="eyebrow">04 / ADD COVERAGE</p><h2>Import property &amp; permit records</h2></div><span class="tag">Operator-selected files only</span></div>
<p class="help">The engine cannot infer “no permit” from a permit list alone. Supply a property inventory (one address per row), then connect verified roofing-permit data from the applicable city or county. Files stay on your PC; no owner names or phone numbers are collected.</p>
<div class="import-grid">
<div><h3>Property inventory CSV</h3><p class="help">Required headers: <code>county,city,address,year_built</code>. Optional: <code>zip,property_type</code>.</p>
<label class="upload-label">Select CSV file<input id="roof-property-file" type="file" accept=".csv,text/csv"></label>
<button class="button" id="roof-property-upload" type="button">Import property rows</button></div>
<div><h3>Roof permit CSV</h3><p class="help">Required headers: <code>county,city,address,issue_date,work_description</code>. Optional: <code>permit_id</code>.</p>
<label class="upload-label">Select CSV file<input id="roof-permit-file" type="file" accept=".csv,text/csv"></label>
<label class="checkbox"><input id="roof-explicit-permits" type="checkbox"> File contains verified roofing permits even if descriptions are abbreviated</label>
<button class="button" id="roof-permit-upload" type="button">Import permit rows</button></div></div>
<p class="footnote">Imports are limited to 1,000 rows per click; only approved address and building fields are retained. No personal contact details or automated messaging are stored.</p></section>
<section class="panel" aria-label="Responsible outreach"><p class="eyebrow">05 / NEXT ACTION</p><h2>From evidence to compliant customer outreach</h2>
<div class="workflow"><div><strong>1 · Verify</strong><p>Check the correct permitting authority, data coverage and address match.</p></div>
<div><strong>2 · Inspect</strong><p>Offer a non-alarmist, voluntary inspection; do not claim weather damage or unsafe conditions without evidence.</p></div>
<div><strong>3 · Estimate</strong><p>Calculate roof scope, permit requirements, labor, materials, lead cost and gross margin.</p></div>
<div><strong>4 · Contact lawfully</strong><p>Review CSLB advertising requirements, California privacy rules, Do Not Call lists and consent before outreach.</p></div></div>
<p class="footnote">This software does not send messages, call homeowners, purchase contact lists, submit bids, or execute REA actions.</p>
</section></main></div></body></html>`;
