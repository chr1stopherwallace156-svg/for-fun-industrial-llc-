// FIAL 5.3: corrected Qwen–Cognee conversation inside the existing 8802 hub.
// The legacy 8798 tool-review interface remains intact and independently approved.
export const GROUNDED_PANEL='<section id="fi-fial53-grounded" aria-label="Grounded Qwen conversation" style="max-width:1200px;margin:12px auto 28px;padding:22px;border:1px solid #365168;border-radius:18px;background:linear-gradient(180deg,#15293c,#112030);color:#eaf2fa">'+
 '<h2 style="font-size:23px;margin:0 0 5px">Qwen Chat · automatic Cognee memory</h2>'+
 '<p>Ask your local Qwen directly. Relevant local memory is recalled automatically and treated as untrusted reference data. No tools are requested or executed from this conversation.</p>'+
 '<p id="fi-fial53-status" role="status" style="color:#b1c8d9">Checking chat readiness…</p>'+
 '<label for="fi-fial53-question">Your message</label>'+
 '<textarea id="fi-fial53-question" maxlength="1200" spellcheck="true" style="display:block;box-sizing:border-box;width:100%;min-height:130px;background:#0c1825;color:#fff;border:1px solid #537187;border-radius:9px;padding:12px;font:inherit" placeholder="Ask Qwen a question…"></textarea>'+
 '<p><button id="fi-fial53-send" type="button" style="background:#91e0d8;color:#0d292f;border:0;border-radius:9px;padding:11px 15px;font:inherit;font-weight:700">Send to Qwen</button></p>'+
 '<div id="fi-fial53-history" role="log" aria-live="polite" style="display:grid;gap:12px"></div>'+
 '<p style="font-size:12px;color:#aec4d4">One local Qwen request per send. No model tool definitions, automatic retries, memory writes, or REA execution. For authorized tools, select Tools &amp; Review in the navigation.</p>'+
 '</section>';
export const GROUNDED_CLIENT=new URL('./primary-grounded-client-v5-3.js',import.meta.url);
export const GROUNDED_VERSION='fial5.3-primary-grounded-chat-v1';
