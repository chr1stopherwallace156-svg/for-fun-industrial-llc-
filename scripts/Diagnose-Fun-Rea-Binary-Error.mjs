// FI_REA_BINARY_ERROR_DIAGNOSTIC_V1
// Operator starts one independent MCP session, calls one read-only binary_session
// summary, captures MCP isError diagnostic, then closes ONLY this temporary child.
// No model calls, server patching, listener startup, or parent process restarts.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createReaAdapter} from '../src/adapters/rea.mjs';
import {loadConfig} from '../src/config.mjs';

export const PRIMARY=path.join(os.homedir(),'FunIndustrial-REA-MCP-Activation');
const PARENT='http://127.0.0.1:8789';
const EXECUTOR='http://127.0.0.1:8797';
const MAX=229;
const clip=(x,n=3000)=>String(x??'').slice(0,n);
function hold(code){throw Error('REA_BINARY_DIAGNOSTIC_'+code)}
function sameNames(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==MAX||b.length!==MAX)return false;
 const unique=x=>new Set(x).size===MAX&&x.every(n=>typeof n==='string'&&n.length>0);
 return unique(a)&&unique(b)&&JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
}
function parsedError(response){
 const parts=Array.isArray(response?.content)?response.content:[];
 let obj;
 let raw='';
 for(const entry of parts){
  if(entry?.type!=='text'||typeof entry.text!=='string')continue;
  raw=clip(entry.text,5000);
  try{const value=JSON.parse(entry.text);if(value&&typeof value==='object'&&!Array.isArray(value)){obj=value;break}}catch{}
 }
 const problem=obj?.error&&typeof obj.error==='object'?obj.error:obj||{};
 return {
  code:clip(problem.code||problem.reason||problem.type||'UNSPECIFIED',160),
  message:clip(problem.message||problem.summary||raw||'No MCP diagnostic text returned',1500),
  details:clip(JSON.stringify(problem.details??{}),2400),
  remediation:clip(JSON.stringify(problem.remediation??problem.recovery??null),1700),
  rawExcerpt:clip(raw,4200)
 };
}
export async function diagnoseBinarySession({adapter,expectedNames,write=()=>{}}={}){
 if(!adapter||typeof adapter.start!=='function'||typeof adapter.stop!=='function'||
  typeof adapter.callTool!=='function'||typeof adapter.tools!=='function'||typeof adapter.health!=='function')
  hold('ADAPTER_MISSING');
 if(!Array.isArray(expectedNames)||expectedNames.length!==MAX||!expectedNames.includes('binary_session'))
  hold('VERIFIED_PARENT_229_WITH_BINARY_SESSION_REQUIRED');
 let initialized=false;
 try{
  const st=await adapter.start();
  if(st?.state!=='ready'||st.tool_count!==MAX)hold('INDEPENDENT_MCP_NOT_READY_229');
  initialized=true;
  if((await adapter.health()).state!=='ready')hold('INDEPENDENT_MCP_HEALTH_NOT_READY');
  const actual=adapter.tools();
  if(!Array.isArray(actual)||!sameNames(expectedNames,actual.map(t=>t.name)))
   hold('INDEPENDENT_CATALOGUE_NAME_MISMATCH');
  const tool=actual.find(t=>t.name==='binary_session');
  if(tool?.inputSchema?.type!=='object')hold('BINARY_SESSION_SCHEMA_MISSING');
  write('DIAGNOSTIC_TEMPORARY_MCP=READY TOOL_COUNT=229');
  const args={detail:'summary',refresh_candidates:false};
  write('DIAGNOSTIC_CALL=binary_session ARGS='+JSON.stringify(args));
  // Exactly one tools/call. NO retries regardless of outcome.
  const res=await adapter.callTool('binary_session',args);
  if(res?.tool!=='binary_session')hold('CALL_RESPONSE_NAME_MISMATCH');
  const isError=res.result?.isError===true;
  const info=isError?parsedError(res.result):null;
  write('REA_BINARY_SESSION_MCP_RESULT='+String(isError?'IS_ERROR':'SUCCESS'));
  if(info){
   write('REA_MCP_ERROR_CODE='+info.code);
   write('REA_MCP_ERROR_MESSAGE='+info.message);
   write('REA_MCP_ERROR_DETAILS='+info.details);
   write('REA_MCP_ERROR_REMEDIATION='+info.remediation);
   write('REA_MCP_ERROR_RAW_EXCERPT='+info.rawExcerpt);
  }else{
   write('REA_MCP_SUCCESS_CONTENT='+clip(JSON.stringify(res.result?.structuredContent??res.result?.content??null),5000));
  }
  return {state:isError?'mcp_tool_error_captured':'mcp_tool_success_in_fresh_session',
   callCount:1,error:info};
 }finally{
  // Only adapter owned by this function is stopped.
  await adapter.stop();
  write('DIAGNOSTIC_TEMPORARY_MCP_STOPPED=TRUE');
 }
}
async function fetchJson(url){
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!response.ok)hold('BASELINE_HTTP_'+String(response.status));
 return response.json();
}
export async function liveSnapshot(){
 const [status,listing,platform]=await Promise.all([
  fetchJson(EXECUTOR+'/api/rea229/status'),
  fetchJson(EXECUTOR+'/api/rea229/tools?limit=229'),
  fetchJson(PARENT+'/api/status')
 ]);
 const rea=(Array.isArray(platform.services)?platform.services:[]).filter(s=>s.id==='rea');
 const tools=Array.isArray(listing.tools)?listing.tools:[];
 if(status.liveMcpHealth!=='ready'||status.realReaToolCount!==MAX||
  rea.length!==1||rea[0].state!=='ready'||tools.length!==MAX)
  hold('PARENT_MCP_BASELINE_CHANGED');
 const names=tools.map(t=>t.name);
 if(!names.includes('binary_session')||new Set(names).size!==MAX)
  hold('BINARY_SESSION_NOT_VERIFIED_IN_PARENT_229');
 return names;
}
function createInstalledAdapter(){
 if(typeof process.loadEnvFile!=='function')hold('NODE_LOAD_ENV_REQUIRED');
 const envFile=path.join(PRIMARY,'.env');
 process.loadEnvFile(envFile);
 const config=loadConfig({...process.env,APP_ROOT:PRIMARY});
 if(!config.rea.enabled||!config.rea.command||!Array.isArray(config.rea.args))
  hold('REA_INSTALLED_CONFIGURATION_UNAVAILABLE');
 const args=config.rea.args.map((arg,i)=>
  i===0&&arg.endsWith('.mjs')&&!path.isAbsolute(arg)?path.resolve(PRIMARY,arg):arg
 );
 return createReaAdapter({...config.rea,args});
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 if(process.argv.length!==3||process.argv[2]!=='--inspect-error'){
  console.log('REA_BINARY_DIAGNOSTIC=INACTIVE. Explicit --inspect-error required; no processes touched.');
 }else{
  const cwd=process.cwd();
  let diagnostic=null;
  try{
   const before=await liveSnapshot();
   process.chdir(PRIMARY);
   const adapter=createInstalledAdapter();
   diagnostic=await diagnoseBinarySession({adapter,expectedNames:before,write:msg=>console.log(msg)});
   const after=await liveSnapshot();
   if(!sameNames(before,after))hold('PARENT_NAMES_CHANGED_AFTER_DIAGNOSTIC');
   console.log('PARENT_8789=REA_READY ORIGINAL_8797=REA_READY CATALOGUE_229_UNCHANGED=TRUE');
   console.log('REA_BINARY_DIAGNOSTIC='+diagnostic.state.toUpperCase()+' CALL_COUNT='+diagnostic.callCount);
  }catch(error){
   console.error('REA_BINARY_DIAGNOSTIC_HOLD='+clip(error?.message||error,300));
   process.exitCode=1;
  }finally{process.chdir(cwd)}
 }
}
