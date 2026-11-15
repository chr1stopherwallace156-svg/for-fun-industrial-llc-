// FI_FUN_ML_UNIFIED_DASHBOARD_V3 — merge existing dashboard and unified chat
// by safe fixed-port loopback proxy. No existing process is stopped or modified.
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {createMlDashboardBridge,ML_WIDGET,mlDashboardOriginAccepted,parseMlDashboardBody,validateDashboardMlPayload} from '../src/ml/dashboard-ml-proxy-v3.mjs';
import {createCommerceIntelligence} from '../src/commerce/trends-commerce-v1.mjs';
import {rankCommerceOpportunities} from '../src/commerce/opportunity-ranking-v1-1.mjs';
import {buildTrendsFocus} from '../src/commerce/google-trends-focus-v1-2.mjs';
import {SHELL,UI_CSS,UI_CLIENT} from '../src/ui/integrated-hub-shell-v1.mjs';
import {readFial4DashboardStatus} from '../src/fial/dashboard-status-v4.mjs';
import {createGroundedChat} from '../src/fial/grounded-chat-v5-2.mjs';
import {GROUNDED_PANEL,GROUNDED_CLIENT,GROUNDED_VERSION} from '../src/fial/primary-grounded-ui-v5-3.mjs';
import {readExecutiveStatus} from '../src/operator/executive-ops-v1.mjs';
import {EXEC_PAGE,EXEC_CLIENT,EXEC_CONSOLE_VERSION} from '../src/operator/executive-console-v1.mjs';
import {readRealStatus,VERSION as REAL_VERSION} from '../src/operator/real-operations-v5-5.mjs';
import {readBusinessCompetenceStatus,OPERATOR_VERSION} from '../src/competence/business-operator-v5-6.mjs';
import {readOutcomeStatus,VERSION as OUTCOME_VERSION} from '../src/outcomes/outcome-engine-v5-7.mjs';
import {readRegulatoryStatus,VERSION as REG_VERSION} from '../src/regulatory/intelligence-engine-v5-8.mjs';
import {readFleetStatus,VERSION as FLEET_VERSION,verifyPublicFleetReport} from '../src/fleet/fleet-engine-v5-9.mjs';
import {planBusinessDecision} from '../src/competence/business-knowledge-v5-6.mjs';
import {calculateFinancials} from '../src/competence/business-finance-v5-6.mjs';
import {reviewBusinessWriting} from '../src/competence/business-writing-v5-6.mjs';
const REAL_WIDGET=new URL('../src/operator/real-operations-widget-v5-5.js',import.meta.url);
const BUSINESS_CLIENT=new URL('../src/competence/business-console-v5-6.js',import.meta.url);
const OUTCOME_CLIENT=new URL('../src/outcomes/outcome-console-v5-7.js',import.meta.url);
const REG_CLIENT=new URL('../src/regulatory/regulatory-console-v5-8.js',import.meta.url);
const FLEET_CLIENT=new URL('../src/fleet/fleet-console-v5-9.js',import.meta.url);

export const HOST='127.0.0.1',PORT=8802,ORIGIN='http://127.0.0.1:8802';
const MAX_PAGE=240000,MAX_PROXY=12*1024*1024;
const NAV='<nav id="fi-hub-nav" style="position:relative;z-index:1;padding:12px 14px;margin:10px 0 16px;border:1px solid #52718a;border-radius:9px;background:#1b3445;color:white;font:14px system-ui"><strong>Fun Industrial Integrated Dashboard</strong> · <a style="color:#a6f4e8" href="/">Control Center</a> · <a style="color:#a6f4e8" href="/unified/">Unified Qwen Chat</a> · <a style="color:#a6f4e8" href="#fi-ml-panel">Machine Learning</a> · <a style="color:#a6f4e8" href="/operations/">Executive Assistant</a> <span style="display:block;font-size:12px;color:#c6d7e5">Current services remain on original ports; ML uses verified 8801 capability.</span></nav>';
const DEALS=JSON.stringify({deals:Array.from({length:8},(_,i)=>({id:'demo'+i,cost:i+1,sale_price:i+9,shipping:1,fees:0.8,return_allowance:0.5}))});
const PANEL='<section id="fi-ml-panel" style="box-sizing:border-box;margin:18px auto;padding:17px;max-width:1100px;background:#152a3a;border:1px solid #4e7087;border-radius:12px;color:#e6f4fc;font:14px/1.5 system-ui"><h2 style="font-size:19px;margin:0 0 6px">scikit-learn + Qwen · E-commerce intelligence</h2><p id="fi-ml-status">Checking local ML bridge…</p><p>Run deal analysis or sales predictions using supplied JSON. Example values are synthetic, not verified prices.</p><label for="fi-ml-prompt">ML task</label><input id="fi-ml-prompt" style="box-sizing:border-box;display:block;width:100%;padding:10px;margin:5px 0 10px;background:#0c1825;color:#fff;border:1px solid #537187;border-radius:7px" maxlength="1000" value="Analyze deals and rank estimated profit"><label for="fi-ml-data">Structured product or sales data</label><textarea id="fi-ml-data" spellcheck="false" style="box-sizing:border-box;display:block;width:100%;min-height:150px;margin:5px 0 8px;padding:10px;background:#0c1825;color:#fff;border:1px solid #537187;border-radius:7px;font:12px monospace">'+DEALS+'</textarea><label style="display:block;margin-bottom:8px"><input id="fi-ml-train-approve" type="checkbox"> Approve writing or replacing the local sales model (training only)</label><button id="fi-ml-run" style="padding:10px 12px;background:#a2e7e2;border:0;border-radius:7px;color:#09202c;font-weight:bold">Run verified ML task</button><pre id="fi-ml-result" style="white-space:pre-wrap;overflow-wrap:anywhere;padding:9px;background:#0c1825;margin-top:12px;max-height:440px;overflow:auto">No analysis run.</pre></section>';
const FIAL4_WIDGET=new URL('../src/fial/dashboard-widget-v4.js',import.meta.url);
const FIAL4_PANEL='<section id="fi-fial4-panel" style="box-sizing:border-box;margin:18px auto;padding:17px;max-width:1100px;background:#152a3a;border:1px solid #4e7087;border-radius:12px;color:#e6f4fc;font:14px/1.5 system-ui"><h2>FIAL 4 · Government grant evidence</h2><p>Read-only saved evidence review. No eligibility certification or live official source refresh.</p><pre id="fi-fial4-summary" style="white-space:pre-wrap;overflow-wrap:anywhere">Status not loaded.</pre></section>';
const COMMERCE_WIDGET=new URL('../src/commerce/trends-commerce-widget-v1.js',import.meta.url);
const COMMERCE_PANEL='<section id="fi-commerce-panel" aria-label="Commerce intelligence" style="box-sizing:border-box;margin:18px auto;padding:17px;max-width:1100px;background:#152a3a;border:1px solid #4e7087;border-radius:12px;color:#e6f4fc;font:14px/1.5 system-ui"><h2 style="font-size:19px">Commerce Intelligence · Google Trending Now + Shopify</h2><p style="color:#b9c9da">V1.1 research queue: real evidence only. Search popularity is not purchase demand or verified profit.</p><p id="fi-commerce-state" role="status">Checking cached commerce intelligence…</p><p>Read-only Google US trending topics and authorized Shopify store snapshots. Trending searches are not proven purchase demand.</p><button id="fi-commerce-refresh-trends" type="button" style="padding:10px 12px;margin-right:8px;background:#a2e7e2;border:0;border-radius:7px;color:#09202c;font-weight:bold">Refresh Google US trends</button><button id="fi-commerce-refresh-shopify" type="button" style="padding:10px 12px;background:#a2e7e2;border:0;border-radius:7px;color:#09202c;font-weight:bold">Sync Shopify (read-only)</button><div id="fi-commerce-content" style="white-space:normal;overflow-wrap:anywhere;max-height:700px;overflow:auto"></div></section>';
export function integrateDashboardHtml(html,widget,{unified=false}={}){
  if(typeof html!=='string'||!/<body[^>]*>/i.test(html)||!/<\/body>/i.test(html)||
    typeof widget!=='string'||widget.length<100||widget.length>20000||
    /<\/script/i.test(widget))throw Error('ML_HUB_HTML_INJECTION_INVALID');
  const insertion=PANEL+(unified?'<script src="/api/ml/dashboard/widget.js" defer></script>':'<script>'+widget+'</script>')+
    COMMERCE_PANEL+'<script src="/api/commerce/widget.js" defer></script>'+FIAL4_PANEL+'<script src="/api/fial/v4/widget.js" defer></script>'+ (unified?GROUNDED_PANEL+'<script src="/api/fial/grounded/client.js" defer></script>':'')+ 
    '<script src="/api/ui/client.js" defer></script>';
  return html.replace(/<\/head>/i,'<link rel="stylesheet" href="/api/ui/style.css"></head>')
    .replace(/(<body[^>]*>)/i,'$1'+SHELL+NAV).replace(/<\/body>/i,insertion+'</body>');
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
async function groundedChatBody(req){
  const parts=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>2048)throw Error('FIAL53_CHAT_BODY_TOO_LARGE');
    parts.push(chunk);
  }
  let value;
  try{value=JSON.parse(Buffer.concat(parts).toString('utf8'))}
  catch{throw Error('FIAL53_CHAT_JSON_REQUIRED')}
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==1||typeof value.question!=='string'||
    value.question.length<4||value.question.length>1200)
    throw Error('FIAL53_CHAT_QUESTION_INVALID');
  return value;
}
async function parseBusinessQuestion(req){
 const parts=[];let size=0;
 for await(const part of req){
  size+=part.length;if(size>1600)throw Error('FIAL56_BODY_TOO_LARGE');
  parts.push(part);
 }
 let value;
 try{value=JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{throw Error('FIAL56_JSON_REQUIRED')}
 if(!value||typeof value!=='object'||Array.isArray(value)||
  Object.keys(value).length!==1||typeof value.question!=='string'||
  value.question.trim().length<4||value.question.length>1000)
  throw Error('FIAL56_QUESTION_SCHEMA_INVALID');
 return value.question;
}
async function parseCompetenceSupplement(req,mode){
 const chunks=[];let size=0;
 for await(const chunk of req){
  size+=chunk.length;
  if(size>5500)throw Error('FIAL56_SUPPLEMENT_BODY_TOO_LARGE');
  chunks.push(chunk);
 }
 let obj;
 try{obj=JSON.parse(Buffer.concat(chunks).toString('utf8'))}
 catch{throw Error('FIAL56_SUPPLEMENT_JSON_REQUIRED')}
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).length!==1)
  throw Error('FIAL56_SUPPLEMENT_OBJECT_INVALID');
 if(mode==='finance'){
  const x=obj.metrics;
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length>9)
   throw Error('FIAL56_METRICS_INVALID');
  const allowed=new Set(['unit_price','unit_variable_cost','monthly_fixed_cost',
   'cash_available','monthly_net_burn','revenue','cost_of_goods_sold',
   'initial_investment','period_net_benefit']);
  for(const [key,value] of Object.entries(x)){
   if(!allowed.has(key)||typeof value!=='number'||!Number.isFinite(value)||
    Math.abs(value)>1e12)throw Error('FIAL56_METRICS_INVALID');
  }
  return x;
 }
 if(mode==='writing'&&typeof obj.draft==='string'&&obj.draft.trim().length>0&&obj.draft.length<=4000)
  return obj.draft;
 throw Error('FIAL56_SUPPLEMENT_SCHEMA_INVALID');
}
async function emptyCommerceBody(req){
  let length=0;const chunks=[];
  for await(const chunk of req){length+=chunk.length;if(length>64)throw Error('COMMERCE_REQUEST_TOO_LARGE');chunks.push(chunk)}
  const value=Buffer.concat(chunks).toString('utf8').trim();
  if(value!=='{}')throw Error('COMMERCE_EMPTY_JSON_REQUIRED');
}
export function createUnifiedMlHub({ml=createMlDashboardBridge(),commerce=createCommerceIntelligence(),grounded=createGroundedChat(),
 readPage=pageFrom,proxy=proxyTo,readWidget=()=>readFile(ML_WIDGET,'utf8'),
 readCommerceWidget=()=>readFile(COMMERCE_WIDGET,'utf8'),
 executiveStatus=readExecutiveStatus,realStatus=readRealStatus,
 businessStatus=readBusinessCompetenceStatus,businessPlan=planBusinessDecision,
 outcomeStatus=readOutcomeStatus,regulatoryStatus=readRegulatoryStatus,fleetStatus=readFleetStatus,
 readUiClient=()=>readFile(UI_CLIENT,'utf8'),readUiStyle=()=>readFile(UI_CSS,'utf8')}={}){
  return http.createServer(async(req,res)=>{
    try{
      if(!acceptedHost(req))return send(res,403,{error:'ML_HUB_HOST_DENIED'});
      if(typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//')||req.url.includes('\\'))
        return send(res,400,{error:'ML_HUB_REQUEST_TARGET_INVALID'});
      const u=new URL(req.url,ORIGIN);
      if(u.search.length>2048||u.pathname.includes('..'))return send(res,400,{error:'ML_HUB_INVALID_PATH'});
      if(req.method==='GET'&&['/','/unified/'].includes(u.pathname)){
        const unified=u.pathname==='/unified/';
        const source=await readPage(unified?8798:8789);
        const html=integrateDashboardHtml(source,await readWidget(),{unified});
        const csp=unified?"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'":
          "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'";
        return send(res,200,html,'text/html; charset=utf-8',{'content-security-policy':csp});
      }
      if(req.method==='GET'&&u.pathname==='/operations/'){
        return send(res,200,EXEC_PAGE,'text/html; charset=utf-8',
          {'content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/client.js'){
        return send(res,200,await readFile(EXEC_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/fleet/client.js'){
        return send(res,200,await readFile(FLEET_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/fleet/status'){
        const report=await fleetStatus();
        if(report.version!==FLEET_VERSION||
          (report.state!=='NOT_ACTIVATED'&&!verifyPublicFleetReport(report)))
          throw Error('FIAL59_FLEET_RECEIPT_AUTHORITY_INVALID');
        return send(res,200,report);
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/regulatory/client.js'){
        return send(res,200,await readFile(REG_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/regulatory/status'){
        const r=await regulatoryStatus();
        if(r.version!==REG_VERSION||
          (r.state!=='NOT_ACTIVATED'&&(
           r.boundaries?.emails_sent!==0||
           r.boundaries?.automatic_filing!==0||
           r.boundaries?.model_calls!==0||
           r.boundaries?.verified_individual_due_dates!==0||
           !Array.isArray(r.sources)||r.sources.length>20||
           !Array.isArray(r.economic_series)||r.economic_series.length>5)))
          throw Error('FIAL58_STATUS_AUTHORITY_OR_SCHEMA_INVALID');
        return send(res,200,r);
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/outcomes/client.js'){
        return send(res,200,await readFile(OUTCOME_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/outcomes/status'){
        const result=await outcomeStatus();
        if(result.version!==OUTCOME_VERSION||
          (result.state!=='NOT_ACTIVATED'&&(
            result.external_form_submissions!==0||
            result.verified_customer_revenue!==0||result.certified_license_status!==false||
            !Number.isInteger(result.send_attempts)||result.send_attempts<0||result.send_attempts>1||
            !['NO_CONFIRMED_EXTERNAL_OUTCOME','ONE_GMAIL_SEND_RECEIPT'].includes(result.progress_measure)
          )))throw Error('FIAL57_OUTCOME_STATUS_UNVERIFIED');
        return send(res,200,result);
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/competence/client.js'){
        return send(res,200,await readFile(BUSINESS_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/competence/status'){
        const result=await businessStatus();
        if(result.version!==OPERATOR_VERSION||!Array.isArray(result.tasks)||
         Object.values(result.actions||{}).some(v=>v!==0))
          throw Error('FIAL56_STATUS_AUTHORITY_OR_VERSION_INVALID');
        return send(res,200,result);
      }
      if(req.method==='POST'&&u.pathname==='/api/operator/competence/analyze'){
        if(!acceptedActionOrigin(req)||
          req.headers['x-fi-business-click']!=='one-local-decision-analysis'||
          (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))
          return send(res,403,{error:'FIAL56_LOCAL_EXPLICIT_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'FIAL56_JSON_CONTENT_TYPE_REQUIRED'});
        const question=await parseBusinessQuestion(req);
        const plan=businessPlan(question);
        if(plan.version!=='fial5.6-business-competence-v1'||plan.external_action_authorized!==false)
          throw Error('FIAL56_PLAN_AUTHORITY_INVALID');
        return send(res,200,{plan,model_invocations:0,tool_executions:0,
          memory_writes:0,government_filings:0,messages_sent:0});
      }
      if(req.method==='POST'&&['/api/operator/competence/finance','/api/operator/competence/writing'].includes(u.pathname)){
        const finance=u.pathname.endsWith('/finance');
        const click=finance?'one-local-financial-calculation':'one-local-writing-review';
        if(!acceptedActionOrigin(req)||req.headers['x-fi-business-click']!==click||
          (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))
          return send(res,403,{error:'FIAL56_LOCAL_EXPLICIT_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'FIAL56_JSON_CONTENT_TYPE_REQUIRED'});
        if(finance)return send(res,200,{calculations:calculateFinancials(await parseCompetenceSupplement(req,'finance')),
          claim_verified:false,model_invocations:0,external_actions:0});
        return send(res,200,{review:reviewBusinessWriting(await parseCompetenceSupplement(req,'writing')),
          claims_verified:false,messages_sent:0,model_invocations:0,external_actions:0});
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/real/client.js'){
        return send(res,200,await readFile(REAL_WIDGET,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/real/status'){
        const real=await realStatus();
        if(real.version!==REAL_VERSION||
          (real.state!=='NOT_ACTIVATED'&&
           (real.emails_sent!==0||real.government_filings!==0||
            real.payments!==0||real.rea_executions!==0||real.applied_configs!==0)))
          throw Error('REAL_OPERATIONS_RECEIPT_INVALID');
        return send(res,200,{...real,identity_display:'COMPANY_ONLY_NO_PRIVATE_CONTACTS',
          email_send_authorized:false,legal_submission_authorized:false});
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/status'){
        const result=await executiveStatus();
        if(result.version!=='fial5.4-executive-operator-v1'||!Array.isArray(result.items)||
          result.outbound_permissions?.email_sent!==0||result.outbound_permissions?.government_filings!==0)
          throw Error('EXEC_OPERATOR_STATUS_UNVERIFIED');
        return send(res,200,{...result,console_version:EXEC_CONSOLE_VERSION,
          no_email_send:true,no_auto_filings:true,no_rea_grants:true});
      }
      if(u.pathname.startsWith('/api/operator/')||u.pathname==='/operations'){
        return send(res,404,{error:'EXEC_OPERATOR_UNKNOWN_ROUTE_OR_METHOD'});
      }
      if(req.method==='GET'&&u.pathname==='/api/ui/style.css')
        return send(res,200,await readUiStyle(),'text/css; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/ui/client.js')
        return send(res,200,await readUiClient(),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/ml/dashboard/widget.js'){
        return send(res,200,await readWidget(),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/fial/grounded/status'){
        const s=grounded.status();
        return send(res,200,{version:GROUNDED_VERSION,model_interface:s.model_interface,
          memory_interface:s.memory_interface,
          state:s.state,busy:s.busy,
          tool_executions:0,rea_executions:0,authority_added:false});
      }
      if(req.method==='GET'&&u.pathname==='/api/fial/grounded/client.js')
        return send(res,200,await readFile(GROUNDED_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='POST'&&u.pathname==='/api/fial/grounded/chat'){
        if(!acceptedActionOrigin(req)||req.headers['x-fi-chat-click']!=='one-local-model-response'||
          (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))
          return send(res,403,{error:'FIAL53_EXPLICIT_SAME_ORIGIN_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'FIAL53_JSON_REQUIRED'});
        return send(res,200,await grounded.chat(await groundedChatBody(req)));
      }
      if(req.method==='GET'&&u.pathname==='/api/fial/v4/status')
        return send(res,200,await readFial4DashboardStatus());
      if(req.method==='GET'&&u.pathname==='/api/fial/v4/widget.js')
        return send(res,200,await readFile(FIAL4_WIDGET,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/ml/dashboard/status')
        return send(res,200,await ml.status());
      if(req.method==='POST'&&u.pathname==='/api/ml/dashboard/run'){
        if(!mlDashboardOriginAccepted(req,PORT))return send(res,403,{error:'ML_HUB_OPERATOR_ORIGIN_REQUIRED'});
        if(!String(req.headers['content-type']||'').startsWith('application/json'))
          return send(res,415,{error:'ML_HUB_JSON_REQUIRED'});
        const body=validateDashboardMlPayload(await parseMlDashboardBody(req));
        return send(res,200,await ml.run(body));
      }
      if(req.method==='GET'&&u.pathname==='/api/commerce/widget.js')
        return send(res,200,await readCommerceWidget(),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/commerce/status')
        return send(res,200,await commerce.status());
      if(req.method==='GET'&&u.pathname==='/api/commerce/data')
        return send(res,200,await commerce.data());
      if(req.method==='GET'&&u.pathname==='/api/commerce/focus'){
        const source=await commerce.data();
        return send(res,200,buildTrendsFocus({us:source.trends,california:source.california}));
      }
      if(req.method==='GET'&&u.pathname==='/api/commerce/opportunities'){
        const source=await commerce.data();
        return send(res,200,rankCommerceOpportunities({trends:source.trends,shopify:source.shopify}));
      }
      if(req.method==='POST'&&['/api/commerce/trends/refresh','/api/commerce/california/refresh','/api/commerce/shopify/refresh'].includes(u.pathname)){
        if(!acceptedActionOrigin(req)||req.headers['x-fi-commerce']!=='operator-click')
          return send(res,403,{error:'COMMERCE_OPERATOR_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'COMMERCE_JSON_REQUIRED'});
        await emptyCommerceBody(req);
        const result=u.pathname==='/api/commerce/trends/refresh'?
          await commerce.refreshTrends():u.pathname==='/api/commerce/california/refresh'?
          await commerce.refreshCaliforniaTrends():await commerce.refreshShopify();
        return send(res,200,result);
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/hub/status'){
        const value=await ml.status();
        return send(res,200,{version:'fi-ml-hub-v3',state:'ready',machineLearning:value,
          existingServicesUnmodified:true,reaApprovalUnchanged:true,port:PORT});
      }
      if(u.pathname.startsWith('/api/')&&['GET','POST'].includes(req.method)){
        if(req.method==='POST'&&!acceptedActionOrigin(req))return send(res,403,{error:'ML_HUB_ORIGIN_REQUIRED'});
        if(u.pathname.startsWith('/api/ml/'))return send(res,404,{error:'ML_HUB_ML_ROUTE_UNKNOWN'});
        if(u.pathname.startsWith('/api/commerce/'))return send(res,404,{error:'ML_HUB_COMMERCE_ROUTE_UNKNOWN'});
        if(u.pathname.startsWith('/api/ui/'))return send(res,404,{error:'ML_HUB_UI_ROUTE_UNKNOWN'});
        if(u.pathname.startsWith('/api/fial/grounded/'))return send(res,404,{error:'FIAL53_GROUNDED_ROUTE_UNKNOWN'});
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
