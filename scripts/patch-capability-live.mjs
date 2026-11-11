// FI_CAPABILITY_LIVE_PATCH_V1: additive source patch for an ALREADY deployed cognition UI.
// Only staged output is written by this script, never a live installed file.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const MARK='FI_CAPABILITY_INDEX_LIVE_V1';
const ROOT='const root=path.dirname(fileURLToPath(import.meta.url));';
const SERVER='const server=http.createServer(async(req,res)=>{try{';
const CHAT='try{enriched={...enriched,payload:fiCognitive.enrichChat(enriched.payload,body)};}\n catch(_cognitiveError){/* no cognitive failure may break existing local AI chat */}';
function exactlyOnce(text,anchor,replace){
 if(text.split(anchor).length!==2)throw Error('CAPABILITY_PATCH_ANCHOR_NOT_UNIQUE_'+anchor.slice(0,60));
 return text.replace(anchor,()=>replace);
}
export function patchCapabilityLive(source){
 if(typeof source!=='string'||source.includes(MARK))throw Error('CAPABILITY_ALREADY_INSTALLED_OR_INVALID');
 for(const required of ['FI_COGNITIVE_LIVE_PATCH_V1','FI_AUTO_COGNEE_CHAT_V1',
  'FI_VOICE_MOBILE_DASHBOARD_V1','FI_COGNITIVE_CHAT_CONTEXT_V1',
  '/api/cognition/status','/api/rea/call','/api/ai/tool-call',
  'return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);']){
  if(!source.includes(required))throw Error('CAPABILITY_PROTECTED_BASELINE_MISSING_'+required);
 }
 let result=exactlyOnce(source,ROOT,
  'import {createCapabilityIndex} from "./cognition/capability-index.mjs";\n'+
  'import {decorateCapabilityChat} from "./cognition/capability-chat.mjs";\n'+
  '// '+MARK+'\n'+ROOT);
 const routes=[
  'const fiCapabilityIndex=createCapabilityIndex({',
  ' localDefinitions:()=>openAiToolDefinitions([]),',
  ' reaCatalogue:()=>platform.reaCatalog()',
  '});',
  SERVER,
  ' // '+MARK+': informational discovery, never a tool execution route.',
  ' if(req.url==="/api/cognition/catalogue/status"&&req.method==="GET"){',
  '  if(!localRequest(req,res))return;',
  '  return json(res,200,fiCapabilityIndex.status());',
  ' }',
  ' if(req.url==="/api/cognition/catalogue/search"&&req.method==="POST"){',
  '  if(!localRequest(req,res))return;',
  '  const body=await readBody(req,2000);',
  '  return json(res,200,fiCapabilityIndex.search(body));',
  ' }',
  ' if(req.url==="/api/cognition/catalogue/refresh-rea"&&req.method==="POST"){',
  '  if(!localRequest(req,res))return;',
  '  const body=await readBody(req,100);',
  '  if(Object.keys(body).length!==0)return json(res,400,{error:"EMPTY_BODY_REQUIRED"});',
  '  return json(res,200,await fiCapabilityIndex.refreshRea());',
  ' }'
 ].join('\n');
 result=exactlyOnce(result,SERVER,routes);
 // Replace the entire existing cognitive try/catch pair as one atomic unit.
 // Replacing just the try block would strand its original catch after the
 // new capability try/catch, creating invalid JavaScript.
 result=exactlyOnce(result,CHAT,
  CHAT+'\n // '+MARK+': optional bounded reference data, never callable model tools.\n'+
  ' try{enriched={...enriched,payload:decorateCapabilityChat(enriched.payload,body,fiCapabilityIndex)};}'+
  ' catch(_capabilityError){/* informational catalogue cannot break existing chat */}');
 for(const m of ['FI_COGNITIVE_LIVE_PATCH_V1','FI_AUTO_COGNEE_CHAT_V1',
  'FI_VOICE_MOBILE_DASHBOARD_V1','/api/rea/call','/api/ai/tool-call',
  '/api/cognition/status','/api/ai/automatic-memory/status']){
  if(!result.includes(m))throw Error('CAPABILITY_PROTECTED_ROUTE_REMOVED_'+m);
 }
 if((result.match(/fiAutomaticMemory\(body,memoryStatus\(\)\.enabled\)/g)||[]).length!==1)
  throw Error('CAPABILITY_MEMORY_PIPELINE_COUNT_CHANGED');
 if((result.match(/decorateCapabilityChat\(enriched\.payload,body,fiCapabilityIndex\)/g)||[]).length!==1)
  throw Error('CAPABILITY_CHAT_DECORATOR_NOT_EXACT');
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output))throw Error('CAPABILITY_STAGE_INPUT_OUTPUT_INVALID');
  writeFileSync(output,patchCapabilityLive(readFileSync(input,'utf8')),'utf8');
  console.log('FUN_CAPABILITY_STAGE_PATCH=PASS ORIGINAL_SOURCE_UNCHANGED=TRUE');
 }catch(e){console.error('FUN_CAPABILITY_STAGE_PATCH=HOLD '+String(e?.message||e));process.exitCode=1;}
}
