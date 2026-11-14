// FI_FUN_ML_UNIFIED_DASHBOARD_V3 — merge existing dashboard and unified chat
// by safe fixed-port loopback proxy. No existing process is stopped or modified.
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {createMlDashboardBridge,ML_WIDGET,mlDashboardOriginAccepted,parseMlDashboardBody} from '../src/ml/dashboard-ml-proxy-v3.mjs';

export const HOST='127.0.0.1',PORT=8802,ORIGIN='http://127.0.0.1:8802';
const MAX_PAGE=240000,MAX_PROXY=12*1024*1024;
const NAV='<nav id="fi-hub-nav" style="position:relative;z-index:1;padding:12px 14px;margin:10px 0 16px;border:1px solid #52718a;border-radius:9px;background:#1b3445;color:white;font:14px system-ui"><strong>Fun Industrial Integrated Dashboard</strong> · <a style="color:#a6f4e8" href="/">Control Center</a> · <a style="color:#a6f4e8" href="/unified/">Unified Qwen Chat</a> · <a style="color:#a6f4e8" href="#fi-ml-panel">Machine Learning</a> <span style="display:block;font-size:12px;color:#c6d7e5">Current services remain on original ports; ML uses verified 8801 capability.</span></nav>';
const DEALS=JSON.stringify({deals:Array.from({length:8},(_,i)=>({id:'demo'+i,cost:i+1,sale_price:i+9,shipping:1,fees:0.8,return_allowance:0.5}))});
const PANEL='<section id="fi-ml-panel" style="box-sizing:border-box;margin:18px auto;padding:17px;max-width:1100px;background:#152a3a;border:1px solid #4e7087;border-radius:12px;color:#e6f4fc;font:14px/1.5 system-ui"><h2 style="font-size:19px;margin:0 0 6px">scikit-learn + Qwen · E-commerce intelligence</h2><p id="fi-ml-status">Checking local ML bridge…</p><p>Run deal analysis or sales predictions using supplied JSON. Example values are synthetic, not verified prices.</p><label for="fi-ml-prompt">ML task</label><input id="fi-ml-prompt" style="box-sizing:border-box;display:block;width:100%;padding:10px;margin:5px 0 10px;background:#0c1825;color:#fff;border:1px solid #537187;border-radius:7px" maxlength="1000" value="Analyze deals and rank estimated profit"><label for="fi-ml-data">Structured product or sales data</label><textarea id="fi-ml-data" spellcheck="false" style="box-sizing:border-box;display:block;width:100%;min-height:150px;margin:5px 0 8px;padding:10px;background:#0c1825;color:#fff;border:1px solid #537187;border-radius:7px;font:12px monospace">'+DEALS+'</textarea><label style="display:block;margin-bottom:8px"><input id="fi-ml-train-approve" type="checkbox"> Approve writing or replacing the local sales model (training only)</label><button id="fi-ml-run" style="padding:10px 12px;background:#a2e7e2;border:0;border-radius:7px;color:#09202c;font-weight:bold">Run verified ML task</button><pre id="fi-ml-result" style="white-space:pre-wrap;overflow-wrap:anywhere;padding:9px;background:#0c1825;margin-top:12px;max-height:440px;overflow:auto">No analysis run.</pre></section>';
export function integrateDashboardHtml(html,widget,{unified=false}={}){
  if(typeof html!=='string'||!/<body[^>]*>/i.test(html)||!/<\/body>/i.test(html)||
    typeof widget!=='string'||widget.length<100||widget.length>20000||
    /<\/script/i.test(widget))throw Error('ML_HUB_HTML_INJECTION_INVALID');
  const insertion=PANEL+(unified?'<script src="/api/ml/dashboard/widget.js" defer></script>':'<script>'+widget+'</script>');
  return html.replace(/(<body[^>]*>)/i,'$1'+NAV).replace(/<\/body>/i,insertion+'</body>');
}
function send(res,status,body,type='application/json; charset=utf-8',extra={}){
  const bytes=Buffer.isBuffer(body)?body:Buffer.from(typeof body==='string'?body:JSON.stringify(body));
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra,'content-length':bytes.length});
  res.end(bytes);
}
async function pageFrom(port){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6000);
  try{
    const response=await fetch('http://127.0.0.1:'+port+'/',{method:'GET',redirect:'error',signal:ctl.signal});
    if(!response.ok||!String(response.headers.get('content-type')).includes('text/html'))throw Error('ML_HUB_PAGE_UPSTREAM_UNAVAILABLE_'+port);
    const size=Number(response.headers.get('content-length'));
    if(size>MAX_PAGE)throw Error('ML_HUB_PAGE_OVERSIZE');
    const chunks=[];let n=0;
    for await(const chunk of response.body){
      n+=chunk.length;if(n>MAX_PAGE)throw Error('ML_HUB_PAGE_OVERSIZE');chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }finally{clearTimeout(timer)}
}
function proxyTo(req,res,port){
  return new Promise((done)=>{
    let size=0,finished=false;const chunks=[];
    req.on('data',c=>{
      size+=c.length;
      if(size>MAX_PROXY){req.destroy();if(!res.headersSent)send(res,413,{error:'ML_HUB_REQUEST_LIMIT'});finished=true;done();}
      else chunks.push(c);
    });
    req.once('error',()=>{if(!finished){finished=true;try{send(res,400,{error:'ML_HUB_REQUEST_ABORTED'})}catch{}done()}});
    req.once('end',()=>{
      if(finished)return;
      const b=Buffer.concat(chunks);
      const headers={host:'127.0.0.1:'+port,origin:'http://127.0.0.1:'+port,
        'content-length':String(b.length)};
      const ct=req.headers['content-type'];
      if(typeof ct==='string')headers['content-type']=ct;
      if(port===8798&&req.headers['x-fi-unified']==='operator-click')headers['x-fi-unified']='operator-click';
      const up=http.request({hostname:'127.0.0.1',port,method:req.method,path:req.url,headers,timeout:120000},response=>{
        const data=[];let total=0;
        response.on('data',chunk=>{
          total+=chunk.length;
          if(total>MAX_PROXY){up.destroy();if(!res.headersSent)send(res,502,{error:'ML_HUB_UPSTREAM_RESPONSE_LIMIT'});finished=true;done();}
          else data.push(chunk);
        });
        response.on('end',()=>{
          if(finished)return;
          finished=true;
          const type=String(response.headers['content-type']||'application/json; charset=utf-8');
          const extras={};
          if(response.headers['content-security-policy'])extras['content-security-policy']=response.headers['content-security-policy'];
          send(res,response.statusCode||502,Buffer.concat(data),type,extras);done();
        });
      });
      up.on('timeout',()=>up.destroy(Error('ML_HUB_PROXY_TIMEOUT')));
      up.once('error',()=>{if(!finished){finished=true;if(!res.headersSent)send(res,502,{error:'ML_HUB_UPSTREAM_UNAVAILABLE'});done()}});
      up.end(b);
    });
  });
}
function acceptedHost(req){
  return ['127.0.0.1:8802','localhost:8802'].includes(String(req.headers.host||''));
}
function acceptedActionOrigin(req){
  return ['http://127.0.0.1:8802','http://localhost:8802'].includes(String(req.headers.origin||''));
}
export function createUnifiedMlHub({ml=createMlDashboardBridge(),readPage=pageFrom,proxy=proxyTo,readWidget=()=>readFile(ML_WIDGET,'utf8')}={}){
  return http.createServer(async(req,res)=>{
    try{
      if(!acceptedHost(req))return send(res,403,{error:'ML_HUB_HOST_DENIED'});
      const u=new URL(req.url,ORIGIN);
      if(u.search||u.pathname.includes('..'))return send(res,400,{error:'ML_HUB_INVALID_PATH'});
      if(req.method==='GET'&&['/','/unified/'].includes(u.pathname)){
        const unified=u.pathname==='/unified/';
        const source=await readPage(unified?8798:8789);
        const html=integrateDashboardHtml(source,await readWidget(),{unified});
        const csp=unified?"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'":
          "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'";
        return send(res,200,html,'text/html; charset=utf-8',{'content-security-policy':csp});
      }
      if(req.method==='GET'&&u.pathname==='/api/ml/dashboard/widget.js'){
        return send(res,200,await readWidget(),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/ml/dashboard/status')
        return send(res,200,await ml.status());
      if(req.method==='POST'&&u.pathname==='/api/ml/dashboard/run'){
        if(!mlDashboardOriginAccepted(req,PORT))return send(res,403,{error:'ML_HUB_OPERATOR_ORIGIN_REQUIRED'});
        if(!String(req.headers['content-type']||'').startsWith('application/json'))
          return send(res,415,{error:'ML_HUB_JSON_REQUIRED'});
        const body=await parseMlDashboardBody(req);
        return send(res,200,await ml.run(body));
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/hub/status'){
        const value=await ml.status();
        return send(res,200,{version:'fi-ml-hub-v3',state:'ready',machineLearning:value,
          existingServicesUnmodified:true,reaApprovalUnchanged:true,port:PORT});
      }
      if(u.pathname.startsWith('/api/')&&['GET','POST'].includes(req.method)){
        if(req.method==='POST'&&!acceptedActionOrigin(req))return send(res,403,{error:'ML_HUB_ORIGIN_REQUIRED'});
        if(u.pathname.startsWith('/api/ml/'))return send(res,404,{error:'ML_HUB_ML_ROUTE_UNKNOWN'});
        return proxy(req,res,u.pathname.startsWith('/api/unified/')?8798:8789);
      }
      return send(res,404,{error:'ML_HUB_ROUTE_UNKNOWN'});
    }catch(e){
      if(!res.headersSent)send(res,/REQUEST_TOO_LARGE|OVERSIZE/.test(String(e.message))?413:422,
        {error:String(e?.message||e).slice(0,240)});
    }
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3||process.argv[2]!=='--serve')
    console.log('FUN_ML_HUB=INACTIVE; explicit --serve required');
  else{
    const server=createUnifiedMlHub();
    server.on('error',e=>{console.error('FUN_ML_HUB_HOLD='+e.message);process.exitCode=1});
    server.listen(PORT,HOST,()=>console.log('FUN_ML_HUB_READY='+ORIGIN+' PROTECTED_SERVICES=UNTOUCHED'));
  }
}
