// FI_OPTIMIZATION_AGENT_PATCH_V1 — additive patch atop the deployed Phase 2/3 source.
// Never replace the customized server, voice, memory, REA policy or HTML.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_OPTIMIZATION_AGENT_V1";
function once(text,anchor,replacement){
 const count=text.split(anchor).length-1;
 if(count!==1)throw Error("OPT_AGENT_PATCH_ANCHOR_HOLD "+anchor.slice(0,45)+" COUNT="+count);
 return text.replace(anchor,()=>replacement);
}
export function patchOptimizationAgentServer(original){
 if(original.includes(MARK))throw Error("OPT_AGENT_ALREADY_PATCHED");
 for(const mark of ["FI_OPTIMIZATION_PHASE23_V1","FI_AUTO_COGNEE_CHAT_V1",
                   "FI_SOURCING_RETIRED_V1","FI_VOICE_MOBILE_DASHBOARD_V1"]){
  if(!original.includes(mark))throw Error("OPT_AGENT_BASELINE_MISSING_"+mark);
 }
 let result=once(original,
  'import {createOptimizationRunner} from "./optimization/runner.mjs";',
  'import {createOptimizationRunner} from "./optimization/runner.mjs";\n'+
  'import {createOptimizationAgent} from "./optimization/agent.mjs";');
 result=once(result,
  'const fiOptimization=createOptimizationRunner();',
  'const fiOptimization=createOptimizationRunner();\n'+
  'const fiOptimizationAgent=createOptimizationAgent({runner:fiOptimization});');
 const anchor='const server=http.createServer(async(req,res)=>{try{';
 const routes=[
  ' // '+MARK+': local offline optimization only. REA execution remains disabled.',
  ' if(req.method==="GET"&&req.url==="/api/optimization/agent/status"){',
  '  if(!localRequest(req,res))return;',
  '  return json(res,200,fiOptimizationAgent.status());',
  ' }',
  ' if(req.method==="GET"&&req.url==="/api/optimization/agent/client.js"){',
  '  if(!localRequest(req,res))return;',
  '  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});',
  '  return res.end(await readFile(path.join(root,"optimization","agent-client.js")));',
  ' }',
  ' if(req.method==="POST"&&(req.url==="/api/optimization/agent/analyze"||req.url==="/api/optimization/agent/approve")){',
  '  if(!localRequest(req,res))return;',
  '  if(req.headers["x-fi-optimization-approval"]!=="operator-reviewed"||',
  '     req.headers["content-type"]!=="application/json"||req.headers["sec-fetch-site"]==="cross-site")',
  '   return json(res,403,{error:"OPT_AGENT_OPERATOR_REVIEW_REQUIRED"});',
  '  const body=await readBody(req,32768);',
  '  if(!body||typeof body!=="object"||Array.isArray(body))return json(res,400,{error:"OPT_AGENT_INVALID_BODY"});',
  '  try{',
  '   if(req.url==="/api/optimization/agent/analyze"){',
  '    if(Object.keys(body).some(k=>k!=="request"&&k!=="problem"))return json(res,400,{error:"OPT_AGENT_UNEXPECTED_FIELDS"});',
  '    return json(res,200,await fiOptimizationAgent.analyze(body));',
  '   }',
  '   if(Object.keys(body).sort().join(",")!=="action,ticket")return json(res,400,{error:"OPT_AGENT_UNEXPECTED_FIELDS"});',
  '   return json(res,200,await fiOptimizationAgent.approve(body));',
  '  }catch(error){return json(res,400,{error:String(error.message||"OPT_AGENT_HOLD").slice(0,300)});}',
  ' }',
 ].join("\n");
 result=once(result,anchor,anchor+"\n"+routes);
 const csp=[...result.matchAll(/script-src\s+([^;]+);/g)];
 if(csp.length!==1||!/(?:^|\s)'self'(?:\s|$)/.test(csp[0][1]))
  throw Error("OPT_AGENT_CSP_UNSAFE");
 return result;
}
export function patchOptimizationAgentUi(original,panel){
 if(original.includes("FI_OPTIMIZATION_AGENT_PANEL_V1"))throw Error("OPT_AGENT_UI_ALREADY_PATCHED");
 if(!original.includes("FI_OPTIMIZATION_PHASE23_PANEL_V1")||!original.includes("FI_VOICE_MOBILE_PANEL_V1"))
  throw Error("OPT_AGENT_UI_BASELINE_HOLD");
 if(!panel.includes("FI_OPTIMIZATION_AGENT_PANEL_V1")||!panel.includes('id="fi-opt-agent"'))
  throw Error("OPT_AGENT_PANEL_INVALID");
 const closing=[...original.matchAll(/<\/body\s*>/gi)];
 if(closing.length!==1)throw Error("OPT_AGENT_UI_BODY_ANCHOR_HOLD");
 const i=closing[0].index;
 return original.slice(0,i)+"\n"+panel+"\n<script src=\"/api/optimization/agent/client.js\" defer></script>\n"+original.slice(i);
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const [server,ui,outServer,outUi,panel]=process.argv.slice(2);
  if(!server||!ui||!outServer||!outUi||!panel||
     new Set([server,ui,outServer,outUi].map(p=>resolve(p))).size!==4)
   throw Error("OPT_AGENT_STAGING_PATHS_INVALID");
  writeFileSync(outServer,patchOptimizationAgentServer(readFileSync(server,"utf8")),"utf8");
  writeFileSync(outUi,patchOptimizationAgentUi(readFileSync(ui,"utf8"),readFileSync(panel,"utf8")),"utf8");
  console.log("FUN_OPT_AGENT_PATCH=PASS EXISTING_CUSTOMIZATIONS_PRESERVED=TRUE");
 }catch(error){console.error("FUN_OPT_AGENT_PATCH_HOLD="+error.message);process.exitCode=1;}
}
