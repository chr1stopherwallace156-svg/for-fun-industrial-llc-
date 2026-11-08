// Atomic source patch: automatic, read-only Cognee context in existing /api/ai/chat.
// No UI checkbox, no separate chat endpoint and no change to tool approvals.
// Operates on staged copies; never writes the input server.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_AUTO_COGNEE_CHAT_V1";
function once(source,anchor,replacement){
 if(source.split(anchor).length!==2)throw Error("AUTO_MEMORY_ANCHOR_HOLD:"+anchor.slice(0,100));
 return source.replace(anchor,replacement);
}
export function patchAutomaticMemory(source){
 if(source.includes(MARK))throw Error("AUTO_MEMORY_ALREADY_INSTALLED");
 if(!source.includes("FI_LOCAL_INTELLIGENCE_V1")||
    !source.includes("FI_SOURCING_RETIRED_V1"))
  throw Error("AUTO_MEMORY_BASELINE_MISSING");
 if(source.includes("FI_OPT_IN_MEMORY_CHAT_V1"))throw Error("AUTO_MEMORY_OLD_CHAT_PATCH_PRESENT");
 let s=once(source,
  'import {memoryStatus,memoryStorageUsage,memoryAction} from "./intelligence/memory.mjs";',
  'import {memoryStatus,memoryStorageUsage,memoryAction} from "./intelligence/memory.mjs";\n'+
  'import {createAutomaticMemoryDecorator} from "./intelligence/automatic-memory.mjs";');
 const server='const server=http.createServer(async(req,res)=>{try{';
 s=once(s,server,
  'const fiAutomaticMemory=createAutomaticMemoryDecorator(query=>memoryAction("recall",{query}),{budgetMs:12000});\n'+
  server);
 const route=' if(aiRoutes[req.url]&&req.method===aiRoutes[req.url].method){';
 const patch=[
  " // "+MARK+" — implicit read-only recall in EXISTING local chat (no new tools).",
  ' if(req.method==="GET"&&req.url==="/api/ai/automatic-memory/status"){',
  '  if(!localRequest(req,res))return;',
  '  return json(res,200,{...fiAutomaticMemory.getStatus(),memoryAvailable:memoryStatus().enabled});',
  ' }',
  ' if(req.method==="POST"&&req.url==="/api/ai/chat"){',
  '  if(!localRequest(req,res))return;',
  '  if(!await requireVpnGate(res))return;',
  '  const body=await readBody(req,1000000);',
  '  const enriched=await fiAutomaticMemory(body,memoryStatus().enabled);',
  '  return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);',
  ' }'
 ].join("\n");
 s=once(s,route,patch+"\n"+route);
 return s;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output))
   throw Error("STAGED_INPUT_OUTPUT_REQUIRED");
  const original=readFileSync(input,"utf8");
  const staged=patchAutomaticMemory(original);
  writeFileSync(output,staged,"utf8");
  console.log("AUTO_MEMORY_PATCH=PASS ORIGINAL_SOURCE_UNCHANGED=TRUE");
 }catch(e){console.error("AUTO_MEMORY_PATCH=HOLD "+e.message);process.exitCode=1}
}
