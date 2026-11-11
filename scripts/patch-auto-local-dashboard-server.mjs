// FI_AUTO_LOCAL_DASHBOARD_PATCH_V1 — stage-only, preservation of existing dashboard.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const MARK='FI_AUTO_LOCAL_DASHBOARD_PATCH_V1';
const ROOT='const root=path.dirname(fileURLToPath(import.meta.url));';
const SERVER='const server=http.createServer(async(req,res)=>{try{';
const IMPORT='import {createAutoLocalDashboard} from "./experimental/auto-local-dashboard.mjs";';
function replaceOnce(source,old,replacement){
 if(source.split(old).length!==2)throw Error('AUTO_DASH_PATCH_ANCHOR_NOT_UNIQUE_'+old.slice(0,90));
 return source.replace(old,()=>replacement);
}
export function patchAutoLocalDashboardServer(source){
 if(typeof source!=='string'||source.includes(MARK))throw Error('AUTO_DASH_ALREADY_INSTALLED_OR_INVALID');
 for(const required of ['FI_COGNITIVE_LIVE_PATCH_V1','FI_CAPABILITY_INDEX_LIVE_V1',
 'FI_AUTO_COGNEE_CHAT_V1','FI_VOICE_MOBILE_DASHBOARD_V1',
 '/api/cognition/catalogue/status','/api/ai/tool-call','/api/rea/call',
 '/api/ai/automatic-memory/status','/api/cognition/health']){
  if(!source.includes(required))throw Error('AUTO_DASH_BASELINE_MISSING_'+required);
 }
 if(!source.includes('import {readFile}') || !source.includes('const root=path.dirname('))throw Error('AUTO_DASH_FILE_SERVE_BASELINE_UNEXPECTED');
 let out=replaceOnce(source,ROOT,IMPORT+'\n// '+MARK+'\n'+ROOT);
 const injection=[
  'const fiAutoLocalDashboard=createAutoLocalDashboard();',
  SERVER,
  ' // '+MARK+': independently served CSP-compatible script; same-origin only.',
  ' if(req.method==="GET"&&req.url==="/api/ai/auto-local/client.js"){',
  '  if(!localRequest(req,res))return;',
  '  const script=await readFile(path.join(root,"experimental","auto-local-client.js"));',
  '  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});',
  '  return res.end(script);',
  ' }',
  ' // '+MARK+': only explicit operator-click starts an automatic local session.',
  ' if(req.method==="GET"&&req.url==="/api/ai/auto-local/status"){',
  '  if(!localRequest(req,res))return;',
  '  return json(res,200,fiAutoLocalDashboard.status());',
  ' }',
  ' if(req.method==="POST"&&req.url==="/api/ai/auto-local/run"){',
  '  if(!localRequest(req,res))return;',
  '  if(!await requireVpnGate(res))return;',
  '  const body=await readBody(req,2500);',
  '  try{return json(res,200,await fiAutoLocalDashboard.run(body));}',
  '  catch(e){',
  '   const msg=String(e.message||e).slice(0,220);',
  '   return json(res,msg==="AUTO_DASH_CONCURRENT_SESSION"?409:422,{error:msg});',
  '  }',
  ' }'
 ].join('\n');
 out=replaceOnce(out,SERVER,injection);
 for(const marker of ['FI_COGNITIVE_LIVE_PATCH_V1','FI_CAPABILITY_INDEX_LIVE_V1',
 '/api/ai/automatic-memory/status','/api/ai/tool-call','/api/rea/call',
 '/api/cognition/status','/api/cognition/catalogue/search']){
  if(!out.includes(marker))throw Error('AUTO_DASH_PROTECTED_ROUTE_LOST_'+marker);
 }
 if((out.match(/fiAutomaticMemory\(body,memoryStatus\(\)\.enabled\)/g)||[]).length!==1)
  throw Error('AUTO_DASH_MEMORY_PIPELINE_CHANGED');
 return out;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output))throw Error('AUTO_DASH_SOURCE_PATHS_INVALID');
  writeFileSync(output,patchAutoLocalDashboardServer(readFileSync(input,'utf8')),'utf8');
  console.log('FUN_AUTO_DASH_SERVER_STAGE=PASS ORIGINAL_UNCHANGED=TRUE');
 }catch(error){
  console.error('FUN_AUTO_DASH_SERVER_STAGE=HOLD '+String(error.message||error));
  process.exitCode=1;
 }
}
