// FIAL5.4 Executive Assistant console within primary Fun Industrial dashboard 8802.
// Read-only visualization of independently scheduled work. No privileged actions.
export const EXEC_CONSOLE_VERSION='fial5.4-executive-console-v1';
export const EXEC_CLIENT=new URL('./executive-console-client-v1.js',import.meta.url);
export const EXEC_PAGE=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fun Industrial · Executive Assistant</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0b1520;color:#e4f0fa;font:14px/1.5 system-ui}header{background:#142538;border-bottom:1px solid #344b61;padding:18px 26px}a{color:#a4eadf}main{max-width:1230px;margin:auto;padding:20px}h1{margin:0;font-size:23px}h2{font-size:17px;margin:0 0 8px}p{margin:8px 0}small,.muted{color:#adc0ce}.tag{border:1px solid #3b546c;border-radius:50px;font-size:12px;padding:3px 8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.panel,.item{border:1px solid #31485c;background:#17283a;border-radius:11px;padding:17px;margin:11px 0}.item{background:#0f2131;margin:7px 0}.item strong{display:block}.head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.chip{display:inline-block;border-radius:20px;border:1px solid #466378;padding:2px 8px;margin-right:6px;color:#cce5f4;font-size:12px}button{background:#95e3db;color:#052921;border:0;padding:9px 13px;border-radius:8px;font-weight:700;cursor:pointer}button:disabled{opacity:.5}select{background:#0e1f2d;color:#e4f0fa;border:1px solid #53687a;padding:9px;border-radius:7px}.warn{color:#ffdc9c}pre{white-space:pre-wrap;overflow-wrap:anywhere}.list{max-height:850px;overflow:auto}@media(max-width:650px){main{padding:12px}header{padding:14px}}</style></head>
<body><header><div class="head"><div><h1>Fun Industrial · Executive Assistant</h1><small>FIAL5.7 · Verified outcomes · Fun Industrial software · ELEKTRON operations</small></div>
<nav><a href="/?view=overview">Overview</a> · <a href="/unified/?view=chat">Qwen Chat</a> · <a href="/unified/?view=tools">Tools &amp; Review</a></nav></div></header>
<main><p>Work continues through Windows scheduling when the signed-in PC is online. This console reads saved evidence only; it does not send email, submit filings, spend, or operate tools.</p>
<div id="fi-exec-state" role="status" class="panel">Reading the local mission ledger…</div>
<div class="grid">
<section class="panel"><small>Active work items</small><h2 id="fi-exec-items">—</h2></section>
<section class="panel"><small>New or changed</small><h2 id="fi-exec-updates">—</h2></section>
<section class="panel"><small>Awaiting review</small><h2 id="fi-exec-review">—</h2></section>
<section class="panel"><small>Latest cycle (UTC)</small><h2 id="fi-exec-time">—</h2></section></div>
<section class="panel" id="fi-outcome-panel"><h2>Verified business outcomes · Actual receipts</h2>
<p>First result: City of Victorville license-status inquiry. Prepared automatically; a separate reviewed command is required to send. Gmail receipts, not checklist counts, determine measured progress.</p>
<div id="fi-outcome-status" role="status">Reading verified outcome ledger…</div></section>
<section class="panel"><h2>Actual business operations — evidence, not promises</h2><div id="fi-real-work" role="status">No verified FIAL5.5 cycle yet.</div></section>
<section class="panel" id="fi-competence">
<h2>Business Competence · Strategy, management, finance and professional writing</h2>
<p>18 curated business methods with deterministic evidence and decision rules. Qwen Chat also uses them as bounded reference context. No new resident model.</p>
<div id="fi-competence-state" role="status">Checking local competence cycles…</div>
<div id="fi-competence-list" class="list"></div>
<label for="fi-competence-question">Analyze a business question</label>
<textarea id="fi-competence-question" maxlength="1000" style="box-sizing:border-box;width:100%;min-height:85px;background:#101e2d;color:#e4f0fa;border:1px solid #53687a;border-radius:8px;padding:11px;font:inherit" placeholder="Example: What evidence and financial controls do we need before expanding our fleet conversion services?"></textarea>
<p><button id="fi-competence-analyze" type="button">Analyze locally</button></p>
<div id="fi-competence-output" role="status" aria-live="polite"></div>
<h3>Financial scenario calculator</h3>
<p>Enter your own numbers as JSON (e.g. unit_price, unit_variable_cost, monthly_fixed_cost, cash_available, monthly_net_burn). Missing values remain unknown; examples are not company actuals.</p>
<textarea id="fi-finance-input" maxlength="1600" spellcheck="false" style="box-sizing:border-box;width:100%;min-height:80px;background:#101e2d;color:#e4f0fa;border:1px solid #53687a;border-radius:8px;padding:11px;font:12px monospace" placeholder='{"unit_price":100,"unit_variable_cost":60,"monthly_fixed_cost":1200}'></textarea>
<p><button type="button" id="fi-finance-calculate">Calculate scenario</button></p>
<div id="fi-finance-result" role="status" aria-live="polite"></div>
<h3>Professional writing review</h3>
<p>Paste an email, proposal, memo or internal draft. The check is local and flags clarity or unsupported claims; it does not send anything.</p>
<textarea id="fi-writing-input" maxlength="4000" style="box-sizing:border-box;width:100%;min-height:85px;background:#101e2d;color:#e4f0fa;border:1px solid #53687a;border-radius:8px;padding:11px;font:inherit"></textarea>
<p><button type="button" id="fi-writing-check">Review writing</button></p>
<div id="fi-writing-result" role="status" aria-live="polite"></div>
<small>Methodology advice and heuristic writing checks are not verified eligibility, legal advice, certification, sent email or completed filing.</small>
</section>
<section class="panel"><h2>Connections and evidence</h2><div id="fi-exec-connections">No run data.</div></section>
<div class="head"><h2>Operations queue</h2><div><label for="fi-exec-filter">Workstream</label> <select id="fi-exec-filter"><option value="all">All</option></select> <button id="fi-exec-refresh" type="button">Refresh status</button></div></div>
<section id="fi-exec-queue" class="list" aria-live="polite"><p>No saved work items yet.</p></section>
<section class="panel"><h2>Submission and execution boundaries</h2><p class="warn">External actions are not implied by a drafted packet. Government filings, sending messages, payments, software changes, and REA tool calls require specific authorization and a verified destination.</p><small>Business profiles and work registers are stored in the local ExecutiveOperatorV1 directory. A missing official notice is shown as missing, never assumed complete.</small></section>
</main><script src="/api/operator/client.js" defer></script><script src="/api/operator/real/client.js" defer></script><script src="/api/operator/competence/client.js" defer></script><script src="/api/operator/outcomes/client.js" defer></script></body></html>`;
