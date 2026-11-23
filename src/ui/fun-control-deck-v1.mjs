// FUN_CONTROL_DECK_V1
// Optional visual workspace on the EXISTING 8802 host. Homepage unchanged.
// No discovery, pairing, remote control, model invocation or device access.
// Status probes are read-only, fixed loopback targets, operator initiated.
import {readFile} from 'node:fs/promises';

export const CONTROL_DECK_VERSION='fun-control-deck-v1';
export const CONTROL_DECK_CSS=new URL('./fun-control-deck-v1.css',import.meta.url);
export const CONTROL_DECK_CLIENT=new URL('./fun-control-deck-v1.js',import.meta.url);
const QWEN_HEALTH='http://127.0.0.1:8088/health';
const REA_HEALTH='http://127.0.0.1:8797/api/rea229/status';
const limitedHostnames=Object.freeze([QWEN_HEALTH,REA_HEALTH]);

async function readStatus(url,{fetchImpl=fetch}={}){
 if(!limitedHostnames.includes(url))throw Error('FUN_CONTROL_DECK_UNAPPROVED_ENDPOINT');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),1800);
 try{
  const r=await fetchImpl(url,{method:'GET',redirect:'error',signal:controller.signal,
    headers:{accept:'application/json'}});
  if(!r.ok||!String(r.headers.get('content-type')||'').includes('json'))return null;
  const bytes=Number(r.headers.get('content-length'));
  if(bytes>24000)return null;
  let total=0;const chunks=[];
  for await(const c of r.body){total+=c.length;if(total>24000)return null;chunks.push(c)}
  const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
 }catch{return null}finally{clearTimeout(timer)}
}
export async function readControlDeckStatus({ml,read=readStatus}={}){
 if(!ml||typeof ml.status!=='function')throw Error('FUN_CONTROL_DECK_ML_REQUIRED');
 // No other external requests; fixed localhost GETs, no retries, no polling.
 const [qwen,rea,model]=await Promise.allSettled([
   read(QWEN_HEALTH),read(REA_HEALTH),ml.status()
 ]);
 const q=qwen.status==='fulfilled'?qwen.value:null;
 const r=rea.status==='fulfilled'?rea.value:null;
 const m=model.status==='fulfilled'?model.value:null;
 const qwenReady=q?.status==='ok';
 const reaReady=r?.liveMcpHealth==='ready'&&r?.realReaToolCount===229;
 const mlReady=m?.state==='ready'&&m?.bridge==='fun-ml-dashboard-v3';
 return {
  version:CONTROL_DECK_VERSION,
  state:'read_only_observation',
  observedAt:new Date().toISOString(),
  localDashboard:{state:'ready',port:8802},
  qwen:{state:qwenReady?'ready':'unavailable_or_unverified',port:8088},
  scikit:{state:mlReady?'ready':'unavailable_or_unverified',port:8801},
  rea:{state:reaReady?'ready':'unavailable_or_unverified',port:8797},
  // These are device profiles, NOT an assertion that they are on the LAN.
  devices:[
   {id:'ps5',name:'PlayStation 5',state:'not_paired',controlEnabled:false,videoEnabled:false},
   {id:'roku',name:'Roku',state:'not_paired',controlEnabled:false,videoEnabled:false},
   {id:'macbook',name:'MacBook',state:'not_paired',controlEnabled:false,videoEnabled:false},
   {id:'ipad',name:'iPad',state:'not_paired',controlEnabled:false,videoEnabled:false}
  ],
  automaticDiscovery:false,
  deviceControlEnabled:false,
  externalActions:0,
  devicesQueried:0,
  otherServicesRestarted:false
 };
}

export const CONTROL_DECK_HTML=String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Fun Industrial · Control Deck</title>
<link rel="stylesheet" href="/api/fun/control/style.css">
<script src="/api/fun/control/client.js" defer></script>
</head>
<body>
<div class="ambient a1"></div><div class="ambient a2"></div>
<div class="shell">
 <aside class="rail" aria-label="Workspace navigation">
  <a class="brand" href="/"><span class="brand-mark">FI<span class="brand-pulse"></span></span><span><strong>FUN INDUSTRIAL</strong><small>LOCAL SYSTEM / V1</small></span></a>
  <div class="rail-label">WORKSPACE</div>
  <nav class="rail-links">
   <a class="active" href="/control/" aria-current="page"><span aria-hidden="true">◫</span> Control Deck</a>
   <a href="/#chat"><span aria-hidden="true">✧</span> Main Dashboard</a>
   <a href="/chat/"><span aria-hidden="true">◈</span> Qwen AI Chat</a>
   <a href="/chat/#fi-fial53-compute-panel"><span aria-hidden="true">◇</span> ML &amp; Optimization</a>
   <a href="/fisre/"><span aria-hidden="true">⌘</span> Source Reasoning</a>
   <a href="/operations/"><span aria-hidden="true">▦</span> Operations</a>
  </nav>
  <div class="rail-base"><span class="pulse-dot"></span> BOUND TO THIS PC
    <p>Local services only. Device commands stay locked until reviewed pairing is implemented.</p>
  </div>
 </aside>
 <main class="main">
  <header class="topbar">
   <div class="eyebrow">OPERATOR WORKSPACE <span class="topbar-sep">/</span> CONTROL DECK</div>
   <a href="/chat/" class="topbar-link">Open Qwen Chat <span aria-hidden="true">↗</span></a>
  </header>
  <section class="intro">
   <div>
    <div class="kicker"><span class="kicker-line"></span> ONE LOCAL CONTROL CENTER</div>
    <h1>Command your<br><em>connected world.</em></h1>
    <p class="lead">A visual workspace for your AI, tools, and future device connections. Work from one place without giving Qwen uncontrolled access.</p>
    <div class="hero-actions"><a class="primary-btn" href="/chat/">Talk to Qwen <span>→</span></a>
    <a class="secondary-btn" href="#devices">Explore devices <span>↓</span></a></div>
   </div>
   <div class="hero-art" aria-hidden="true">
    <div class="orb orb-one"></div><div class="orb orb-two"></div>
    <div class="hub-orbit orbit-a"></div><div class="hub-orbit orbit-b"></div>
    <div class="hub-center"><span class="hub-initials">FI</span><span>CORE ONLINE</span></div>
    <div class="orbit-node node-a">AI</div><div class="orbit-node node-b">ML</div><div class="orbit-node node-c">REA</div><div class="orbit-node node-d">UI</div>
   </div>
  </section>
  <section class="section" id="health" aria-labelledby="health-h">
   <div class="section-head">
    <div><div class="section-eyebrow">01 / INFRASTRUCTURE</div><h2 id="health-h">Live systems</h2><p>Checks real local service endpoints. No automatic restarts.</p></div>
    <button type="button" class="outline-button" id="refresh">↻ &nbsp; Check services</button>
   </div>
   <p class="status-line" id="checked" role="status" aria-live="polite">Select “Check services” to read live status.</p>
   <div class="status-grid">
    <article class="status-card"><div class="status-row"><span class="status-icon">◈</span><span class="status-tag" id="qwen-state">Not checked</span></div><h3>Qwen / llama.cpp</h3><p>Local reasoning engine</p><div class="status-foot"><span>PORT 8088</span><span class="light" id="qwen-light"></span></div></article>
    <article class="status-card"><div class="status-row"><span class="status-icon">◇</span><span class="status-tag" id="ml-state">Not checked</span></div><h3>Machine learning</h3><p>Scikit-learn bridge</p><div class="status-foot"><span>PORT 8801</span><span class="light" id="ml-light"></span></div></article>
    <article class="status-card"><div class="status-row"><span class="status-icon">▧</span><span class="status-tag" id="rea-state">Not checked</span></div><h3>REA tools</h3><p>Reviewed MCP connection</p><div class="status-foot"><span>PORT 8797</span><span class="light" id="rea-light"></span></div></article>
    <article class="status-card"><div class="status-row"><span class="status-icon">⌘</span><span class="status-tag good">Live</span></div><h3>Control dashboard</h3><p>Fun Industrial / local only</p><div class="status-foot"><span>PORT 8802</span><span class="light good"></span></div></article>
   </div>
  </section>
  <section class="section" id="devices" aria-labelledby="devices-h">
   <div class="section-head">
    <div><div class="section-eyebrow">02 / DEVICE LAB</div><h2 id="devices-h">Your device workspace</h2><p>Organize and prepare connections. Actual power, navigation, and screen streaming require a verified device adapter.</p></div>
    <span class="tag-muted">4 DEVICE PROFILES</span>
   </div>
   <div class="device-grid">
    <button class="device-card" type="button" data-device="ps5"><span class="device-sigil ps5">P<span>S</span></span><span class="device-copy"><strong id="name-ps5">PlayStation 5</strong><small>Remote Play · rest-mode wake</small></span><span class="device-meta">NOT PAIRED <span>↗</span></span></button>
    <button class="device-card" type="button" data-device="roku"><span class="device-sigil roku">R</span><span class="device-copy"><strong id="name-roku">Roku</strong><small>Network remote · TV controls</small></span><span class="device-meta">NOT PAIRED <span>↗</span></span></button>
    <button class="device-card" type="button" data-device="macbook"><span class="device-sigil mac">⌘</span><span class="device-copy"><strong id="name-macbook">MacBook</strong><small>Authenticated screen sharing</small></span><span class="device-meta">NOT PAIRED <span>↗</span></span></button>
    <button class="device-card" type="button" data-device="ipad"><span class="device-sigil ipad">▯</span><span class="device-copy"><strong id="name-ipad">iPad</strong><small>Screen mirroring · limited controls</small></span><span class="device-meta">NOT PAIRED <span>↗</span></span></button>
   </div>
   <div class="device-inspector" id="inspector" hidden>
    <div class="inspector-header"><div><span class="section-eyebrow">DEVICE SETUP / LOCAL PROFILE</span><h3 id="device-title">Device</h3></div><button type="button" class="close" id="close" aria-label="Close device details">✕</button></div>
    <div class="inspector-layout">
     <div class="inspect-left">
      <label for="device-alias">Display name</label>
      <input id="device-alias" maxlength="56" autocomplete="off" placeholder="Optional device nickname">
      <p class="fineprint">Saved in this browser only, not on another device. No credentials or IP addresses needed.</p>
      <div class="inspect-actions"><button type="button" class="primary-btn" id="save-alias">Save nickname</button><button type="button" class="outline-button" id="clear-alias">Reset</button></div>
      <p class="small-state" id="save-status" aria-live="polite"></p>
     </div>
     <div class="inspect-right">
      <h4>Connection readiness</h4>
      <div class="readiness"><span>Network discovery</span><strong>Not enabled</strong></div>
      <div class="readiness"><span>Authorized pairing</span><strong>Not connected</strong></div>
      <div class="readiness"><span>Power / navigation</span><strong>Locked</strong></div>
      <div class="readiness"><span>Live screen</span><strong>Not streaming</strong></div>
     </div>
    </div>
    <div class="next-steps"><h4 id="next-title">Next steps</h4><p id="next-text"></p><button type="button" class="outline-button" id="copy-steps">Copy setup steps</button></div>
   </div>
  </section>
  <section class="section" aria-labelledby="quick-h">
   <div class="section-head"><div><div class="section-eyebrow">03 / LIVE WORKSPACES</div><h2 id="quick-h">Go straight to work</h2><p>Real pages already connected to the current Fun Industrial system.</p></div></div>
   <div class="quick-grid">
    <a class="quick-card" href="/chat/"><span class="quick-icon">✦</span><strong>AI workspace</strong><span>Ask your local Qwen system</span><b>↗</b></a>
    <a class="quick-card" href="/chat/#fi-fial53-compute-panel"><span class="quick-icon">◇</span><strong>Optimize &amp; learn</strong><span>Optuna, OR-Tools, scikit-learn</span><b>↗</b></a>
    <a class="quick-card" href="/fisre/"><span class="quick-icon">⌘</span><strong>Source reasoning</strong><span>Inspect code with FISRE</span><b>↗</b></a>
    <a class="quick-card" href="/operations/"><span class="quick-icon">▣</span><strong>Business operator</strong><span>Verified evidence and planning</span><b>↗</b></a>
   </div>
  </section>
  <footer>FUN INDUSTRIAL <span>•</span> LOCAL-FIRST VISUAL CONTROL DECK <span>•</span> OPERATOR AUTHORIZATION PRESERVED</footer>
 </main>
</div>
</body></html>`;

export function controlDeckAssets(){
 return Object.freeze({css:CONTROL_DECK_CSS,client:CONTROL_DECK_CLIENT});
}
