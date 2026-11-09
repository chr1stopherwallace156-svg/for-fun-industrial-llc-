// Stage-only additive Phase 2/3 patch for the actual deployed Fun Industrial
// dashboard, NOT the older/basic HTML included in GitHub.
import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_OPTIMIZATION_PHASE23_V1";
function replaceOnce(s,needle,replacement){
 const n=s.split(needle).length-1;
 if(n!==1)throw Error("OPTIMIZATION_PATCH_ANCHOR_HOLD "+needle.slice(0,55)+" COUNT="+n);
 return s.replace(needle,()=>replacement);
}
export function patchOptimizationServer(original){
 if(original.includes(MARK))throw Error("OPTIMIZATION_ALREADY_PATCHED");
 for(const m of ["FI_AUTO_COGNEE_CHAT_V1","FI_SOURCING_RETIRED_V1",
                 "FI_VOICE_MOBILE_DASHBOARD_V1"]){
  if(!original.includes(m))throw Error("OPTIMIZATION_BASELINE_MISSING_"+m);
 }
 let result=replaceOnce(original,
  'const root=path.dirname(fileURLToPath(import.meta.url));',
  'import {createOptimizationRunner} from "./optimization/runner.mjs";\n'+
  'const root=path.dirname(fileURLToPath(import.meta.url));\n'+
  'const fiOptimization=createOptimizationRunner();');
 const anchor='const server=http.createServer(async(req,res)=>{try{';
 const routes=[
  ' // '+MARK+': preserves existing REA, memory, voice and platform routes.',
  ' if(req.method==="GET"&&req.url==="/api/optimization/client.js"){',
  '  if(!localRequest(req,res))return;',
  '  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});',
  '  return res.end(await readFile(path.join(root,"optimization","client.js")));',
  ' }',
  ' if(req.method==="GET"&&req.url==="/api/optimization/status"){',
  '  if(!localRequest(req,res))return;',
  '  return json(res,200,fiOptimization.status());',
  ' }',
  ' if(req.method==="POST"&&req.url==="/api/optimization/run"){',
  '  if(!localRequest(req,res))return;',
  '  if(req.headers["x-fi-optimization-approval"]!=="operator-reviewed"||',
  '     req.headers["content-type"]!=="application/json"||',
  '     req.headers["sec-fetch-site"]==="cross-site")',
  '   return json(res,403,{error:"OPTIMIZATION_EXPLICIT_APPROVAL_REQUIRED"});',
  '  const body=await readBody(req,32768);',
  '  if(!body||typeof body!=="object"||Array.isArray(body)||',
  '     Object.keys(body).sort().join(",")!=="action,problem")',
  '   return json(res,400,{error:"OPTIMIZATION_INVALID_REQUEST"});',
  '  try{return json(res,200,await fiOptimization.run(body.action,body.problem));}',
  '  catch(error){return json(res,400,{error:String(error.message||"OPTIMIZATION_HOLD").slice(0,330)});}',
  ' }'
 ].join("\n");
 result=replaceOnce(result,anchor,anchor+"\n"+routes);
 // External client script served only from the same origin. Preserve CSP
 // unless it lacks self script imports; in that case fail rather than weaken.
 const matches=[...result.matchAll(/script-src\s+([^;]+);/g)];
 if(matches.length!==1||!/(?:^|\s)'self'(?:\s|$)/.test(matches[0][1]))
  throw Error("OPTIMIZATION_EXISTING_CSP_MUST_ALLOW_SELF_SCRIPTS");
 return result;
}
export function patchOptimizationUi(original,panel){
 if(original.includes("FI_OPTIMIZATION_PHASE23_PANEL_V1"))throw Error("OPTIMIZATION_PANEL_ALREADY_PATCHED");
 if(!panel.includes("FI_OPTIMIZATION_PHASE23_PANEL_V1")||!panel.includes('id="fi-optimization"'))
  throw Error("OPTIMIZATION_PANEL_INVALID");
 const open=[...original.matchAll(/<body(?:\s[^>]*)?>/gi)];
 const close=[...original.matchAll(/<\/body\s*>/gi)];
 if(open.length!==1||close.length!==1)throw Error("OPTIMIZATION_UI_BODY_ANCHOR_HOLD");
 const pos=close[0].index;
 const addition='\n'+panel+'\n<script src="/api/optimization/client.js" defer></script>\n';
 return original.slice(0,pos)+addition+original.slice(pos);
}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const [server,html,serverOut,htmlOut,panelFile]=process.argv.slice(2);
  if(!server||!html||!serverOut||!htmlOut||!panelFile||
   new Set([server,html,serverOut,htmlOut].map(p=>path.resolve(p))).size!==4)
   throw Error("OPTIMIZATION_UNIQUE_STAGE_PATHS_REQUIRED");
  const source=readFileSync(server,"utf8"),ui=readFileSync(html,"utf8"),
   panel=readFileSync(panelFile,"utf8");
  writeFileSync(serverOut,patchOptimizationServer(source),"utf8");
  writeFileSync(htmlOut,patchOptimizationUi(ui,panel),"utf8");
  console.log("FUN_OPTIMIZATION_PATCH=PASS EXISTING_DASHBOARD_PRESERVED=TRUE");
 }catch(error){
  console.error("FUN_OPTIMIZATION_PATCH_HOLD="+error.message);
  process.exitCode=1;
 }
}
