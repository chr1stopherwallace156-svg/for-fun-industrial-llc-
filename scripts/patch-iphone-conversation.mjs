// Stage-only additive patch. Does not touch the live dashboard until the
// guarded activation script verifies both staged files and operator services.
import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_VOICE_CONVERSATION_DASHBOARD_V1";
function once(s,a,b){
 const n=s.split(a).length-1;
 if(n!==1)throw Error("FI_VOICE_CONVERSATION_ANCHOR_HOLD "+n+" "+a.slice(0,100));
 return s.replace(a,()=>b);
}
export function patchServer(input){
 if(input.includes(MARK))throw Error("FI_VOICE_CONVERSATION_ALREADY_PATCHED");
 for(const marker of ["FI_VOICE_MOBILE_DASHBOARD_V1","FI_AUTO_COGNEE_CHAT_V1","FI_SOURCING_RETIRED_V1"]){
  if(!input.includes(marker))throw Error("FI_VOICE_CONVERSATION_BASELINE_HOLD "+marker);
 }
 let s=once(input,'import {mobileVoiceHandler} from "./voice/mobile-upload.mjs";',
  'import {mobileVoiceHandler} from "./voice/mobile-upload.mjs";\n'+
  'import {conversationHandler} from "./voice/conversation.mjs";');
 const anchor=' if(req.method==="GET"&&req.url==="/api/voice/mobile/client.js"){';
 const routes=[
  ' // '+MARK+" — tools, REA and Cognee remain untouched.",
  ' if(req.method==="GET"&&req.url==="/api/voice/conversation/client.js"){',
  '  if(!localRequest(req,res))return;',
  '  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});',
  '  return res.end(await readFile(path.join(root,"voice","conversation-client.js")));',
  ' }',
  ' if(String(req.url||"").startsWith("/api/voice/conversation/")){',
  '  if(!localRequest(req,res))return;',
  '  if(await conversationHandler(req,res))return;',
  ' }'
 ].join("\n");
 s=once(s,anchor,routes+"\n"+anchor);
 return s;
}
export function patchUi(html){
 if(html.includes("FI_VOICE_CONVERSATION_UI_V1"))throw Error("FI_VOICE_CONVERSATION_UI_ALREADY_PRESENT");
 if(!html.includes("FI_VOICE_MOBILE_PANEL_V1")||
  !html.includes('src="/api/voice/mobile/client.js"'))
  throw Error("FI_VOICE_CONVERSATION_HTML_BASELINE_HOLD");
 return once(html,"</body>",
  '<!-- FI_VOICE_CONVERSATION_UI_V1 -->\n'+
  '<script src="/api/voice/conversation/client.js" defer></script>\n</body>');
}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const [serverIn,htmlIn,serverOut,htmlOut]=process.argv.slice(2);
  if([serverIn,htmlIn,serverOut,htmlOut].some(x=>!x)||
    new Set([serverIn,htmlIn,serverOut,htmlOut].map(x=>path.resolve(x))).size!==4)
    throw Error("FI_VOICE_CONVERSATION_PATHS_INVALID");
  writeFileSync(serverOut,patchServer(readFileSync(serverIn,"utf8")));
  writeFileSync(htmlOut,patchUi(readFileSync(htmlIn,"utf8")));
  console.log("FI_VOICE_CONVERSATION_STAGING=PASS EXISTING_DASHBOARD_UNCHANGED=TRUE");
 }catch(e){console.error("FI_VOICE_CONVERSATION_STAGING=HOLD "+e.message);process.exitCode=1}
}
