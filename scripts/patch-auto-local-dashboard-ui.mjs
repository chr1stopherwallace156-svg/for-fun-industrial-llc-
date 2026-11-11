// FI_AUTO_LOCAL_DASHBOARD_UI_PATCH_V2 — standalone panel for evolved dashboards.
// Does not require, rename, replace, or inspect any existing chat element IDs.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const MARK='FI_AUTO_LOCAL_DASHBOARD_UI_V2';
const PANEL=`
<!-- FI_AUTO_LOCAL_DASHBOARD_UI_V2: separately triggered local execution panel -->
<section id="fi-auto-local-panel" aria-label="Fun Industrial automatic local tools" style="padding:16px;margin:16px 0;border:1px solid #40566c;border-radius:12px;background:#172331;color:#eaf1f8">
  <h2>Fun Industrial · Automatic Local Tools</h2>
  <p>Run one local AI task without per-tool confirmation. Only currently registered Fun Industrial local tools are eligible; REA is unchanged.</p>
  <label for="fi-auto-task">Task for Qwen</label>
  <textarea id="fi-auto-task" maxlength="2000" rows="4" placeholder="Describe a task for local AI..." style="display:block;width:100%;box-sizing:border-box;min-height:90px;padding:10px;background:#0d1722;color:#eaf1f8;border:1px solid #40566c"></textarea>
  <button type="button" id="fi-auto-run">Run AI tools automatically</button>
  <span id="fi-auto-state" role="status" aria-live="polite">Manual start · up to two rounds · no REA execution</span>
  <div id="fi-auto-output" aria-live="polite" style="max-height:460px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px"></div>
</section>
<script src="/api/ai/auto-local/client.js" defer></script>
`;
export function patchAutoLocalDashboardUi(source){
 if(typeof source!=='string'||source.includes(MARK)||source.includes('id="fi-auto-local-panel"'))
  throw Error('AUTO_DASH_UI_ALREADY_INSTALLED_OR_INVALID');
 if(!/<body\b/i.test(source))throw Error('AUTO_DASH_UI_NO_BODY');
 const matches=[...source.matchAll(/<\/body\s*>/gi)];
 if(matches.length!==1)throw Error('AUTO_DASH_UI_BODY_CLOSING_NOT_UNIQUE');
 for(const id of ['fi-auto-task','fi-auto-run','fi-auto-state','fi-auto-output']){
  if(source.includes('id="'+id+'"'))throw Error('AUTO_DASH_UI_ID_COLLISION_'+id);
 }
 // Leave all original HTML, inline scripts and event handlers unchanged.
 const index=matches[0].index;
 const result=source.slice(0,index)+PANEL+'\n'+source.slice(index);
 if(!result.includes(source.slice(0,index)))throw Error('AUTO_DASH_UI_PREFIX_CHANGED');
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output))throw Error('AUTO_DASH_UI_PATHS_INVALID');
  writeFileSync(output,patchAutoLocalDashboardUi(readFileSync(input,'utf8')),'utf8');
  console.log('FUN_AUTO_DASH_UI_STAGE=PASS STANDALONE_COMPATIBLE=TRUE ORIGINAL_UNCHANGED=TRUE');
 }catch(e){console.error('FUN_AUTO_DASH_UI_STAGE=HOLD '+String(e.message||e));process.exitCode=1;}
}
