// Incremental server patch. Requires LIVE sourcing-retired source, never restores old feeds.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_LOCAL_INTELLIGENCE_V1";
function once(s,a,b){if(s.split(a).length!==2)throw Error("INTELLIGENCE_ANCHOR_HOLD:"+a.slice(0,65));return s.replace(a,b)}
export function patchIntelligenceServer(source){
 if(source.includes(MARK))throw Error("INTELLIGENCE_ALREADY_INSTALLED");
 if(!source.includes("FI_SOURCING_RETIRED_V1"))throw Error("SOURCING_RETIREMENT_REQUIRED");
 let s=once(source,'import {createAutonomyActivator} from "./autonomy-activation.mjs";',
 [
 'import {createAutonomyActivator} from "./autonomy-activation.mjs";',
 'import {policySummary,evaluateSituation} from "./intelligence/rules.mjs";',
 'import {memoryStatus,memoryAction} from "./intelligence/memory.mjs";'
 ].join("\n"));
 s=once(s,'const server=http.createServer(async(req,res)=>{try{',[
 'let fiMemoryInFlight=false;',
 'const server=http.createServer(async(req,res)=>{try{',
 ' // FI_LOCAL_INTELLIGENCE_V1 — local deterministic decisions and operator-triggered Cognee.',
 ' if(req.method==="GET"&&req.url==="/api/intelligence/status"){',
 '  if(!localRequest(req,res))return;',
 '  return json(res,200,{rules:policySummary(),memory:memoryStatus()});',
 ' }',
 ' if(req.method==="POST"&&req.url==="/api/intelligence/evaluate"){',
 '  if(!localRequest(req,res))return;',
 '  const facts=await readBody(req,3000);',
 '  return json(res,200,await evaluateSituation(facts));',
 ' }',
 ' if(req.method==="POST"&&["/api/intelligence/memory/remember","/api/intelligence/memory/recall"].includes(req.url)){',
 '  if(!localRequest(req,res))return;',
 '  if(fiMemoryInFlight)return json(res,429,{error:"MEMORY_OPERATION_BUSY"});',
 '  const action=req.url.endsWith("/remember")?"remember":"recall";',
 '  const input=await readBody(req,5000);',
 '  fiMemoryInFlight=true;',
 '  try{const data=await memoryAction(action,input);return json(res,200,data);}',
 '  finally{fiMemoryInFlight=false;}',
 ' }'
 ].join("\n"));
 return s;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output))throw Error("SEPARATE_INPUT_AND_STAGE_OUTPUT_REQUIRED");
  const result=patchIntelligenceServer(readFileSync(input,"utf8"));
  writeFileSync(output,result,"utf8");
  console.log("INTELLIGENCE_SOURCE_PATCH=PASS ORIGINAL_UNCHANGED=TRUE");
 }catch(e){console.error("INTELLIGENCE_SOURCE_PATCH=HOLD "+e.message);process.exitCode=1}
}
