// FI_AUTO_SIDECAR_8796_V1
// Operator-started read-only inspection + locally bounded AI tool execution.
// NEVER launches/stops the existing dashboard (8789), llama.cpp (8088),
// compute (8791), REA MCP, NetBird, or Ollama.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createAutoLocalDashboard} from '../src/experimental/auto-local-dashboard.mjs';

export const HOST='127.0.0.1';
export const PORT=8796;
const ORIGIN='http://'+HOST+':'+PORT;
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const CLIENT=path.resolve(ROOT,'../src/experimental/auto-local-client.js');
const page=String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Fun Industrial — Local Auto Tools</title>
<style>body{color-scheme:dark;margin:0;padding:25px;max-width:850px;margin-inline:auto;background:#0e141c;color:#eaf1f8;font:15px system-ui}section{padding:22px;border:1px solid #40566c;border-radius:12px;background:#172331}textarea{display:block;width:100%;box-sizing:border-box;min-height:110px;background:#0d1722;color:#eaf1f8;padding:12px;border:1px solid #40566c;border-radius:8px;font:14px system-ui}button{border:0;border-radius:8px;padding:12px 16px;margin-top:12px;background:#dce8f5;color:#182230;font-weight:700;cursor:pointer}button:disabled{opacity:.5}#fi-auto-output{margin-top:16px;max-height:500px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}#fi-auto-output>div{padding:10px 0;border-bottom:1px solid #40566c}#fi-auto-state{display:block;margin-top:10px;color:#aebccd}p{line-height:1.5;color:#b7c9d9}</style>
</head><body><h1>Fun Industrial</h1>
<section id="fi-auto-local-panel" aria-label="Automatic local AI tools">
<h2>Automatic Local Tools</h2>
<p>Runs one Qwen session through the existing Fun Industrial dashboard. Registered local tools may execute without individual prompts. The currently ready 229 REA MCP tools are preserved, but execution of REA tools is not enabled here.</p>
<label for="fi-auto-task">Task for Qwen</label>
<textarea id="fi-auto-task" maxlength="2000" placeholder="Describe a task for the local AI..."></textarea>
<button id="fi-auto-run" type="button">Run AI tools automatically</button>
<span id="fi-auto-state" role="status" aria-live="polite">Ready for operator-started task · no background work</span>
<div id="fi-auto-output" aria-live="polite"></div>
</section>
<script src="/api/ai/auto-local/client.js" defer></script>
</body></html>`;
const CSP="default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
function send(res,status,content,type,extra={}){
 res.writeHead(status,{'content-type':type,'cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'content-security-policy':CSP,...extra});
 res.end(content);
}
function json(res,status,value){return send(res,status,JSON.stringify(value),'application/json; charset=utf-8')}
function allowedHost(req){
 return req.headers.host===HOST+':'+PORT &&
  (!req.headers.origin||req.headers.origin===ORIGIN) &&
  (!req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']));
}
async function bodyJson(req){
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw Error('CONTENT_TYPE_REQUIRED');
 let body='';
 for await (const chunk of req){
  body+=chunk.toString('utf8');
  if(body.length>2500)throw Error('BODY_TOO_LARGE');
 }
 let parsed;
 try{parsed=JSON.parse(body)}catch{throw Error('JSON_INVALID')}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('OBJECT_REQUIRED');
 const keys=Object.keys(parsed);
 if(keys.length>2||keys.some(key=>!['prompt','rounds'].includes(key)))throw Error('UNEXPECTED_FIELDS');
 return parsed;
}
export function createAutoSidecarServer({dashboard=createAutoLocalDashboard(),readClient=()=>readFile(CLIENT,'utf8')}={}){
 if(typeof dashboard?.run!=='function'||typeof dashboard?.status!=='function')throw Error('SIDECAR_DASHBOARD_REQUIRED');
 return http.createServer(async(req,res)=>{
  try{
   if(!allowedHost(req))return json(res,403,{error:'LOCAL_SAME_ORIGIN_REQUIRED'});
   if(req.method==='GET'&&req.url==='/')return send(res,200,page,'text/html; charset=utf-8');
   if(req.method==='GET'&&req.url==='/api/ai/auto-local/client.js')
    return send(res,200,await readClient(),'text/javascript; charset=utf-8');
   if(req.method==='GET'&&req.url==='/api/ai/auto-local/status')
    return json(res,200,{...dashboard.status(),sidecar:true,port:PORT,
     parentDashboard:8789,parentProcessesPreserved:true});
   if(req.method==='POST'&&req.url==='/api/ai/auto-local/run'){
    if(req.headers.origin!==ORIGIN||req.headers['x-fi-auto-local']!=='operator-click')
     return json(res,403,{error:'OPERATOR_CLICK_ORIGIN_REQUIRED'});
    const task=await bodyJson(req);
    try{return json(res,200,await dashboard.run(task))}
    catch(error){
     const reason=String(error?.message||error).slice(0,200);
     return json(res,reason==='AUTO_DASH_CONCURRENT_SESSION'?409:422,{error:reason});
    }
   }
   return json(res,404,{error:'SIDECAR_ROUTE_NOT_FOUND'});
  }catch(error){
   return json(res,400,{error:String(error?.message||error).slice(0,200)});
  }
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--serve'){
  console.log('FUN_AUTO_SIDECAR=INACTIVE. Explicit --serve required. No 8789 services or REA processes touched.');
 }else{
  const server=createAutoSidecarServer();
  server.on('error',error=>{console.error('FUN_AUTO_SIDECAR_HOLD='+String(error.message));process.exitCode=1});
  server.listen(PORT,HOST,()=>console.log('FUN_AUTO_SIDECAR_READY='+ORIGIN+' PRESERVE_8789=true PRESERVE_REA=true'));
 }
}
