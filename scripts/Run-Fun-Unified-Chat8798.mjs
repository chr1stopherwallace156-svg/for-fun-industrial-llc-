// FI_UNIFIED_TASK_CHAT_HTTP_8798_V1
// Standalone loopback server. Never starts, stops or modifies existing services.
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
export const HOST='127.0.0.1',PORT=8798;
const ORIGIN='http://127.0.0.1:8798';
const CLIENT=new URL('../src/experimental/unified-task-client.js',import.meta.url);
const CSP="default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const HTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="dark"><title>Fun Industrial | Unified Task Chat</title><style>'+
':root{color-scheme:dark}*{box-sizing:border-box}body{background:#0b1420;color:#eaf3fb;font:15px/1.6 system-ui,sans-serif;margin:0;padding:22px}main{max-width:860px;margin:auto;display:grid;gap:16px}header{border-bottom:1px solid #35506c;padding-bottom:12px}h1{font-size:24px;margin:0}h2{font-size:16px;margin:0}p{margin:.4em 0;color:#bacddd}.panel{border:1px solid #364e67;border-radius:14px;background:#152437;padding:18px}#history{min-height:220px;max-height:56vh;overflow:auto;display:grid;gap:10px}article{border:1px solid #304860;border-radius:10px;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere}article.you{background:#203a51}article.assistant{background:#122d36}article.error{background:#39262a}small,.muted{color:#a5bfd5}textarea{width:100%;min-height:105px;background:#0b1926;color:white;padding:12px;border:1px solid #456178;border-radius:9px;font:16px system-ui}button{background:#9fe4e6;color:#101c29;border:none;border-radius:8px;padding:11px 15px;font:700 14px system-ui;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}.actions{display:flex;gap:8px;flex-wrap:wrap}label{display:block;margin:8px 0}input[type=checkbox]{margin-right:8px}#action-review{display:none;border-top:1px solid #405870;margin-top:12px;padding-top:12px}#action-review.open{display:block}.status{font-size:13px;color:#b9d7e1}#event-log{max-height:140px;overflow:auto;font:12px monospace;white-space:pre-wrap;overflow-wrap:anywhere}button:focus-visible,textarea:focus-visible{outline:2px solid #f2db80;outline-offset:2px}'+
'</style></head><body><main><header><h1>Fun Industrial · Unified Task Chat</h1><p>One chat for public websites, game/app feasibility, REA session inspection, Qwen explanations and reviewed local compute actions.</p><div id="service-status" role="status" class="status">Checking existing services…</div></header>'+
'<section class="panel"><h2>Conversation</h2><div id="history" aria-live="polite"><article class="assistant">Describe a website, app, game, engineering question, or local task. I’ll identify what can be checked and clearly report what actually ran.</article></div></section>'+
'<section class="panel"><label for="task">Your request</label><textarea id="task" maxlength="2200" placeholder="Analyze https://example.org and summarize its static page text, or ask if Warzone can run on iPhone, or inspect REA MCP session status"></textarea><div class="actions"><button type="button" id="send">Send to Qwen</button></div>'+
'<div id="action-review"><p><strong>Tool execution requires a separate explicit decision.</strong> This may modify local computation or other registered local tool state. Review the request before authorizing.</p><label><input type="checkbox" id="local-consent">I authorize this one local-tools session for the request above</label><button type="button" id="local-execute" disabled>Execute reviewed tools</button></div></section>'+
'<section class="panel"><h2>Execution evidence</h2><div id="event-log"></div><p class="muted">Read-only tasks may run after you send. Local tools require a separate review. No background operation, automatic downloads, arbitrary shell, or DRM/anti-cheat bypass.</p></section><script src="/api/unified/client.js" defer></script></main></body></html>';
function send(res,status,value,type='application/json; charset=utf-8'){
 const data=typeof value==='string'?value:JSON.stringify(value);
 res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':CSP});
 res.end(data);
}
async function body(req){
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw Error('CONTENT_TYPE_REQUIRED');
 let raw='';
 for await(const chunk of req){raw+=chunk.toString('utf8');if(raw.length>5500)throw Error('REQUEST_TOO_LARGE')}
 let b;try{b=JSON.parse(raw)}catch{throw Error('JSON_INVALID')}
 if(!b||typeof b!=='object'||Array.isArray(b))throw Error('JSON_OBJECT_REQUIRED');
 return b;
}
export function createUnifiedChatServer({app=createUnifiedTaskChat(),readClient=()=>readFile(CLIENT,'utf8')}={}){
 if(typeof app?.status!=='function'||typeof app?.chat!=='function'||typeof app?.executeLocal!=='function'||typeof app?.executeRea!=='function')
  throw Error('UNIFIED_APP_REQUIRED');
 return http.createServer(async(req,res)=>{
  try{
   if(req.headers.host!=='127.0.0.1:8798'||(req.headers.origin&&req.headers.origin!==ORIGIN)||
     (req.headers['sec-fetch-site']&&!['none','same-origin'].includes(req.headers['sec-fetch-site'])))
    return send(res,403,{error:'UNIFIED_LOCAL_SAME_ORIGIN_REQUIRED'});
   const u=new URL(req.url,ORIGIN);
   if(req.method==='GET'&&u.pathname==='/'&&!u.search)return send(res,200,HTML,'text/html; charset=utf-8');
   if(req.method==='GET'&&u.pathname==='/api/unified/client.js'&&!u.search)return send(res,200,await readClient(),'text/javascript; charset=utf-8');
   if(req.method==='GET'&&u.pathname==='/api/unified/status'&&!u.search)return send(res,200,await app.status());
   if(req.method==='POST'&&['/api/unified/chat','/api/unified/local/execute','/api/unified/rea/execute'].includes(u.pathname)&&!u.search){
    if(req.headers.origin!==ORIGIN||req.headers['x-fi-unified']!=='operator-click')
     return send(res,403,{error:'UNIFIED_CLICK_ORIGIN_REQUIRED'});
    const data=await body(req);
    if(u.pathname==='/api/unified/chat'){
     if(Object.keys(data).some(k=>k!=='prompt'))throw Error('CHAT_FIELDS_NOT_ALLOWED');
     return send(res,200,await app.chat(data));
    }
    if(Object.keys(data).some(k=>!['prompt','operatorConfirmed'].includes(k)))throw Error('ACTION_EXECUTE_FIELDS_NOT_ALLOWED');
    return send(res,200,u.pathname==='/api/unified/rea/execute'?await app.executeRea(data):await app.executeLocal(data));
   }
   return send(res,404,{error:'UNIFIED_ROUTE_NOT_FOUND'});
  }catch(error){
   const message=String(error?.message||error).slice(0,230);
   return send(res,/BUSY/.test(message)?409:422,{error:message});
  }
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--serve'){
  console.log('FUN_UNIFIED_CHAT=INACTIVE. Explicit --serve required. Running services unchanged.');
 }else{
  const server=createUnifiedChatServer();
  server.on('error',err=>{console.error('FUN_UNIFIED_CHAT_HOLD='+String(err.message));process.exitCode=1});
  server.listen(PORT,HOST,()=>console.log('FUN_UNIFIED_CHAT_READY='+ORIGIN+' ORIGINAL_SERVICES_UNCHANGED=TRUE'));
 }
}
