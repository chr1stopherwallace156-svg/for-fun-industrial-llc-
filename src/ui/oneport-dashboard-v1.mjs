// One user-facing port and one coherent application surface.
// Existing reviewed local services remain independent backend workers.
export const DASHBOARD_VERSION='fun-industrial-one-port-dashboard-v1';
export const DASHBOARD_HTML=String.raw\`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0b1019">
<title>Fun Industrial — Local Workspace</title>
<link rel="stylesheet" href="/api/oneport/style.css">
<script src="/api/oneport/client.js" defer></script>
</head><body>
<div class="fi-app" id="fi-app">
  <aside class="fi-sidebar" id="fi-sidebar" aria-label="Workspace navigation">
    <div class="fi-brand"><span class="fi-brandmark" aria-hidden="true">F<span>·</span>I</span>
      <div><strong>FUN INDUSTRIAL</strong><small>Local operations workspace</small></div></div>
    <div class="fi-nav-eyebrow">WORKSPACE</div>
    <nav class="fi-nav" aria-label="Main sections">
      <a href="#overview" data-section="overview"><span class="fi-icon" aria-hidden="true">◫</span><span>Overview</span></a>
      <a href="#chat" data-section="chat"><span class="fi-icon" aria-hidden="true">✦</span><span>Local AI Chat</span></a>
      <a href="#tools" data-section="tools"><span class="fi-icon" aria-hidden="true">⬡</span><span>Tools &amp; REA review</span></a>
      <a href="#operations" data-section="operations"><span class="fi-icon" aria-hidden="true">▤</span><span>Operations</span></a>
    </nav>
    <div class="fi-nav-eyebrow fi-nav-space">BUSINESS INTELLIGENCE</div>
    <nav class="fi-nav" aria-label="Business modules">
      <a href="#buyers" data-section="buyers"><span class="fi-icon" aria-hidden="true">⌁</span><span>Fleet Buyers</span></a>
      <a href="#procurement" data-section="procurement"><span class="fi-icon" aria-hidden="true">◈</span><span>Procurement</span></a>
      <a href="#commercial" data-section="commercial"><span class="fi-icon" aria-hidden="true">▧</span><span>Commercial Fit</span></a>
      <a href="#regulatory" data-section="regulatory"><span class="fi-icon" aria-hidden="true">◇</span><span>Regulatory &amp; Evidence</span></a>
      <a href="#commerce" data-section="commerce"><span class="fi-icon" aria-hidden="true">▥</span><span>Commerce</span></a>
    </nav>
    <div class="fi-nav-eyebrow fi-nav-space">CAPABILITIES</div>
    <nav class="fi-nav" aria-label="System capabilities">
      <a href="#ml" data-section="ml"><span class="fi-icon" aria-hidden="true">⌘</span><span>Machine Learning</span></a>
      <a href="#workspace" data-section="workspace"><span class="fi-icon" aria-hidden="true">▦</span><span>Original Workspace</span></a>
    </nav>
    <div class="fi-sidebar-bottom">
      <div class="fi-on-device"><span class="fi-dot"></span> Private, on-device access</div>
      <p>One dashboard address. Operator approval stays required for external actions.</p>
    </div>
  </aside>
  <div class="fi-app-main">
    <header class="fi-topbar">
      <div class="fi-top-left"><button class="fi-menu" id="fi-menu" aria-label="Open navigation" aria-expanded="false" aria-controls="fi-sidebar">☰</button>
        <div class="fi-crumb">FUN INDUSTRIAL <span>/</span> <strong id="fi-crumb-current">Overview</strong></div></div>
      <div class="fi-top-right"><span class="fi-local-pill"><span class="fi-dot"></span> LOCALHOST <strong>8802</strong></span>
       <span class="fi-verification" id="fi-top-health">Checking services</span></div>
    </header>
    <main class="fi-content" id="fi-main">
      <section id="fi-overview" class="fi-overview" aria-label="System overview">
        <div class="fi-hero">
          <div class="fi-hero-copy"><div class="fi-overline"><span class="fi-mini-dot"></span> LOCAL COMMAND CENTER</div>
            <h1>Everything in one workspace.</h1>
            <p>Operate local AI, tools, fleet research and business intelligence from one address. Services remain separate behind the dashboard; approvals stay in your hands.</p>
            <div class="fi-hero-actions"><a href="#chat" data-section="chat" class="fi-button fi-button-primary">Open local AI <span aria-hidden="true">↗</span></a>
              <a href="#operations" data-section="operations" class="fi-button fi-button-quiet">View operations</a></div>
          </div>
          <div class="fi-hero-graphic" aria-hidden="true"><div class="fi-orbit fi-orbit-outer"></div><div class="fi-orbit fi-orbit-mid"></div><div class="fi-orbit fi-orbit-inner"></div>
            <div class="fi-orbit-core">FI</div><div class="fi-orbit-label fi-orbit-label-a">AI</div>
            <div class="fi-orbit-label fi-orbit-label-b">OPS</div><div class="fi-orbit-label fi-orbit-label-c">ML</div></div>
        </div>
        <div class="fi-heading-line"><div><div class="fi-overline">CURRENT STATE</div><h2>System overview</h2>
          <p id="fi-last-check" class="fi-muted">Read-only health checks are loading.</p></div>
          <button type="button" class="fi-button fi-button-small" id="fi-health-refresh">Refresh status</button></div>
        <div class="fi-metrics">
          <article class="fi-metric"><div class="fi-metric-top"><span>Local AI</span><span class="fi-symbol">✦</span></div><strong id="fi-ai-state">Checking</strong><small id="fi-ai-note">Qwen conversation</small></article>
          <article class="fi-metric"><div class="fi-metric-top"><span>Tool catalog</span><span class="fi-symbol">⬡</span></div><strong id="fi-tools-state">Checking</strong><small>Approvals required to execute</small></article>
          <article class="fi-metric"><div class="fi-metric-top"><span>Machine learning</span><span class="fi-symbol">⌘</span></div><strong id="fi-ml-state">Checking</strong><small>Run only when authorized</small></article>
          <article class="fi-metric"><div class="fi-metric-top"><span>Fleet demand</span><span class="fi-symbol">▧</span></div><strong id="fi-demand-state">Checking</strong><small>Verified orders only</small></article>
        </div>
        <div class="fi-heading-line"><div><div class="fi-overline">QUICK ACCESS</div><h2>Workspaces</h2>
          <p class="fi-muted">All functions stay inside this dashboard.</p></div></div>
        <div class="fi-tiles">
          <a href="#chat" data-section="chat" class="fi-tile"><span class="fi-tile-symbol">✦</span><strong>Ask Qwen</strong><span>Conversation and contextual memory</span><b>Open ↗</b></a>
          <a href="#tools" data-section="tools" class="fi-tile"><span class="fi-tile-symbol">⬡</span><strong>Inspect tools</strong><span>REA catalog and reviewed execution</span><b>Open ↗</b></a>
          <a href="#operations" data-section="operations" class="fi-tile"><span class="fi-tile-symbol">▤</span><strong>Operations center</strong><span>Business queue and verified outcomes</span><b>Open ↗</b></a>
          <a href="#procurement" data-section="procurement" class="fi-tile"><span class="fi-tile-symbol">◈</span><strong>Fleet procurement</strong><span>Official source-linked buyer demand</span><b>Open ↗</b></a>
          <a href="#commerce" data-section="commerce" class="fi-tile"><span class="fi-tile-symbol">▥</span><strong>Commerce</strong><span>Trends and saved catalog research</span><b>Open ↗</b></a>
          <a href="#ml" data-section="ml" class="fi-tile"><span class="fi-tile-symbol">⌘</span><strong>Machine learning</strong><span>Bounded data and model analysis</span><b>Open ↗</b></a>
        </div>
        <p class="fi-evidence">Research is not a purchase order, approval, revenue, or an authorized external action. This dashboard only reads status until you choose a supported action.</p>
      </section>
      <section class="fi-module" id="fi-module" aria-label="Selected workspace" hidden>
        <div class="fi-module-title"><div><div class="fi-overline" id="fi-module-eyebrow">WORKSPACE</div><h1 id="fi-module-name">Local AI</h1>
          <p id="fi-module-description">Loading module.</p></div>
          <a href="#overview" class="fi-button fi-button-small" data-section="overview">All workspaces</a></div>
        <div class="fi-module-frame-area" id="fi-module-container" aria-live="off"></div>
      </section>
    </main>
  </div>
</div>
<div class="fi-shade" id="fi-shade" hidden></div>
</body></html>\`;
