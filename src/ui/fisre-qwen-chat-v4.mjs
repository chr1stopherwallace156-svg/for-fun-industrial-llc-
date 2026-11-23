// Direct on-device Qwen chat, plus optional FISRE source reasoning.
// Uses the existing 8802 grounded Qwen handler, not the unavailable 8798 proxy.
import {GROUNDED_PANEL} from '../fial/primary-grounded-ui-v5-3.mjs';
const extra='<details id="fi-fial53-code-panel" style="margin:12px 0;padding:13px;border:1px solid #3d5770;border-radius:12px;background:#0d1b29">'+
 '<summary style="cursor:pointer;font-weight:700">Code understanding &amp; mathematical reasoning (optional)</summary>'+
 '<p style="color:#a8bac9">Attach reviewed Python code here. One Send invokes read-only FISRE analysis, then asks the SAME local Qwen to interpret the evidence. Code is never executed or stored by FISRE.</p>'+
 '<label for="fi-fial53-code">Python source (analyzed as text)</label>'+
 '<textarea id="fi-fial53-code" maxlength="16000" spellcheck="false" style="display:block;width:100%;min-height:145px;background:#0c1825;color:#e6edf5;border:1px solid #537187;border-radius:8px;padding:9px;font:12px/1.5 Consolas,monospace" placeholder="def calculate_price(cost, margin):&#10;    return cost / (1 - margin)"></textarea>'+
 '<label for="fi-fial53-function">Function to analyze</label>'+
 '<input id="fi-fial53-function" value="calculate_price" maxlength="64" style="width:100%;background:#0c1825;color:#e6edf5;border:1px solid #537187;border-radius:8px;padding:9px">'+
 '<label for="fi-fial53-ranges">Input domains, one per line</label>'+
 '<textarea id="fi-fial53-ranges" spellcheck="false" style="display:block;width:100%;min-height:65px;background:#0c1825;color:#e6edf5;border:1px solid #537187;border-radius:8px;padding:9px;font:12px Consolas,monospace" placeholder="cost=0:1000&#10;margin=0:0.5"></textarea>'+
 '<p style="font-size:12px;color:#a9c6d0">The model interprets evidence, not an independent proof. External tool approvals remain separate.</p></details>';
const inventory='<details id="fi-fial53-capability-panel" style="margin:12px 0;padding:13px;border:1px solid #3d5770;border-radius:12px;background:#0d1b29">'+
 '<summary style="cursor:pointer;font-weight:700">Fun Industrial intelligence domains</summary>'+
 '<p style="color:#a8bac9">Qwen can use available read-only evidence from the existing modules. The list does not grant execution authority or imply every worker is online.</p>'+
 '<pre id="fi-fial53-capability-list" style="font:12px/1.6 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:#bad3df">Checking local capability inventory…</pre>'+
 '</details>';
const reaReview='<details id="fi-fial53-rea-panel" style="margin:12px 0;padding:13px;border:1px solid #3d5770;border-radius:12px;background:#0d1b29">'+
 '<summary style="cursor:pointer;font-weight:700">Reviewed REA tools · separate approval</summary>'+
 '<p style="color:#a8bac9">These two read-only tools use the existing 8797 REA service directly, not the degraded 8798 proxy. Prepare and confirm are two separate clicks. Nothing executes merely because Qwen suggests it.</p>'+
 '<label for="fi-fial53-rea-select">Choose approved inspection</label>'+
 '<select id="fi-fial53-rea-select" style="max-width:100%;width:100%;background:#102338;color:#e6edf5;border:1px solid #52718d;padding:9px;border-radius:8px">'+
 '<option value="inspect_analysis_settings">Inspect REA analysis settings</option>'+
 '<option value="binary_session">Inspect REA binary provider session</option></select>'+
 '<p><button type="button" id="fi-fial53-rea-prepare">Prepare inspection</button> '+
 '<button type="button" id="fi-fial53-rea-confirm" disabled>Confirm exact read-only call</button> '+
 '<button type="button" id="fi-fial53-rea-cancel">Cancel</button></p>'+
 '<pre id="fi-fial53-rea-review" role="status" aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere;color:#d4e3f1;font:12px/1.5 Consolas,monospace">No REA inspection prepared.</pre>'+
 '<p><button type="button" id="fi-fial53-rea-explain" hidden>Ask Qwen to explain the approved observation</button></p>'+
 '<p style="font-size:12px;color:#aec5d2">No shell, file modification, REA configuration changes, or unapproved model-initiated calls. Provider and live REA status verified only at preparation.</p></details>';
const computeReview='<details id="fi-fial53-compute-panel" style="margin:12px 0;padding:13px;border:1px solid #3d5770;border-radius:12px;background:#0d1b29">'+
 '<summary style="cursor:pointer;font-weight:700">ML &amp; optimization · one AI, reviewed execution</summary>'+
 '<p style="color:#a8bac9">Use the existing local scikit-learn backend or fixed Optuna / OR-Tools solver. Input examples are synthetic, not real business data. Every solve requires separate Prepare and Confirm clicks. Qwen can explain the result, never launch it autonomously.</p>'+
 '<label for="fi-fial53-compute-kind">Choose bounded capability</label>'+
 '<select id="fi-fial53-compute-kind" style="max-width:100%;width:100%;background:#102338;color:#e6edf5;border:1px solid #52718d;padding:9px;border-radius:8px">'+
 '<option value="optuna_inventory">Optuna · inventory stock-level optimization</option>'+
 '<option value="ortools_routing">Google OR-Tools · one-vehicle route</option>'+
 '<option value="ml_deals">Scikit-learn · scored deals</option>'+
 '<option value="ml_history">Scikit-learn · local training (review required)</option>'+
 '<option value="ml_candidates">Scikit-learn · predictions from candidates</option>'+
 '</select>'+
 '<label for="fi-fial53-compute-prompt">Analysis objective</label>'+
 '<input id="fi-fial53-compute-prompt" maxlength="1000" value="Find an economical stock level from the supplied example demand" style="width:100%;background:#0c1825;color:#e6edf5;border:1px solid #537187;border-radius:8px;padding:9px">'+
 '<label for="fi-fial53-compute-data">Structured inputs (JSON; synthetic examples by default)</label>'+
 '<textarea id="fi-fial53-compute-data" spellcheck="false" maxlength="12500" style="display:block;width:100%;min-height:155px;background:#0c1825;color:#e6edf5;border:1px solid #537187;border-radius:8px;padding:9px;font:12px/1.5 Consolas,monospace"></textarea>'+
 '<p><button type="button" id="fi-fial53-compute-prepare">Prepare reviewed job</button> '+
 '<button type="button" id="fi-fial53-compute-confirm" disabled>Confirm exact computation</button> '+
 '<button type="button" id="fi-fial53-compute-cancel">Cancel</button></p>'+
 '<pre id="fi-fial53-compute-review" role="status" aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere;color:#d4e3f1;font:12px/1.5 Consolas,monospace">No computation prepared.</pre>'+
 '<p><button type="button" id="fi-fial53-compute-explain" hidden>Ask Qwen to explain approved result</button></p>'+
 '<p style="font-size:12px;color:#aec5d2">Isolated Python environment for Optuna and OR-Tools; scikit-learn uses existing 8801. No automatic installation, file edits, external messages or model-weight training. ML history mode trains a local statistical model only after explicit approval.</p></details>';
const panel=GROUNDED_PANEL
 .replace('<p><button id="fi-fial53-send"',inventory+extra+reaReview+computeReview+'<p><label style="font-size:13px;color:#bdd6e0"><input type="checkbox" id="fi-fial53-math-evidence"> Include verified Mathematical Research V2 evidence in this Qwen answer</label></p><p><button id="fi-fial53-send"')
 .replace('No tools are requested or executed from this conversation.',
  'An optional local FISRE analyzer reads code as data; no arbitrary code execution or REA actions occur.')
 .replace('No model tool definitions, automatic retries, memory writes, or REA execution.',
  'An attached code sample is checked locally before Qwen responds. No automatic retries, permanent memory writes, or REA execution.');
if(panel===GROUNDED_PANEL)throw Error('FISRE_UNIFIED_CHAT_PANEL_INJECTION_HOLD');
export const FISRE_QWEN_CHAT_HTML='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">'+
 '<title>Fun Industrial · Local Qwen with Semantic Reasoning</title>'+
 '<script src="/api/fial/grounded/client.js" defer></script>'+
 '<style>body{margin:0;padding:14px;background:#0b1420;color:#e6edf5;font:14px/1.5 system-ui,sans-serif}label{display:block;margin:12px 0 5px;color:#bed0dc}textarea{box-sizing:border-box}input{box-sizing:border-box}button{cursor:pointer}button:disabled{opacity:.6}</style>'+
 '</head><body><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:1100px;margin:0 auto 14px;padding:10px 12px;border:1px solid #315365;border-radius:11px;background:#102237;color:#d5efe8"><strong style="font-size:13px">Fun Industrial · AI workspace</strong><a href="/math/" style="color:#9ef3ce;font-weight:700;font-size:12px">Math Research</a> · <a href="/control/" style="color:#9ef3ce;font-weight:700;font-size:12px">Open Control Deck ↗</a></div>'+panel+'</body></html>';
