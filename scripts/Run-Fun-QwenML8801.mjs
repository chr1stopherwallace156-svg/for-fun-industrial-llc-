// FUN_INDUSTRIAL_QWEN_SCIKIT_V2_HTTP - isolated loopback-only service.
import http from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createMlQwen} from '../src/ml/qwen-ml-v2.mjs';

export const HOST='127.0.0.1', PORT=8801, ORIGIN='http://127.0.0.1:8801';
const CLIENT=new URL('../src/ml/qwen-ml-client-v2.js',import.meta.url);
const CSP="default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'";
const HTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>Fun Industrial · Qwen ML</title><style>body{max-width:880px;margin:20px auto;padding:16px;background:#0e1824;color:#e7f1f8;font:15px/1.5 system-ui}section{background:#172839;border:1px solid #375069;border-radius:13px;padding:16px;margin:14px 0}textarea,input{box-sizing:border-box;width:100%;padding:12px;border-radius:7px;background:#0b1620;border:1px solid #4d657a;color:#fff;font:15px monospace}textarea{min-height:210px}button{background:#9de5e0;color:#09202c;border:0;border-radius:8px;padding:12px;font-weight:bold;cursor:pointer}button:disabled{opacity:.5}pre{white-space:pre-wrap;overflow-wrap:anywhere}label{display:block;margin:8px 0}label input{width:auto}.muted{color:#abc0d1}</style></head><body><h1>Fun Industrial · Qwen + scikit-learn</h1><p class="muted">Standalone local machine-learning capability. Does not alter the original 8789/8798 dashboards or REA permissions.</p><section><p id="health">Checking local ML service…</p><label for="prompt">Task</label><input id="prompt" value="Analyze these deals and identify unusual prices and estimated profit" maxlength="1000"><label for="data">JSON dataset (8–250 deals, 16–1000 history records, or 1–100 prediction candidates)</label><textarea id="data" spellcheck="false">{"deals":[{"id":"sample0","cost":1,"sale_price":9,"shipping":1,"fees":0.8,"return_allowance":0.5},{"id":"sample1","cost":2,"sale_price":10,"shipping":1,"fees":0.8,"return_allowance":0.5},{"id":"sample2","cost":3,"sale_price":11,"shipping":1,"fees":0.8,"return_allowance":0.5},{"id":"sample3","cost":4,"sale_price":12,"shipping":1,"fees":0.8,"return_allowance":0.5},{"id":"sample4","cost":5,"sale_price":13,"shipping":1,"fees":0.8,"return_allowance":0.5},{"id":"sample5","cost":6,"sale_price":14,"shipping":1,"fees":0.8,"return_allowance":0.5},{"id":"sample6","cost":7,"sale_price":15,"shipping":1,"fees":0.8,"return_allowance":0.5},{"id":"sample7","cost":8,"sale_price":16,"shipping":1,"fees":0.8,"return_allowance":0.5}]}</textarea><label><input type="checkbox" id="approve"> I authorize saving or replacing a local sales model (training tasks only)</label><button id="run">Run verified ML task</button></section><section><h2>Result</h2><pre id="result" role="status" aria-live="polite">No task run yet.</pre></section><script src="/client.js" defer></script></body></html>';
function respond(res,status,data,type='application/json; charset=utf-8'){
  const body=type.startsWith('application/json')?JSON.stringify(data):data;
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer','content-security-policy':CSP,
    'x-frame-options':'DENY','content-length':Buffer.byteLength(body)});
  res.end(body);
}
async function readJson(req){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('CONTENT_TYPE_INVALID');
  let len=0,parts=[];
  for await(const part of req){
    len+=part.length;
    if(len>230000)throw Error('REQUEST_LIMIT');
    parts.push(part);
  }
  try{
    const obj=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error();
    if(Object.keys(obj).some(k=>!['prompt','data','operatorConfirmed'].includes(k)))throw Error();
    return obj;
  }catch{throw Error('REQUEST_SCHEMA_INVALID')}
}
export function createMlQwenServer({app=createMlQwen(),readClient=()=>readFile(CLIENT,'utf8')}={}){
  return http.createServer(async(req,res)=>{
    try{
      // Reject malformed Host and network access that does not use the bound local origin.
      if(![ORIGIN.slice(7),'localhost:8801'].includes(String(req.headers.host||''))){
        respond(res,403,{error:'HOST_DENIED'});return;
      }
      const url=new URL(req.url,ORIGIN);
      if(req.method==='GET'&&url.pathname==='/'){
        respond(res,200,HTML,'text/html; charset=utf-8');return;
      }
      if(req.method==='GET'&&url.pathname==='/client.js'){
        respond(res,200,await readClient(),'text/javascript; charset=utf-8');return;
      }
      if(req.method==='GET'&&url.pathname==='/api/ml/status'){
        respond(res,200,app.status());return;
      }
      if(req.method==='POST'&&url.pathname==='/api/ml/run'){
        if(req.headers.origin!==ORIGIN||req.headers['x-fi-ml']!=='operator-click'){
          respond(res,403,{error:'OPERATOR_ORIGIN_REQUIRED'});return;
        }
        const data=await readJson(req);
        respond(res,200,await app.run(data));return;
      }
      respond(res,404,{error:'ROUTE_NOT_FOUND'});
    }catch(e){
      const message=String(e?.message||e).slice(0,220);
      respond(res,(/BUSY/.test(message)?409:422),{error:message});
    }
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3||process.argv[2]!=='--serve'){
    console.log('FUN_QWEN_ML=INACTIVE; --serve required. No services touched.');
  }else{
    const server=createMlQwenServer();
    server.on('error',e=>{console.error('FUN_QWEN_ML_HOLD='+String(e.message));process.exitCode=1});
    server.listen(PORT,HOST,()=>console.log('FUN_QWEN_ML_READY='+ORIGIN+' NO_OTHER_SERVICES_TOUCHED=TRUE'));
  }
}
