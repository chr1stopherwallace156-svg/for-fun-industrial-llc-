// FI_AUTO_LOCAL_DASHBOARD_UI_PATCH_V1 — separate button, original chat unchanged.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const MARK='FI_AUTO_LOCAL_DASHBOARD_UI_V1';
const SEND='<button id="chat-send">Send message</button>';
const END='</body></html>';
const SCRIPT="\n<script>\n// FI_AUTO_LOCAL_DASHBOARD_UI_V1 — independent operator-started action.\n(()=>{'use strict';\nconst byId=id=>document.getElementById(id);\nconst button=byId('chat-auto-run'),state=byId('chat-auto-state'),prompt=byId('chat-input');\nif(!button||!state||!prompt)return;\nlet running=false;\nfunction message(text){\n const node=document.createElement('div');\n node.style.cssText='padding:10px 12px;margin:8px 0;border-radius:9px;background:#203849;white-space:pre-wrap;overflow-wrap:anywhere';\n node.textContent='Fun Industrial auto tools: '+String(text).slice(0,12000);\n const history=byId('chat-history');if(history){history.appendChild(node);history.scrollTop=history.scrollHeight;}\n}\nbutton.onclick=async()=>{\n if(running)return;\n const value=prompt.value.trim();\n if(value.length<3||value.length>2000){state.textContent='Enter a task of 3–2000 characters';return;}\n running=true;button.disabled=true;state.textContent='Running local AI tools (no per-tool prompts)…';\n message('Operator-started task: '+value);\n try{\n  const res=await fetch('/api/ai/auto-local/run',{\n   method:'POST',headers:{'content-type':'application/json'},\n   body:JSON.stringify({prompt:value,rounds:2})\n  });\n  const data=await res.json();\n  if(!res.ok)throw Error(String(data.error||('HTTP '+res.status)));\n  const actions=Array.isArray(data.actions)?data.actions:[];\n  for(const action of actions){\n   message('Executed '+String(action.tool)+' (round '+String(action.round)+')\\n'+\n    JSON.stringify(action.result).slice(0,3500));\n  }\n  if(data.reply)message('AI: '+String(data.reply));\n  state.textContent=String(data.state)+' · executed '+actions.length+\n   ' · registered '+String(data.registeredLocal)+' local tools · REA unchanged';\n  prompt.value='';\n }catch(error){\n  const issue=String(error.message||error).slice(0,280);\n  message('HOLD — '+issue);state.textContent='HOLD: '+issue;\n }finally{running=false;button.disabled=false;}\n};\n})();\n</script>\n";
function one(s,anchor,replacement){
 if(s.split(anchor).length!==2)throw Error('AUTO_DASH_UI_ANCHOR_NOT_UNIQUE_'+anchor.slice(0,70));
 return s.replace(anchor,()=>replacement);
}
export function patchAutoLocalDashboardUi(source){
 if(typeof source!=='string'||source.includes(MARK))throw Error('AUTO_DASH_UI_ALREADY_INSTALLED_OR_INVALID');
 for(const anchor of ['id="chat-history"','id="chat-input"',SEND,'id="chat-proposals"']){
  if(!source.includes(anchor))throw Error('AUTO_DASH_UI_EXISTING_CHAT_MISSING_'+anchor);
 }
 let out=one(source,SEND,SEND+'<button type="button" class="secondary" id="chat-auto-run">Run AI tools automatically</button>'+
  '<span class="muted small" id="chat-auto-state" aria-live="polite">Run manually · no per-tool approval · local tools only</span>');
 out=one(out,END,SCRIPT+END);
 for(const marker of ['id="chat-send"','id="chat-clear"','id="chat-proposals"','id="ai-stop"','id="security-scan"']){
  if(!out.includes(marker))throw Error('AUTO_DASH_UI_PROTECTED_CONTROL_LOST_'+marker);
 }
 return out;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output))throw Error('AUTO_DASH_UI_PATHS_INVALID');
  writeFileSync(output,patchAutoLocalDashboardUi(readFileSync(input,'utf8')),'utf8');
  console.log('FUN_AUTO_DASH_UI_STAGE=PASS ORIGINAL_UNCHANGED=TRUE');
 }catch(e){console.error('FUN_AUTO_DASH_UI_STAGE=HOLD '+String(e.message||e));process.exitCode=1;}
}
