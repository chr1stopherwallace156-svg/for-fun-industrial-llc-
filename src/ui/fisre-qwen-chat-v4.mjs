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
const panel=GROUNDED_PANEL
 .replace('<p><button id="fi-fial53-send"',extra+'<p><button id="fi-fial53-send"')
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
 '</head><body>'+panel+'</body></html>';
