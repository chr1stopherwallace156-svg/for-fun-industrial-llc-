// Standalone same-origin research page in Fun Industrial's existing 8802 UI.
export const MATH_HTML=String.raw`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Fun Industrial · Mathematical Research</title>
<script src="/api/fun/math/client.js" defer></script>
<style>
*{box-sizing:border-box}body{font:14px/1.55 system-ui;margin:0;background:#0b1420;color:#e6edf5}
header,main{max-width:1050px;margin:auto;padding:18px}header{display:flex;flex-wrap:wrap;gap:15px;align-items:center;justify-content:space-between;border-bottom:1px solid #364a5c}
a{color:#98e5d6}h1{font-size:25px;margin:12px 0}h2{font-size:17px}.small{color:#b7c8d5;font-size:12px}
.panel{padding:18px;border:1px solid #3d5c72;border-radius:13px;background:#142637;margin:16px 0}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
.metric{border:1px solid #385165;border-radius:9px;padding:13px;background:#0e1e2b}
.metric strong{display:block;font-size:19px}table{border-collapse:collapse;width:100%;overflow-wrap:anywhere}
th,td{padding:9px;text-align:left;border-bottom:1px solid #395067}
textarea{width:100%;min-height:90px;border:1px solid #617b8a;border-radius:8px;background:#0b1420;color:#eef7fa;padding:12px;font:14px system-ui}
button{padding:10px 14px;background:#9eead5;border:0;border-radius:8px;cursor:pointer;color:#122331;font-weight:700}
button:disabled{opacity:.55;cursor:default}
pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:480px;overflow:auto;background:#0a1824;padding:13px;border-radius:8px}
</style></head><body><header><strong>FUN INDUSTRIAL · RESEARCH LAB</strong>
<div><a href="/">Control Center</a> · <a href="/chat/">Qwen Chat</a> · <a href="/control/">Control Deck</a></div></header>
<main><h1>Mathematical Research V2</h1>
<p class="small">Read-only historical analysis. Daily background research uses its own scheduled Windows worker. No wagers or claims of predictive success.</p>
<section class="panel"><h2>Verified local research report</h2><p id="fi-math-status" role="status">Checking V2 report…</p>
<div id="fi-math-metrics" class="cols"></div>
<h2>Historical test by rules era</h2><div style="overflow:auto"><table><thead><tr><th>Era</th><th>Selected model</th><th>Historical test gain</th><th>Adjusted p</th></tr></thead><tbody id="fi-math-periods"><tr><td colspan="4">No report loaded</td></tr></tbody></table></div>
<p id="fi-math-future" class="small"></p><p class="small">Theoretical advantage is not established by historical fit. A frozen equation must prove itself on genuinely new draws.</p>
<button id="fi-math-refresh" type="button">Refresh report view</button></section>
<section class="panel"><h2>Ask local Qwen to analyze the evidence</h2>
<p class="small">Only this verified read-only report is supplied to the existing Qwen chat route. The model cannot change equations or run research.</p>
<label for="fi-math-question">Question for Qwen</label>
<textarea id="fi-math-question" maxlength="1200">Analyze the current V2 mathematical research findings. What held up, what failed, and what would count as convincing evidence of predictive information?</textarea>
<p><button id="fi-math-ask" type="button">Ask Qwen about these results</button></p>
<pre id="fi-math-answer" aria-live="polite">No Qwen request sent.</pre></section></main></body></html>`;
