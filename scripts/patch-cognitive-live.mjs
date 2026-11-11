// FI_COGNITIVE_LIVE_PATCH_V1 — patch ONLY staged copies of deployed Fun Industrial.
// Requires already qualified consolidated chat and security-primary baseline.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const MARK = 'FI_COGNITIVE_LIVE_PATCH_V1';
const ROOT = 'const root=path.dirname(fileURLToPath(import.meta.url));';
const SERVER = 'const server=http.createServer(async(req,res)=>{try{';
const MEMORY = 'const enriched=await fiAutomaticMemory(body,memoryStatus().enabled);';
function once(s,anchor,replacement) {
  if(s.split(anchor).length !== 2) throw Error('COGNITION_ANCHOR_NOT_UNIQUE:'+anchor.slice(0,65));
  return s.replace(anchor, () => replacement);
}
export function patchCognitiveLiveServer(source) {
  if(typeof source !== 'string' || source.includes(MARK)) throw Error('COGNITION_ALREADY_INSTALLED_OR_INVALID');
  for(const marker of ['FI_AUTO_COGNEE_CHAT_V1','FI_SECURITY_PRIMARY_8789_V1',
    'FI_SOURCING_RETIRED_V1','FI_VOICE_MOBILE_DASHBOARD_V1',
    '/api/rea/call','/api/ai/tool-call','/api/ai/chat','/api/ai/automatic-memory/status']) {
    if(!source.includes(marker)) throw Error('COGNITION_PROTECTED_BASELINE_MISSING:'+marker);
  }
  if(!source.includes(MEMORY) || !source.includes('return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);') &&
       !source.includes('modelPayload:enriched.payload')) throw Error('COGNITION_EXISTING_CHAT_PIPELINE_UNKNOWN');
  let out=once(source,ROOT,
    'import {createLiveCognitionBridge} from "./cognition/live-bridge.mjs";\n'+
    '// '+MARK+'\n'+ROOT);
  const routes = [
    'const fiCognitive=createLiveCognitionBridge({',
    ' capabilityDefinitions:()=>openAiToolDefinitions([]),',
    ' serviceStatus:()=>platform.status()',
    '});',
    SERVER,
    ' // '+MARK+': data-only introspection and bounded cognitive operations.',
    ' if(req.url==="/api/cognition/status"&&req.method==="GET"){',
    '  if(!localRequest(req,res))return;',
    '  return json(res,200,await fiCognitive.liveStatus());',
    ' }',
    ' if(req.url==="/api/cognition/capabilities"&&req.method==="GET"){',
    '  if(!localRequest(req,res))return;',
    '  return json(res,200,fiCognitive.capabilities());',
    ' }',
    ' if(req.method==="POST"&&Object.hasOwn(fiCognitive.routes,req.url)){',
    '  if(!localRequest(req,res))return;',
    '  const data=await readBody(req,5000);',
    '  return json(res,200,fiCognitive.executeDataOperation(req.url,data));',
    ' }',
  ].join('\n');
  out=once(out,SERVER,routes);
  out=once(out,MEMORY, [
    'let enriched=await fiAutomaticMemory(body,memoryStatus().enabled);',
    ' // FI_COGNITIVE_CHAT_CONTEXT_V1: additive informational context, never tools.',
    ' try{enriched={...enriched,payload:fiCognitive.enrichChat(enriched.payload,body)};}',
    ' catch(_cognitiveError){/* no cognitive failure may break existing local AI chat */}'
  ].join('\n'));
  const priorCalls=(source.match(/fiAutomaticMemory\(body,memoryStatus\(\)\.enabled\)/g)||[]).length;
  const nextCalls=(out.match(/fiAutomaticMemory\(body,memoryStatus\(\)\.enabled\)/g)||[]).length;
  if(priorCalls !== 1 || nextCalls !== 1) throw Error('COGNITION_CHAT_DECORATION_COUNT_INVALID');
  for(const marker of ['FI_AUTO_COGNEE_CHAT_V1','FI_SECURITY_PRIMARY_8789_V1',
    'FI_VOICE_MOBILE_DASHBOARD_V1','/api/rea/call','/api/ai/tool-call',
    '/api/security/status','/api/ai/automatic-memory/status']) {
    if(!out.includes(marker)) throw Error('COGNITION_PROTECTED_ROUTE_LOST:'+marker);
  }
  return out;
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  try{
    const [input,output]=process.argv.slice(2);
    if(!input||!output||resolve(input)===resolve(output)) throw Error('COGNITION_STAGE_INPUT_OUTPUT_INVALID');
    const original=readFileSync(input,'utf8');
    writeFileSync(output,patchCognitiveLiveServer(original),'utf8');
    console.log('FUN_COGNITION_STAGE=PASS ORIGINAL_SERVER_UNCHANGED=TRUE');
  }catch(e){console.error('FUN_COGNITION_STAGE=HOLD '+String(e.message||e));process.exitCode=1;}
}
