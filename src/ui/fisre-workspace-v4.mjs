// Integrated, same-origin, lazily loaded FISRE workspace; current homepage unchanged.
export const FISRE_WORKSPACE_HTML=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>Fun Industrial — Semantic Reasoning</title>
<style>
:root{color-scheme:dark;font:14px/1.5 system-ui,sans-serif;background:#0b1420;color:#e1eaf2}
*{box-sizing:border-box}body{margin:0;padding:24px;max-width:1150px}
header{margin-bottom:18px}h1{margin:6px 0 8px;font-size:26px;letter-spacing:-.03em}
h2{margin:0 0 12px;font-size:16px}p{color:#a7bbcc;margin:3px 0}
small{color:#95a9bc}label{display:block;font-size:12px;font-weight:650;color:#c8d6e3;margin:14px 0 7px}
textarea,input{display:block;width:100%;background:#101d2e;color:#e5edf5;border:1px solid #3d5770;border-radius:10px;padding:11px;font:13px/1.55 ui-monospace,Consolas,monospace}
textarea:focus-visible,input:focus-visible,button:focus-visible{outline:2px solid #77c4ed;outline-offset:2px}
textarea{min-height:210px;resize:vertical}#fi-range{min-height:86px}
.columns{display:grid;grid-template-columns:1.45fr 1fr;gap:18px}
.panel{border:1px solid #31495e;border-radius:15px;background:#132237;padding:19px;margin:0 0 17px}
.tag{font-size:11px;color:#86d8db;letter-spacing:.14em;font-weight:700}
button{background:#79bce0;color:#082031;border:0;border-radius:9px;padding:12px 18px;font-weight:750;cursor:pointer;margin-top:16px}
button:disabled{opacity:.6;cursor:wait}
pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#d3e1ee;font:12px/1.55 ui-monospace,Consolas,monospace;margin:0}
code{color:#b6f2dd}#fi-result[hidden]{display:none}
.status{padding:8px 11px;border-radius:9px;border:1px solid #45637a;display:inline-block;font-size:12px;font-weight:700;margin:3px 0 12px}
.notice{background:#101d2e;border-left:3px solid #6ea9c7;padding:10px 12px;color:#b4cddd;border-radius:4px;margin-top:15px}
#fi-message{min-height:25px;margin-top:10px}#fi-message[data-error=true]{color:#ffb5b5}
@media(max-width:760px){.columns{grid-template-columns:1fr}body{padding:13px}.panel{padding:14px}h1{font-size:22px}}
</style><script src="/api/fisre/client.js" defer></script></head><body>
<header><span class="tag">FUN INDUSTRIAL / INTELLIGENCE</span>
<h1>Semantic Reasoning</h1>
<p>Inspect functions, trace dependencies, evaluate bounded mathematical domains, and build evidence-backed cognitive proposals.</p>
</header>
<div class="columns"><section class="panel" aria-label="Source analysis">
<h2>Source &amp; constraints</h2>
<form id="fi-form" autocomplete="off">
<label for="fi-source">Python code · analyzed as text, never executed</label>
<textarea id="fi-source" spellcheck="false" maxlength="16000" required>def calculate_price(cost, margin):
    return cost / (1 - margin)</textarea>
<label for="fi-function">Function to examine</label>
<input id="fi-function" maxlength="64" value="calculate_price" required>
<label for="fi-range">Rational input ranges · one per line</label>
<textarea id="fi-range" spellcheck="false" required>cost=0:1000
margin=0:0.5</textarea>
<button type="submit" id="fi-run">Analyze source &amp; verify</button>
<p id="fi-message" role="status" aria-live="polite"></p>
</form></section>
<section class="panel" aria-label="Analysis result">
<h2>Reasoning result</h2>
<div id="fi-result" hidden>
<div class="status" id="fi-verdict"></div>
<pre id="fi-details"></pre>
</div>
<p id="fi-empty">Submit a code sample and bounded input ranges to inspect its structure, run the restricted mathematical analyzer, and replay the result against the same source text.</p>
<div class="notice"><strong>Evidence rules</strong>
<p>Source remains in memory. Mathematical proofs cover the supported exact-rational subset, not general Python runtime behavior. Cognitive findings remain proposals, not verified facts. Tool execution authority is unchanged.</p></div>
</section></div>
</body></html>`;
