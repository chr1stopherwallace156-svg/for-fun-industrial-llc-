// FI_CHAT_OPTIMIZATION_PATCH_V1 — staging only, preserves existing live dashboard baseline.
// Never edits originals in place. No generic chat body rewrite, no new listeners.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_CHAT_OPTIMIZATION_SERVER_V1";
const once=(s,find,to)=>{
 const n=s.split(find).length-1;
 if(n!==1)throw Error("CHAT_OPT_PATCH_ANCHOR_HOLD:"+find.slice(0,70)+":"+n);
 return s.replace(find,to);
};
export function patchChatOptimizationServer(original){
 if(original.includes(MARK))throw Error("CHAT_OPT_ALREADY_PATCHED");
 for(const marker of ["FI_WEB_CHAT_CONSOLIDATION_V1","FI_OPTIMIZATION_AGENT_V1",
  "FI_AUTO_COGNEE_CHAT_V1","FI_VOICE_MOBILE_DASHBOARD_V1","FI_SOURCING_RETIRED_V1"]){
  if(!original.includes(marker))throw Error("CHAT_OPT_PROTECTED_MARKER_MISSING_"+marker);
 }
 const entry='const root=path.dirname(fileURLToPath(import.meta.url));';
 let s=once(original,entry,
  'import {createChatOptimizationHandler} from "./workflows/chat-optimization-http.mjs";\n'+
  entry+'\nconst fiChatOptimizationHandler=createChatOptimizationHandler();');
 const anchor='const server=http.createServer(async(req,res)=>{try{';
 const routes=[
  ' // '+MARK+': one explicit optimization request path; regular chat untouched.',
  ' if(req.method==="GET"&&req.url==="/api/ai/chat-optimization/client.js"){',
  '  if(!localRequest(req,res))return;',
  '  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});',
  '  return res.end(await readFile(path.join(root,"workflows","chat-optimization-client.js")));',
  ' }',
  ' if(String(req.url||"").startsWith("/api/ai/chat-optimization/")){',
  '  if(!localRequest(req,res))return;',
  '  return await fiChatOptimizationHandler(req,res,{json,readBody});',
  ' }'
 ].join("\n");
 s=once(s,anchor,anchor+"\n"+routes);
 for(const protectedRoute of ["/api/rea/call","/api/optimization/agent/analyze",
  "/api/ai/automatic-memory/status","/api/voice/mobile/","/api/web/status"]){
  if(!original.includes(protectedRoute)||!s.includes(protectedRoute))
   throw Error("CHAT_OPT_PROTECTED_ROUTE_MISSING_"+protectedRoute);
 }
 const csp=[...original.matchAll(/script-src\s+([^;]+);/g)];
 if(csp.length!==1||!/(?:^|\s)'self'(?:\s|$)/.test(csp[0][1]))
  throw Error("CHAT_OPT_CSP_SELF_REQUIRED");
 return s;
}
export function patchChatOptimizationUi(original){
 if(original.includes("FI_CHAT_OPTIMIZATION_UI_V1"))throw Error("CHAT_OPT_UI_ALREADY_PATCHED");
 // The operator dashboard evolves independently of GitHub's original chat markup.
 // Preserve the entire existing UI. The injected client will discover one unique
 // chat surface or provide an explicit local-only optimizer entry without hijacking chat.
 for(const marker of ["FI_WEB_CHAT_CONSOLIDATION_UI_V1",
  "FI_VOICE_MOBILE_PANEL_V1"]){
  if(!original.includes(marker))throw Error("CHAT_OPT_UI_BASELINE_MISSING_"+marker);
 }
 const openings=[...original.matchAll(/<body(?:\\s[^>]*)?>/gi)];
 const matches=[...original.matchAll(/<\/body\s*>/gi)];
 if(openings.length!==1||matches.length!==1)throw Error("CHAT_OPT_BODY_ANCHOR_HOLD");
 const p=matches[0].index;
 return original.slice(0,p)+'\n<!-- FI_CHAT_OPTIMIZATION_UI_V1: chat prompt enhancement, approval-gated -->\n'+
  '<script src="/api/ai/chat-optimization/client.js" defer></script>\n'+original.slice(p);
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const [server,html,outServer,outHtml]=process.argv.slice(2);
  if([server,html,outServer,outHtml].some(x=>!x)||
   new Set([server,html,outServer,outHtml].map(x=>resolve(x))).size!==4)
   throw Error("CHAT_OPT_PATCH_UNIQUE_PATHS_REQUIRED");
  writeFileSync(outServer,patchChatOptimizationServer(readFileSync(server,"utf8")),"utf8");
  writeFileSync(outHtml,patchChatOptimizationUi(readFileSync(html,"utf8")),"utf8");
  console.log("FUN_CHAT_OPTIMIZATION_STAGE=PASS EXISTING_CHAT_UNMODIFIED=TRUE");
 }catch(e){console.error("FUN_CHAT_OPTIMIZATION_STAGE_HOLD="+String(e.message||e).slice(0,180));process.exitCode=1;}
}
