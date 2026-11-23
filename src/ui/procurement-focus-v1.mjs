// Fun Industrial: focused read-only procurement view on existing 8802.
// Reuses reviewed FIAL5.10 procurement client/API. No independent discovery,
// source refresh, bids, submissions, emails, REA, model or credential actions.
export const PROCUREMENT_FOCUS_VERSION='fun-procurement-focus-v1';
export const PROCUREMENT_FOCUS_HTML=String.raw`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0b1420">
<title>Fun Industrial · Procurement</title>
<style>
:root{color-scheme:dark;--bg:#0b1420;--panel:#142638;--line:#30485a;--text:#ebf4f4;--muted:#b0c3cd;--accent:#9ce4d6}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.65 system-ui,-apple-system,'Segoe UI',sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
a:focus-visible{outline:3px solid #b8f9de;outline-offset:3px}
main{max-width:1190px;padding:clamp(19px,4vw,44px) 18px 80px;margin:0 auto}
header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:27px}
.brand{font-size:11px;letter-spacing:.14em;font-weight:850;color:#9ccfc6}
.overline{color:#8ad7c5;font-weight:800;letter-spacing:.13em;font-size:10px}
h1{font-size:clamp(30px,4vw,43px);letter-spacing:-.04em;margin:6px 0 8px;line-height:1.17}
h2{font-size:19px;line-height:1.3;letter-spacing:-.01em;margin:0 0 14px}
h3{font-size:15px;margin:7px 0}
.intro{color:#b4c9d2;margin:0;max-width:870px}
.link{border:1px solid #406a65;border-radius:9px;padding:9px 13px;color:#c6efe2;font-weight:700;font-size:12px;display:inline-block}
.nav{display:flex;gap:9px;flex-wrap:wrap;margin-top:19px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:clamp(17px,3vw,25px);margin:17px 0}
.panel p{margin:9px 0;color:#d0e1e6}.panel strong{color:#e6f6f3}
.item{border:1px solid #446078;background:#101f2f;border-radius:9px;margin:11px 0;padding:17px}
.item a{display:inline-block;margin:9px 12px 0 0;overflow-wrap:anywhere}
.notice{background:#192f39;border-left:3px solid #a1e5d6;border-radius:5px;margin:21px 0;padding:14px 17px;color:#bfdbdf}
small{display:block;font-size:11px;color:#97b3c0;line-height:1.8}
#fi-procurement-status,#fi-procurement-notices,#fi-procurement-sources{overflow-wrap:anywhere}
#fi-procurement-status p{border-bottom:1px solid #263f50;padding-bottom:9px}
#fi-procurement-sources p{border-left:2px solid #466878;padding:7px 12px;background:#102235;font-size:12px}
@media(max-width:560px){.panel{padding:15px}main{padding:20px 13px 55px}.link{max-width:100%}}
</style>
<script src="/api/operator/procurement/client.js" defer></script>
</head><body><main>
<header><div class="brand">FI · FUN INDUSTRIAL</div><a class="link" href="/ui-preview/#operations?area=procurement">Back to Operations</a></header>
<section aria-labelledby="proc-heading"><div class="overline">BUSINESS OPERATIONS / SOURCE-LINKED RESEARCH</div>
<h1 id="proc-heading">Procurement</h1>
<p class="intro">A dedicated view of the procurement evidence already verified or held for review by Fun Industrial. No duplicate dashboard, no unverified bid-ready claims.</p>
<nav class="nav" aria-label="Related research"><a class="link" href="/operations/?embedded=1#fi-bid-readiness">Bid Readiness</a><a class="link" href="/operations/?embedded=1#fi-commercial-fit">Commercial Fit</a><a class="link" href="/operations/?embedded=1#fi-purchase-demand">Buyer Demand</a><a class="link" href="/roofing/bulk/">Property Intelligence</a></nav></section>
<div class="notice">This is a read-only snapshot, not an exhaustive live statewide bid search. Historical notices may have expired; qualification, eligibility and current bidding status require independent official verification.</div>
<section class="panel" id="fi-procurement" aria-labelledby="evidence-heading">
<h2 id="evidence-heading">Published procurement evidence</h2>
<div id="fi-procurement-status" role="status" aria-live="polite">Checking saved procurement evidence…</div>
<h2>Official notice details</h2><div id="fi-procurement-notices"><p>Loading source-linked notices…</p></div>
<h2>Source verification &amp; review holds</h2><div id="fi-procurement-sources"><p>Reviewing source status…</p></div>
</section>
<small>Read-only. No bids submitted, vendor registrations, emails, payment, REA tool actions, or AI model execution are authorized by opening this page.</small>
</main></body></html>`;
