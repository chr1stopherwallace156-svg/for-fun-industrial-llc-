// Stage-only patcher: preserve Fun Industrial's existing dashboard/chat/Cognee
// and all REA approval paths. No live source files changed by this utility.
import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_VOICE_MOBILE_DASHBOARD_V1";
function replaceOnce(text,oldValue,newValue){
 const n=text.split(oldValue).length-1;
 if(n!==1)throw Error("FI_VOICE_PATCH_ANCHOR_HOLD COUNT="+n+" ANCHOR="+oldValue.slice(0,80));
 return text.replace(oldValue,()=>newValue);
}
export function patchMobileVoiceServer(input){
 if(input.includes(MARK))throw Error("FI_VOICE_DASHBOARD_ALREADY_PATCHED");
 for(const marker of ["FI_LOCAL_INTELLIGENCE_V1","FI_AUTO_COGNEE_CHAT_V1","FI_SOURCING_RETIRED_V1"]){
  if(!input.includes(marker))throw Error("FI_VOICE_EXISTING_BASELINE_HOLD MISSING="+marker);
 }
 let result=replaceOnce(input,
  'const root=path.dirname(fileURLToPath(import.meta.url));',
  'import {mobileVoiceHandler} from "./voice/mobile-upload.mjs";\n'+
  'const root=path.dirname(fileURLToPath(import.meta.url));');
 const anchor='const server=http.createServer(async(req,res)=>{try{';
 const routes=[
  ' // '+MARK+": preserves existing chat, REA, Cognee and service startup.",
  ' if(req.method==="GET"&&req.url==="/api/voice/mobile/client.js"){',
  '  if(!localRequest(req,res))return;',
  '  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});',
  '  return res.end(await readFile(path.join(root,"voice","mobile-client.js")));',
  ' }',
  ' if(String(req.url||"").startsWith("/api/voice/mobile/")){',
  '  if(!localRequest(req,res))return;',
  '  if(await mobileVoiceHandler(req,res))return;',
  ' }'
 ].join("\n");
 result=replaceOnce(result,anchor,anchor+"\n"+routes);
 return result;
}
export function patchMobileVoiceUi(html,panel){
 const marker="FI_VOICE_MOBILE_PANEL_V1";
 if(html.includes(marker))throw Error("FI_VOICE_PANEL_ALREADY_PRESENT");
 if(!html.includes("<body")||!html.includes("</body>")||!html.includes("<script"))
  throw Error("FI_VOICE_DASHBOARD_HTML_BASELINE_HOLD");
 if(!panel.includes(marker)||!panel.includes('id="fi-voice-mobile"'))
  throw Error("FI_VOICE_PANEL_SOURCE_INVALID");
 const firstScript=html.indexOf("<script");
 html=html.slice(0,firstScript)+"\n"+panel+"\n"+html.slice(firstScript);
 const end=html.lastIndexOf("</body>");
 return html.slice(0,end)+
  '\n<script src="/api/voice/mobile/client.js" defer></script>\n'+
  html.slice(end);
}
const invoke=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoke){
 try{
  const [serverIn,htmlIn,serverOut,htmlOut,panelFile]=process.argv.slice(2);
  if(!serverIn||!htmlIn||!serverOut||!htmlOut||!panelFile||
    new Set([path.resolve(serverIn),path.resolve(htmlIn),
             path.resolve(serverOut),path.resolve(htmlOut)]).size!==4)
   throw Error("FI_VOICE_PATCH_INPUT_OUTPUT_PATHS_REQUIRED");
  const serverSource=readFileSync(serverIn,"utf8"),htmlSource=readFileSync(htmlIn,"utf8");
  const panel=readFileSync(panelFile,"utf8");
  const patchedServer=patchMobileVoiceServer(serverSource);
  const patchedHtml=patchMobileVoiceUi(htmlSource,panel);
  writeFileSync(serverOut,patchedServer,"utf8");
  writeFileSync(htmlOut,patchedHtml,"utf8");
  console.log("FI_VOICE_DASHBOARD_PATCH=PASS ORIGINALS_UNCHANGED=TRUE UI=EXISTING_WITH_NEW_VOICE_PANEL");
 }catch(error){
  console.error("FI_VOICE_DASHBOARD_PATCH=HOLD "+error.message);
  process.exitCode=1;
 }
}
