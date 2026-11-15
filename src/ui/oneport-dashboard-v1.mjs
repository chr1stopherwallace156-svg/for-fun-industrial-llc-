// One user-facing port and one coherent application surface.
// Existing reviewed local services remain independent backend workers.
export const DASHBOARD_VERSION='fun-industrial-one-port-spatial-ux-v2';
export const DASHBOARD_HTML=String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0b1019">
<title>Fun Industrial — Local Workspace</title>
<link rel="stylesheet" href="/api/oneport/style.css">
<script src="/api/oneport/vendor/vanilla-tilt.js" defer></script>
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
      <div class="fi-top-right"><button type="button" id="fi-command-open" class="fi-command-open" aria-haspopup="dialog" aria-controls="fi-command-dialog" title="Find a workspace (Ctrl+K)">⌕ <span>Search</span> <kbd>Ctrl K</kbd></button><span class="fi-local-pill"><span class="fi-dot"></span> LOCALHOST <strong>8802</strong></span>
       <span class="fi-verification" id="fi-top-health">Checking services</span></div>
    </header>
    <main class="fi-content" id="fi-main">
      <section id="fi-overview" class="fi-overview" aria-label="System overview">
        <div class="fi-hero">
          <div class="fi-hero-copy"><div class="fi-overline"><span class="fi-mini-dot"></span> YOUR LOCAL CONTROL CENTER <span class="fi-hero-version">V2 · SPATIAL</span></div>
            <h1>Build. Operate.<span class="fi-gradient-word">See the whole picture.</span></h1>
            <p>One connected local workspace for AI, business intelligence, tools and everything you build. Interact with a system designed to stay on your PC.</p>
            <div class="fi-hero-actions"><a href="#chat" data-section="chat" class="fi-button fi-button-primary">Open local AI <span aria-hidden="true">↗</span></a>
              <a href="#operations" data-section="operations" class="fi-button fi-button-quiet">View operations</a></div>
          </div>
          <div class="fi-hero-graphic" aria-hidden="true">
          <div class="fi-spatial-stage" id="fi-spatial-stage">
            <div class="fi-spatial-backdrop"></div>
            <div class="fi-spatial-orbit fi-spatial-orbit-one"></div>
            <div class="fi-spatial-orbit fi-spatial-orbit-two"></div>
            <div class="fi-spatial-orbit fi-spatial-orbit-three"></div>
            <div class="fi-spatial-device">
              <div class="fi-spatial-device-top"><span class="fi-spatial-led"></span> FUN INDUSTRIAL <em>LOCAL · 01</em></div>
              <div class="fi-spatial-core"><span>FI</span></div>
              <div class="fi-spatial-device-bottom"><i></i><i></i><i></i><span>ONE CONNECTED SYSTEM</span></div>
            </div>
            <div class="fi-spatial-chip fi-spatial-chip-ai"><span>✦</span><b>AI</b></div>
            <div class="fi-spatial-chip fi-spatial-chip-ops"><span>▤</span><b>OPS</b></div>
            <div class="fi-spatial-chip fi-spatial-chip-ml"><span>⌘</span><b>ML</b></div>
            <div class="fi-spatial-chip fi-spatial-chip-data"><span>◈</span><b>DATA</b></div>
          </div>
        </div>
        </div>
        <div class="fi-heading-line"><div><div class="fi-overline">CURRENT STATE</div><h2>System overview</h2>
          <p id="fi-last-check" class="fi-muted">Read-only health checks are loading.</p></div>
          <button type="button" class="fi-button fi-button-small" id="fi-health-refresh">Refresh status</button></div>
        <div class="fi-metrics">
          <article class="fi-metric" data-spatial-card="true"><div class="fi-metric-top"><span>Local AI</span><span class="fi-symbol">✦</span></div><strong id="fi-ai-state">Checking</strong><small id="fi-ai-note">Qwen conversation</small></article>
          <article class="fi-metric" data-spatial-card="true"><div class="fi-metric-top"><span>Tool catalog</span><span class="fi-symbol">⬡</span></div><strong id="fi-tools-state">Checking</strong><small>Approvals required to execute</small></article>
          <article class="fi-metric" data-spatial-card="true"><div class="fi-metric-top"><span>Machine learning</span><span class="fi-symbol">⌘</span></div><strong id="fi-ml-state">Checking</strong><small>Run only when authorized</small></article>
          <article class="fi-metric" data-spatial-card="true"><div class="fi-metric-top"><span>Fleet demand</span><span class="fi-symbol">▧</span></div><strong id="fi-demand-state">Checking</strong><small>Verified orders only</small></article>
        </div>
        <div class="fi-heading-line"><div><div class="fi-overline">QUICK ACCESS</div><h2>Workspaces</h2>
          <p class="fi-muted">All functions stay inside this dashboard.</p></div></div>
        <div class="fi-tiles">
          <a href="#chat" data-section="chat" class="fi-tile" data-spatial-card="true"><span class="fi-tile-symbol">✦</span><strong>Ask Qwen</strong><span>Conversation and contextual memory</span><b>Open ↗</b></a>
          <a href="#tools" data-section="tools" class="fi-tile" data-spatial-card="true"><span class="fi-tile-symbol">⬡</span><strong>Inspect tools</strong><span>REA catalog and reviewed execution</span><b>Open ↗</b></a>
          <a href="#operations" data-section="operations" class="fi-tile" data-spatial-card="true"><span class="fi-tile-symbol">▤</span><strong>Operations center</strong><span>Business queue and verified outcomes</span><b>Open ↗</b></a>
          <a href="#procurement" data-section="procurement" class="fi-tile" data-spatial-card="true"><span class="fi-tile-symbol">◈</span><strong>Fleet procurement</strong><span>Official source-linked buyer demand</span><b>Open ↗</b></a>
          <a href="#commerce" data-section="commerce" class="fi-tile" data-spatial-card="true"><span class="fi-tile-symbol">▥</span><strong>Commerce</strong><span>Trends and saved catalog research</span><b>Open ↗</b></a>
          <a href="#ml" data-section="ml" class="fi-tile" data-spatial-card="true"><span class="fi-tile-symbol">⌘</span><strong>Machine learning</strong><span>Bounded data and model analysis</span><b>Open ↗</b></a>
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
<dialog id="fi-command-dialog" class="fi-command-dialog" aria-labelledby="fi-command-title">
 <div class="fi-command-head"><div><strong id="fi-command-title">Find a workspace</strong><p>Search connected modules. Press Esc to close.</p></div><button type="button" class="fi-command-close" id="fi-command-close" aria-label="Close search">×</button></div>
 <label class="fi-command-search"><span aria-hidden="true">⌕</span><input id="fi-command-input" type="search" placeholder="Search chat, tools, procurement…" autocomplete="off" spellcheck="false" aria-label="Search workspace modules"></label>
 <div id="fi-command-results" class="fi-command-results" role="listbox" aria-label="Matching modules"></div>
 <div class="fi-command-bottom">LOCAL-ONLY NAVIGATION <span>↵ Open · Esc Close</span></div>
</dialog>
</body></html>`;
