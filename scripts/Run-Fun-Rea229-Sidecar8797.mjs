// FI_REAL_REA229_8797_SIDECAR_V1
// Owns an independent MCP session; does not modify, restart or stop 8789/8796.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createReaAdapter} from '../src/adapters/rea.mjs';
import {loadConfig} from '../src/config.mjs';
import {createFullReaRunner} from '../src/experimental/rea-full-229.mjs';
export const HOST='127.0.0.1',PORT=8797;
const ORIGIN='http://'+HOST+':'+PORT;
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const CLIENT=path.join(ROOT,'../src/experimental/rea229-client.js');
const PRIMARY=path.join(os.homedir(),'FunIndustrial-REA-MCP-Activation');
const LLAMA='http://127.0.0.1:8088/v1/chat/completions';
const PARENT='http://127.0.0.1:8789';
const CSP="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const HTML="<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"referrer\" content=\"no-referrer\"><title>Fun Industrial — REA 229 tools</title>\n<style>body{margin:0 auto;padding:24px;max-width:880px;background:#101922;color:#eaf1f8;font:15px system-ui;color-scheme:dark}main{display:grid;gap:14px}.panel{background:#172636;border:1px solid #31495d;border-radius:12px;padding:16px}h1{font-size:25px}h2{font-size:18px;margin-top:2px}textarea,input{display:block;width:100%;box-sizing:border-box;background:#0c1722;color:#eaf1f8;border:1px solid #49647a;border-radius:8px;padding:10px;margin:8px 0;min-height:36px}textarea{min-height:92px}button{margin:6px 6px 6px 0;padding:10px 13px;background:#d7e6f6;color:#142130;border:0;border-radius:7px;cursor:pointer;font-weight:bold}button:disabled{opacity:.6}.muted{color:#b3c7d9}.log{margin:7px 0;padding:8px 10px;background:#203548;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere}#rea-output{max-height:500px;overflow:auto}#rea-search-results{max-height:290px;overflow:auto}label{font-weight:600}</style>\n</head><body><main><h1>Fun Industrial · REA 229 MCP Tools</h1>\n<p class=\"muted\">Separate local session on port 8797. All 229 verified REA tools are addressable. These can perform real actions on your machine. The original REA connection on port 8789 and automatic local tools on 8796 remain separate. A task you start may execute multiple selected tools without further prompts.</p>\n<section class=\"panel\"><h2>Qwen chooses and executes REA tools</h2><label for=\"rea-task\">Your task</label><textarea id=\"rea-task\" maxlength=\"2000\" placeholder=\"Describe the actual REA task; the model retrieves relevant tool schemas automatically\"></textarea><button id=\"rea-run\" type=\"button\">Run selected REA tools</button></section>\n<section class=\"panel\"><h2>Search all 229 real tools</h2><label for=\"rea-search-text\">Search by capability or tool name</label><input id=\"rea-search-text\" placeholder=\"e.g. inspect Rust binary\"/><button id=\"rea-search\" type=\"button\">Find tools</button><div id=\"rea-search-results\"></div></section>\n<section class=\"panel\"><h2>Execute an exact REA tool</h2><p class=\"muted\">Choose a tool above, or enter its exact verified MCP name. Its JSON arguments must match that tool's input schema.</p><label for=\"rea-exact-name\">Exact MCP tool name</label><input id=\"rea-exact-name\" maxlength=\"150\"/><label for=\"rea-exact-args\">JSON arguments</label><textarea id=\"rea-exact-args\">{}</textarea><button id=\"rea-exact-run\" type=\"button\">Execute exact REA tool</button></section>\n<section class=\"panel\"><h2>Execution log</h2><p id=\"rea-state\" role=\"status\">Verifying independent MCP session…</p><div id=\"rea-output\"></div></section>\n</main><script defer src=\"/api/rea229/client.js\"></script></body></html>";
function write(res,status,data,type){
 const payload=typeof data==='string'?data:JSON.stringify(data);
 res.writeHead(status,{'content-type':type||'application/json; charset=utf-8',
  'cache-control':'no-store','content-security-policy':CSP,'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer'});
 res.end(payload);
}
function local(req){
 return req.headers.host===HOST+':'+PORT &&
  (!req.headers.origin||req.headers.origin===ORIGIN) &&
  (!req.headers['sec-fetch-site']||['none','same-origin'].includes(req.headers['sec-fetch-site']));
}
async function parse(req,limit=32000){
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
  throw Error('REA229_JSON_CONTENT_TYPE_REQUIRED');
 let raw='';
 for await(const chunk of req){raw+=chunk.toString('utf8');if(raw.length>limit)throw Error('REA229_REQUEST_TOO_LARGE')}
 try{
  const object=JSON.parse(raw);
  if(!object||typeof object!=='object'||Array.isArray(object))throw Error();
  return object;
 }catch{throw Error('REA229_REQUEST_JSON_OBJECT_REQUIRED')}
}
export function createRea229Server({runner,adapter,readClient=()=>readFile(CLIENT,'utf8')}={}){
 if(!runner||typeof runner.status!=='function'||typeof runner.list!=='function'||
  typeof runner.run!=='function'||typeof runner.callExact!=='function')
  throw Error('REA229_RUNNER_REQUIRED');
 if(!adapter||typeof adapter.health!=='function')throw Error('REA229_ADAPTER_REQUIRED');
 return http.createServer(async(req,res)=>{
  try{
   if(!local(req))return write(res,403,{error:'REA229_LOCAL_SAME_ORIGIN_REQUIRED'});
   const url=new URL(req.url,ORIGIN);
   if(req.method==='GET'&&url.pathname==='/')return write(res,200,HTML,'text/html; charset=utf-8');
   if(req.method==='GET'&&url.pathname==='/api/rea229/client.js')
    return write(res,200,await readClient(),'text/javascript; charset=utf-8');
   if(req.method==='GET'&&url.pathname==='/api/rea229/status'){
    const health=await adapter.health();
    return write(res,200,{...runner.status(),liveMcpHealth:health.state==='ready'?'ready':'not_ready'});
   }
   if(req.method==='GET'&&url.pathname==='/api/rea229/tools'){
    const health=await adapter.health();
    if(health.state!=='ready')return write(res,503,{error:'REA229_MCP_NOT_READY'});
    const query=url.searchParams.get('query')||'';
    const rawLimit=url.searchParams.get('limit')||'229';
    if(!/^[0-9]{1,3}$/.test(rawLimit))return write(res,400,{error:'REA229_INVALID_LIMIT'});
    return write(res,200,runner.list({query,limit:Number(rawLimit)}));
   }
   if(req.method==='POST'&&['/api/rea229/call','/api/rea229/run'].includes(url.pathname)){
    if(req.headers.origin!==ORIGIN||req.headers['x-fi-rea229']!=='operator-click')
     return write(res,403,{error:'REA229_OPERATOR_CLICK_ORIGIN_REQUIRED'});
    const health=await adapter.health();
    if(health.state!=='ready')return write(res,503,{error:'REA229_MCP_NOT_READY'});
    const body=await parse(req);
    if(url.pathname==='/api/rea229/call'){
     if(Object.keys(body).some(k=>!['name','arguments'].includes(k)))
      return write(res,400,{error:'REA229_UNEXPECTED_CALL_FIELDS'});
     return write(res,200,await runner.callExact(body));
    }
    if(Object.keys(body).some(k=>!['prompt','rounds'].includes(k)))
     return write(res,400,{error:'REA229_UNEXPECTED_RUN_FIELDS'});
    return write(res,200,await runner.run(body));
   }
   return write(res,404,{error:'REA229_ROUTE_NOT_FOUND'});
  }catch(error){
   const message=String(error?.message||error).slice(0,280);
   const status=/SESSION_BUSY/.test(message)?409:/TOOL_RESULT|MCP_NOT_READY/.test(message)?503:422;
   return write(res,status,{error:message});
  }
 });
}
async function getParentJson(endpoint){
 const response=await fetch(PARENT+endpoint,{headers:{host:'127.0.0.1:8789'},signal:AbortSignal.timeout(25000),redirect:'error'});
 if(!response.ok)throw Error('REA229_PARENT_HEALTH_HTTP_'+response.status+'_'+endpoint);
 return response.json();
}
async function parentSnapshot(){
 const [status,catalogue,registered,ai,cognition]=await Promise.all([
  getParentJson('/api/status'),getParentJson('/api/rea/catalog'),
  getParentJson('/api/ai/tools'),getParentJson('/api/ai/status'),
  getParentJson('/api/cognition/health')
 ]);
 const rea=(status.services||[]).filter(item=>item.id==='rea');
 const items=Array.isArray(catalogue.tools)?catalogue.tools:[];
 if(rea.length!==1||rea[0].state!=='ready'||items.length!==229||
  registered.local_tool_count!==19||registered.rea_tool_count!==229||
  ai.state!=='ready'||cognition.version!=='fi-cognitive-live-bridge-v1')
  throw Error('REA229_PARENT_229_READY_BASELINE_HOLD');
 return items.map(x=>x.name);
}
async function model(payload){
 const response=await fetch(LLAMA,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(180000),redirect:'error'});
 if(!response.ok)throw Error('REA229_LLAMA_HTTP_'+response.status);
 return response.json();
}
export async function activateRea229({expectedNames,envFile=path.join(PRIMARY,'.env'),
 infer=model,listen=true}={}){
 if(!Array.isArray(expectedNames)||expectedNames.length!==229)
  throw Error('REA229_PARENT_NAMES_REQUIRED');
 if(typeof process.loadEnvFile!=='function')throw Error('REA229_NODE_22_REQUIRED');
 process.loadEnvFile(envFile);
 const config=loadConfig({...process.env,APP_ROOT:PRIMARY});
 if(!config.rea.enabled)throw Error('REA229_CONFIG_DISABLED');
 if(!config.rea.command||!Array.isArray(config.rea.args))throw Error('REA229_CONFIG_INVALID');
 // Match the already-running parent command and its exact absolute installed REA entrypoint.
 const reaArgs=config.rea.args.map((arg,i)=>{
  if(i===0&&arg.endsWith('.mjs')&&!path.isAbsolute(arg))return path.resolve(PRIMARY,arg);
  return arg;
 });
 const adapter=createReaAdapter({...config.rea,args:reaArgs});
 const runner=createFullReaRunner({adapter,infer});
 try{
  await runner.initialize({expectedNames});
  const server=createRea229Server({runner,adapter});
  if(listen){
   await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(PORT,HOST,resolve);
   });
  }
  return {server,runner,adapter};
 }catch(error){
  await adapter.stop();
  throw error;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--serve'){
  console.log('FUN_REA229=INACTIVE. Explicit --serve required. Existing Fun Industrial processes unchanged.');
 }else{
  try{
   let active=null;
   try{
   const expectedNames=await parentSnapshot();
   active=await activateRea229({expectedNames});
   const confirm=await parentSnapshot();
   if(JSON.stringify(expectedNames.slice().sort())!==JSON.stringify(confirm.slice().sort()))
    throw Error('REA229_PARENT_CATALOGUE_CHANGED_AFTER_INDEPENDENT_START');
   console.log('FUN_REA229_READY='+ORIGIN+' REAL_REA_TOOLS=229 LOCAL_8789=UNCHANGED AUTO_8796=UNCHANGED');
   let closing=false;
   const end=async()=>{if(closing)return;closing=true;
    await new Promise(resolve=>active.server.close(resolve));
    await active.adapter.stop();process.exit(0);
   };
   process.on('SIGINT',()=>{end().catch(()=>process.exit(1))});
   process.on('SIGTERM',()=>{end().catch(()=>process.exit(1))});
   }catch(error){
    if(active){
     await new Promise(resolve=>active.server.close(resolve));
     await active.adapter.stop();
    }
    console.error('FUN_REA229_HOLD='+String(error?.message||error));
    process.exitCode=1;
   }
  }
 }
}
