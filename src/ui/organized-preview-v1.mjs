// Design preview only: no modifications to the current dashboard homepage.
export const PREVIEW_VERSION='fun-industrial-organized-ui-preview-v1';
export const PREVIEW_HTML=String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b1320"><meta name="color-scheme" content="dark">
<title>Fun Industrial — Workspace Preview</title>
<link rel="stylesheet" href="/api/fun/ui-preview/app.css">
<script src="/api/fun/ui-preview/app.js" defer></script>
</head><body>
<a href="#main" class="skip-link">Skip to content</a>
<div class="app" id="app">
<aside class="sidebar" id="sidebar" aria-label="Primary navigation">
 <div class="brand"><div class="brand-symbol" aria-hidden="true"><span>F</span><span>I</span></div>
 <div class="brand-words"><strong>FUN INDUSTRIAL</strong><small>WORKSPACE</small></div></div>
 <p class="nav-label">GENERAL</p>
 <nav class="main-nav" aria-label="General">
  <a href="#home" data-route="home"><span class="nav-symbol" aria-hidden="true">⌂</span><span>Home</span></a>
  <a href="#chat" data-route="chat"><span class="nav-symbol" aria-hidden="true">✧</span><span>AI Chat</span></a>
  <a href="#research" data-route="research"><span class="nav-symbol" aria-hidden="true">∑</span><span>Research</span></a>
  <a href="#operations" data-route="operations"><span class="nav-symbol" aria-hidden="true">▤</span><span>Operations</span></a>
  <a href="#commerce" data-route="commerce"><span class="nav-symbol" aria-hidden="true">◈</span><span>Commerce</span></a>
 </nav>
 <p class="nav-label nav-label-spaced">MANAGEMENT</p>
 <nav class="main-nav" aria-label="Management">
  <a href="#tools" data-route="tools"><span class="nav-symbol" aria-hidden="true">⬡</span><span>Tools &amp; ML</span></a>
  <a href="#system" data-route="system"><span class="nav-symbol" aria-hidden="true">◉</span><span>System</span></a>
 </nav>
 <div class="sidebar-bottom">
  <div class="local-card"><span class="local-dot" aria-hidden="true"></span><div><strong>Private workspace</strong><small>Running on this computer</small></div></div>
  <a href="/" class="old-ui-link">Original dashboard <span aria-hidden="true">↗</span></a>
 </div>
</aside>
<div class="sidebar-backdrop" id="sidebar-backdrop" hidden></div>
<div class="main-shell">
 <header class="topbar">
  <div class="topbar-left"><button type="button" class="menu-button icon-button" id="menu-button" aria-controls="sidebar" aria-expanded="false" aria-label="Open menu">☰</button>
   <span class="breadcrumb">Workspace <span class="breadcrumb-sep">/</span> <strong id="breadcrumb-current">Home</strong></span>
  </div>
  <div class="topbar-right"><button type="button" id="global-search" class="search-open" aria-haspopup="dialog"><span aria-hidden="true">⌕</span> <span>Find a workspace</span> <kbd>Ctrl K</kbd></button>
   <span class="local-connection"><span class="local-dot" aria-hidden="true"></span> Local · 8802</span>
   <a class="topbar-exit" href="/" title="Return to unchanged dashboard">Exit preview</a>
  </div>
 </header>
 <main id="main" tabindex="-1">
  <section class="view" data-view="home" aria-labelledby="home-heading">
   <div class="page-heading home-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span> CONTROL CENTER · DESIGN PREVIEW</div>
    <h1 id="home-heading">Everything in its place.</h1>
    <p>Your AI, research, and business operations — organized in one calm workspace. No crowded panels or unnecessary steps.</p>
   </div><div class="heading-action"><button class="btn btn-outline" type="button" data-action="refresh">Refresh system status <span aria-hidden="true">↻</span></button></div></div>
   <div class="home-hero-grid">
    <a class="feature-card feature-chat" href="#chat"><div class="card-icon">✧</div><div><span class="feature-meta">LOCAL INTELLIGENCE</span><h2>Talk to your AI.</h2><p>One focused chat. Research context only when you choose it.</p></div><span class="feature-arrow" aria-hidden="true">↗</span></a>
    <a class="feature-card" href="#research"><div class="card-icon">∑</div><div><span class="feature-meta">MATHEMATICAL DISCOVERY</span><h2>Explore the evidence.</h2><p>V3 results, frozen studies, and the complete research lab.</p></div><span class="feature-arrow" aria-hidden="true">↗</span></a>
    <a class="feature-card" href="#operations"><div class="card-icon">▤</div><div><span class="feature-meta">BUSINESS COMMAND</span><h2>See what matters.</h2><p>Grants, buyers, procurement, and progress in one place.</p></div><span class="feature-arrow" aria-hidden="true">↗</span></a>
   </div>
   <div class="section-heading"><div><span class="eyebrow">AT A GLANCE</span><h2>System health</h2></div><span class="muted tiny" id="last-refreshed">Not yet checked</span></div>
   <div class="pulse-grid">
    <article class="pulse"><div class="pulse-label">AI Chat <span aria-hidden="true">✧</span></div><strong data-status="qwen">Not checked</strong><small>Existing Qwen connection</small></article>
    <article class="pulse"><div class="pulse-label">V3 Research <span aria-hidden="true">∑</span></div><strong data-status="math">Not checked</strong><small>Frozen hypothesis monitoring</small></article>
    <article class="pulse"><div class="pulse-label">Operations <span aria-hidden="true">▤</span></div><strong data-status="ops">Not checked</strong><small>Verified business evidence</small></article>
    <article class="pulse"><div class="pulse-label">ML Services <span aria-hidden="true">◈</span></div><strong data-status="ml">Not checked</strong><small>Existing analytic capability</small></article>
   </div>
   <div class="section-heading section-heading-spaced"><div><span class="eyebrow">KEEP MOVING</span><h2>Common destinations</h2></div></div>
   <div class="simple-links"><a href="/roofing/"><span>Roofing opportunities</span><span>LA &amp; San Bernardino Counties ↗</span></a>
   <a href="#operations?area=buyers"><span>Fleet buyers</span><span>Find verified demand ↗</span></a>
    <a href="#operations?area=procurement"><span>Procurement</span><span>Review sourced opportunities ↗</span></a>
    <a href="#commerce"><span>Commerce intelligence</span><span>Trends and product analysis ↗</span></a>
    <a href="#tools"><span>Tools &amp; analytics</span><span>Operator-reviewed actions ↗</span></a></div>
   <p class="disclaimer">Research findings are not approved contracts, guaranteed profit, or evidence of model intelligence. Actions still require your approval.</p>
  </section>

  <section class="view" data-view="chat" aria-labelledby="chat-heading" hidden>
   <div class="page-heading"><div><span class="eyebrow">LOCAL INTELLIGENCE</span><h1 id="chat-heading">AI Chat</h1><p>Just the conversation. Advanced tools stay in their own workspace.</p></div>
    <a class="btn btn-outline" href="/chat/">Advanced Qwen workspace ↗</a></div>
   <div class="chat-layout"><div class="chat-card"><div class="chat-card-head"><div class="bot-avatar">✧</div><div><strong>Local AI assistant</strong><small>Existing Qwen · single request per send · no automatic tool execution</small></div>
    <span class="private-label">ON DEVICE</span></div>
    <div id="chat-history" class="chat-history" role="log" aria-live="polite" aria-label="Conversation">
     <div class="chat-welcome"><div class="chat-welcome-icon">✧</div><h2>What can I help you think through?</h2><p>Ask about your research, operations, code, or ideas. Keep it simple.</p></div>
    </div>
    <form id="chat-form" class="composer"><label for="chat-input" class="sr-only">Message to Qwen</label>
    <textarea id="chat-input" maxlength="1200" rows="3" placeholder="Ask a question, analyze a result, or explore an idea…"></textarea>
    <div class="composer-footer"><div class="chat-context"><label><input id="chat-v3" type="checkbox"> Include V3 results</label><label><input id="chat-v2" type="checkbox"> Include V2 results</label></div>
    <button class="btn btn-primary" type="submit" id="chat-send">Send <span aria-hidden="true">↗</span></button></div></form>
   </div><aside class="chat-aside"><div class="aside-card"><span class="eyebrow">HOW THIS CHAT WORKS</span><h3>Clear boundaries.</h3><p>Qwen interprets evidence when you ask. It does not automatically execute commands, train itself, or call REA tools.</p>
    <a href="#research">Explore research ↗</a><a href="#tools">Use approved tools ↗</a></div>
    <div class="aside-card aside-quieter"><span class="eyebrow">MORE CAPABILITIES</span><p>Need source analysis, math verification, or an inspected tool result?</p><a href="/chat/">Open the advanced workspace ↗</a></div>
   </aside></div>
  </section>

  <section class="view" data-view="research" aria-labelledby="research-heading" hidden>
   <div class="page-heading"><div><span class="eyebrow">EVIDENCE &amp; DISCOVERY</span><h1 id="research-heading">Research</h1><p>Your mathematical work, with the findings first and the machinery second.</p></div>
   <a class="btn btn-outline" href="/math/v3/">Open full V3 lab ↗</a></div>
   <div class="research-intro"><div class="research-headline"><div class="research-symbol">∑</div><div><span class="feature-meta">CURRENT RESEARCH</span><h2>Mathematical Discovery V3</h2><p>138 equations per eligible rules era. Scores are evidence, not promises.</p></div></div>
   <div class="research-stats"><div><span>Drawings</span><strong id="research-draws">—</strong></div><div><span>Last draw</span><strong id="research-last">—</strong></div><div><span>Future scored</span><strong id="research-future">—</strong></div><div><span>e-value</span><strong id="research-evalue">—</strong></div></div>
   <p id="research-status" class="info-line">V3 status not yet checked.</p></div>
   <div class="two-panels"><article class="simple-panel"><span class="eyebrow">RESEARCH IN CONTEXT</span><h3>What the evidence says</h3><p>Some models may fit validation data but fail later. V3 keeps every candidate’s result, including failures, and freezes its future evaluation.</p>
      <a href="/math/v3/">Inspect all equation scores ↗</a></article>
      <article class="simple-panel"><span class="eyebrow">PREVIOUS WORK</span><h3>Mathematical Research V2</h3><p>Earlier equation studies and historical comparisons, retained without replacing V3.</p>
      <a href="/math/">Open V2 archive ↗</a></article></div>
  </section>

  <section class="view" data-view="operations" aria-labelledby="operations-heading" hidden>
   <div class="page-heading"><div><span class="eyebrow">REAL WORK, REAL EVIDENCE</span><h1 id="operations-heading">Operations</h1><p>Find the business information you need without scanning every module.</p></div><div class="heading-action"><a class="btn btn-outline" href="/roofing/">Roofing opportunities ↗</a> <a class="btn btn-outline" href="/operations/">Full operations ↗</a></div></div>
   <div class="segment-tabs" role="tablist" aria-label="Operations areas">
    <button type="button" class="segment" data-ops="overview" role="tab" aria-selected="true">Overview</button>
    <button type="button" class="segment" data-ops="buyers" role="tab" aria-selected="false">Fleet Buyers</button>
    <button type="button" class="segment" data-ops="procurement" role="tab" aria-selected="false">Procurement</button>
    <button type="button" class="segment" data-ops="compliance" role="tab" aria-selected="false">Compliance</button>
   </div><div id="ops-content"><div class="ops-overview"><div class="ops-feature"><span class="eyebrow">OPERATIONS CENTER</span><h2>Review before you act.</h2><p>Government programs, buyer requirements and qualification steps remain source-linked and read-only until explicitly approved.</p><a class="btn btn-primary" href="/operations/">Open all operations ↗</a></div>
    <div class="ops-feature ops-feature-soft"><span class="eyebrow">QUICK REVIEW</span><h3>Pick an area above</h3><p>Fleet demand, procurement opportunities, and regulatory evidence appear in focused views. You can always open the original operations workspace.</p></div></div></div>
  </section>

  <section class="view" data-view="commerce" aria-labelledby="commerce-heading" hidden>
   <div class="page-heading"><div><span class="eyebrow">STORE &amp; MARKET INTELLIGENCE</span><h1 id="commerce-heading">Commerce</h1><p>Research products, trends, and opportunities without mixing them into your AI conversation.</p></div><a class="btn btn-outline" href="/workspace/?view=commerce">Open full commerce tools ↗</a></div>
   <div class="simple-panel wide-panel"><span class="eyebrow">EXISTING MODULE</span><h2>Commerce intelligence</h2><p>Google Trending Now and Shopify research are available through the existing workspace. Refreshes and account actions still require explicit clicks.</p>
   <button class="btn btn-primary" data-open-frame="commerce" type="button">Open commerce module ↗</button></div>
   <div class="embedded-slot" id="commerce-frame" hidden></div>
  </section>

  <section class="view" data-view="tools" aria-labelledby="tools-heading" hidden>
   <div class="page-heading"><div><span class="eyebrow">CONTROLLED CAPABILITIES</span><h1 id="tools-heading">Tools &amp; ML</h1><p>One place to find your advanced tools. Nothing executes just by opening a page.</p></div></div>
   <div class="tool-grid">
    <a class="tool-card" href="/chat/"><div class="tool-icon">⬡</div><strong>REA review</strong><p>Inspect tools and approve individual read-only actions.</p><span>Open reviewed workspace ↗</span></a>
    <a class="tool-card" href="/fisre/"><div class="tool-icon">∫</div><strong>Semantic reasoning</strong><p>Analyze submitted Python source as text, with bounded proof checks.</p><span>Open reasoning lab ↗</span></a>
    <a class="tool-card" href="/control/"><div class="tool-icon">◫</div><strong>Control deck</strong><p>View local system controls and verified device status.</p><span>Open control deck ↗</span></a>
    <button class="tool-card tool-button" type="button" data-open-frame="ml"><div class="tool-icon">⌘</div><strong>Machine learning</strong><p>Inspect existing scikit-learn, Optuna, and OR-Tools workflows.</p><span>Open ML module ↗</span></button>
   </div><div class="embedded-slot" id="ml-frame" hidden></div>
  </section>

  <section class="view" data-view="system" aria-labelledby="system-heading" hidden>
   <div class="page-heading"><div><span class="eyebrow">LOCAL SYSTEM</span><h1 id="system-heading">System</h1><p>Service information and the original advanced interface, without extra noise.</p></div>
    <button class="btn btn-outline" type="button" data-action="refresh">Refresh statuses ↻</button></div>
   <div class="simple-panel wide-panel"><h2>Service status</h2><p>These are read-only, on-demand checks. An API being configured does not guarantee that its model is healthy.</p>
    <div class="status-list"><div><span>Qwen chat interface</span><strong data-status="qwen">Not checked</strong></div>
     <div><span>Math Research V3</span><strong data-status="math">Not checked</strong></div>
     <div><span>Business operations</span><strong data-status="ops">Not checked</strong></div>
     <div><span>ML bridge</span><strong data-status="ml">Not checked</strong></div></div>
    <p class="muted tiny" id="system-checked">No health checks yet.</p></div>
   <div class="two-panels"><article class="simple-panel"><h3>Advanced system</h3><p>Keep specialized modules and legacy workflows accessible without cluttering daily navigation.</p><a href="/">Return to the original dashboard ↗</a></article>
    <article class="simple-panel"><h3>About this preview</h3><p>This layout is isolated. It does not alter your homepage, model, worker schedules, permissions, or previous research.</p><span class="preview-chip">DESIGN PREVIEW ONLY</span></article></div>
  </section>
 </main>
</div>
</div>
<div class="mobile-rail"><button type="button" data-mobile-route="home">Home</button><button type="button" data-mobile-route="chat">AI Chat</button><button type="button" data-mobile-route="research">Research</button><button type="button" data-mobile-route="operations">Ops</button></div>
<dialog id="search-dialog" aria-labelledby="search-title"><div class="search-modal"><div class="search-modal-head"><h2 id="search-title">Find a workspace</h2><button class="icon-button" id="close-search" type="button" aria-label="Close search">×</button></div><label for="search-input" class="sr-only">Search modules</label><input id="search-input" autocomplete="off" type="search" placeholder="Search chat, math, fleet, tools…" aria-label="Search modules"><div id="search-results" role="listbox"></div><p class="muted tiny">Use ↑ ↓ to choose, Enter to open, Esc to close.</p></div></dialog>
</body></html>`;
