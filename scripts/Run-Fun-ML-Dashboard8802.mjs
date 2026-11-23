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
import {DASHBOARD_HTML,DASHBOARD_VERSION} from '../src/ui/oneport-dashboard-v1.mjs';
import {FISRE_WORKSPACE_HTML} from '../src/ui/fisre-workspace-v4.mjs';
import {FISRE_QWEN_CHAT_HTML} from '../src/ui/fisre-qwen-chat-v4.mjs';
import {MATH_HTML} from '../src/ui/math-research-v2.mjs';
import {mathSnapshot,mathEvidence} from '../src/math/math-report-bridge-v2.mjs';
import {researchV3Snapshot,researchV3Evidence as researchV3EvidenceAdapter,researchV3Candidates} from '../src/math/math-report-bridge-v3.mjs';
import {MATH_V3_HTML} from '../src/ui/math-v3-page.mjs';
import {PREVIEW_HTML,PREVIEW_VERSION} from '../src/ui/organized-preview-v1.mjs';
import {PROCUREMENT_FOCUS_HTML,PROCUREMENT_FOCUS_VERSION} from '../src/ui/procurement-focus-v1.mjs';
import {previewQwenHealth} from '../src/ui/organized-preview-health-v1.mjs';
import {ROOF_UI_HTML} from '../src/ui/roofing-opportunity-v1.mjs';
import {roofingSnapshot,roofingLeads,importRoofData,refreshLaCity,refreshNws} from '../src/roofing/roofing-intelligence-v1.mjs';
import {ROOF_BULK_PAGE} from '../src/ui/roofing-bulk-page-v2.mjs';
import {BULK_VERSION,bulkOverview,bulkMarkets,bulkDualFormulas,startBulkSync} from '../src/roofing/roofing-bulk-bridge-v2.mjs';
import {createFisreChatEvidence} from '../src/semantic/fisre-chat-evidence-v4.mjs';
import {capabilityInventory} from '../src/intelligence/capability-fabric-v1.mjs';
import {createReviewedDispatch} from '../src/intelligence/operator-reviewed-dispatch-v1.mjs';
import {createReviewedCompute} from '../src/intelligence/reviewed-compute-v1.mjs';
import {CONTROL_DECK_HTML,CONTROL_DECK_CSS,CONTROL_DECK_CLIENT,readControlDeckStatus} from '../src/ui/fun-control-deck-v1.mjs';
import {parseFisreRequest,validateFisrePayload,runFisrePython,fisreStatus} from '../src/semantic/fisre-live-bridge-v4.mjs';
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
import {readProcurementStatus,VERSION as PROCUREMENT_VERSION} from '../src/procurement/procurement-engine-v5-10.mjs';
import {readFitStatus,VERSION as FIT_VERSION} from '../src/fit/commercial-fit-engine-v5-11.mjs';
import {readReadinessStatus,VERSION as BID_VERSION} from '../src/bid-readiness/readiness-engine-v5-12.mjs';
import {readBuyerStatus,VERSION as BUYER_VERSION} from '../src/buyers/buyer-engine-v5-13.mjs';
import {readDemandStatus,VERSION as DEMAND_VERSION} from '../src/demand/demand-engine-v5-14.mjs';
import {planBusinessDecision} from '../src/competence/business-knowledge-v5-6.mjs';
import {calculateFinancials} from '../src/competence/business-finance-v5-6.mjs';
import {reviewBusinessWriting} from '../src/competence/business-writing-v5-6.mjs';
const REAL_WIDGET=new URL('../src/operator/real-operations-widget-v5-5.js',import.meta.url);
const BUSINESS_CLIENT=new URL('../src/competence/business-console-v5-6.js',import.meta.url);
const OUTCOME_CLIENT=new URL('../src/outcomes/outcome-console-v5-7.js',import.meta.url);
const REG_CLIENT=new URL('../src/regulatory/regulatory-console-v5-8.js',import.meta.url);
const FLEET_CLIENT=new URL('../src/fleet/fleet-console-v5-9.js',import.meta.url);
const PROCUREMENT_CLIENT=new URL('../src/procurement/procurement-console-v5-10.js',import.meta.url);
const FIT_CLIENT=new URL('../src/fit/commercial-fit-console-v5-11.js',import.meta.url);
const BID_CLIENT=new URL('../src/bid-readiness/readiness-console-v5-12.js',import.meta.url);
const BUYER_CLIENT=new URL('../src/buyers/buyer-console-v5-13.js',import.meta.url);
const DEMAND_CLIENT=new URL('../src/demand/demand-console-v5-14.js',import.meta.url);
const ONEPORT_CSS=new URL('../src/ui/oneport-dashboard-v1.css',import.meta.url);
const ONEPORT_CLIENT=new URL('../src/ui/oneport-dashboard-v1.js',import.meta.url);
const FISRE_CLIENT=new URL('../src/ui/fisre-workspace-v4.js',import.meta.url);
const MATH_CLIENT=new URL('../src/ui/math-research-v2.js',import.meta.url);
const MATH_V3_CLIENT=new URL('../src/ui/math-v3-page.js',import.meta.url);
const PREVIEW_CSS=new URL('../src/ui/organized-preview-v1.css',import.meta.url);
const PREVIEW_CLIENT=new URL('../src/ui/organized-preview-v1.js',import.meta.url);
const ROOF_CSS=new URL('../src/ui/roofing-opportunity-v1.css',import.meta.url);
const ROOF_CLIENT=new URL('../src/ui/roofing-opportunity-v1.js',import.meta.url);
const ROOF_BULK_CSS=new URL('../src/ui/roofing-bulk-page-v2.css',import.meta.url);
const ROOF_BULK_CLIENT=new URL('../src/ui/roofing-bulk-page-v2.js',import.meta.url);
const ONEPORT_TILT=new URL('../src/ui/vendor/vanilla-tilt-1.8.1.js',import.meta.url);
const ONEPORT_EMBED=new URL('../src/ui/oneport-embedded-v1.css',import.meta.url);
const ONEPORT_EMBED_CLIENT=new URL('../src/ui/oneport-embedded-operations-v1.js',import.meta.url);

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
async function reviewedComputeBody(req){
  const chunks=[];let bytes=0;
  for await(const c of req){
   bytes+=c.length;
   if(bytes>13500)throw Error('FUN_COMPUTE_BODY_TOO_LARGE');
   chunks.push(c);
  }
  let value;
  try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'))}
  catch{throw Error('FUN_COMPUTE_BODY_JSON_INVALID')}
  if(!value||typeof value!=='object'||Array.isArray(value))
   throw Error('FUN_COMPUTE_BODY_SCHEMA_INVALID');
  return value;
}
async function reviewedDispatchBody(req){
  const parts=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>1024)throw Error('FUN_REA_DISPATCH_BODY_TOO_LARGE');
    parts.push(chunk);
  }
  let value;
  try{value=JSON.parse(Buffer.concat(parts).toString('utf8'))}
  catch{throw Error('FUN_REA_DISPATCH_JSON_INVALID')}
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw Error('FUN_REA_DISPATCH_SCHEMA_INVALID');
  return value;
}
async function groundedChatBody(req){
  const parts=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>18500)throw Error('FIAL53_CHAT_BODY_TOO_LARGE');
    parts.push(chunk);
  }
  let value;
  try{value=JSON.parse(Buffer.concat(parts).toString('utf8'))}
  catch{throw Error('FIAL53_CHAT_JSON_REQUIRED')}
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length<1||Object.keys(value).length>6||
    Object.keys(value).some(k=>!['question','fisre','explainApprovedRea','explainApprovedCompute','useMathEvidence','useMathV3Evidence'].includes(k))||
    (value.explainApprovedRea!==undefined&&value.explainApprovedRea!==true)||
    (value.explainApprovedCompute!==undefined&&value.explainApprovedCompute!==true)||
    (value.useMathEvidence!==undefined&&value.useMathEvidence!==true)||
    (value.useMathV3Evidence!==undefined&&value.useMathV3Evidence!==true)||
    typeof value.question!=='string'||
    value.question.length<4||value.question.length>1200)
    throw Error('FIAL53_CHAT_QUESTION_INVALID');
  if(value.fisre!==undefined)validateFisrePayload(value.fisre);
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
async function roofingBody(req,maxBytes=700000){
 const parts=[];let bytes=0;
 for await(const part of req){
  bytes+=part.length;
  if(bytes>maxBytes)throw Error('ROOF_IMPORT_OVERSIZE');
  parts.push(part);
 }
 let value;
 try{value=JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{throw Error('ROOF_REQUEST_INVALID_JSON')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('ROOF_REQUEST_BODY_INVALID');
 return value;
}
async function emptyCommerceBody(req){
  let length=0;const chunks=[];
  for await(const chunk of req){length+=chunk.length;if(length>64)throw Error('COMMERCE_REQUEST_TOO_LARGE');chunks.push(chunk)}
  const value=Buffer.concat(chunks).toString('utf8').trim();
  if(value!=='{}')throw Error('COMMERCE_EMPTY_JSON_REQUIRED');
}
export function createUnifiedMlHub({ml=createMlDashboardBridge(),commerce=createCommerceIntelligence(),grounded=null,reviewedDispatch=null,reviewedCompute=null,
 readPage=pageFrom,proxy=proxyTo,readWidget=()=>readFile(ML_WIDGET,'utf8'),
 readCommerceWidget=()=>readFile(COMMERCE_WIDGET,'utf8'),
 executiveStatus=readExecutiveStatus,realStatus=readRealStatus,
 businessStatus=readBusinessCompetenceStatus,businessPlan=planBusinessDecision,
 outcomeStatus=readOutcomeStatus,regulatoryStatus=readRegulatoryStatus,fleetStatus=readFleetStatus,
 procurementStatus=readProcurementStatus,fitStatus=readFitStatus,
 bidStatus=readReadinessStatus,buyerStatus=readBuyerStatus,demandStatus=readDemandStatus,
 readUiClient=()=>readFile(UI_CLIENT,'utf8'),readUiStyle=()=>readFile(UI_CSS,'utf8')}={}){
  const dispatch=reviewedDispatch??createReviewedDispatch();
  const compute=reviewedCompute??createReviewedCompute({ml});
  const activeGrounded=grounded??createGroundedChat({capabilityReaders:{
    grants:readFial4DashboardStatus,operations:executiveStatus,outcomes:outcomeStatus,
    ml:()=>ml.status(),commerce:()=>commerce.status()
  }});
  return http.createServer(async(req,res)=>{
    try{
      if(!acceptedHost(req))return send(res,403,{error:'ML_HUB_HOST_DENIED'});
      if(typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//')||req.url.includes('\\'))
        return send(res,400,{error:'ML_HUB_REQUEST_TARGET_INVALID'});
      const u=new URL(req.url,ORIGIN);
      if(u.search.length>2048||u.pathname.includes('..'))return send(res,400,{error:'ML_HUB_INVALID_PATH'});
      // Full-sized LA/SB parcel and permit warehouse, separate from the V1 preview.
      if(req.method==='GET'&&u.pathname==='/roofing/bulk/'){
        const csp="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'";
        return send(res,200,ROOF_BULK_PAGE,'text/html; charset=utf-8',
          {'content-security-policy':csp,'x-fi-roofing-version':BULK_VERSION});
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/roofing/bulk/style.css')
        return send(res,200,await readFile(ROOF_BULK_CSS,'utf8'),'text/css; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/roofing/bulk/client.js')
        return send(res,200,await readFile(ROOF_BULK_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/roofing/bulk/status')
        return send(res,200,await bulkOverview());
      if(req.method==='GET'&&['/api/fun/roofing/bulk/markets','/api/fun/roofing/bulk/candidates'].includes(u.pathname)){
        const area=u.searchParams.get('county')||'all';
        const city=u.searchParams.get('city')||'';
        const minAge=Number(u.searchParams.get('minAge')||20);
        const onlyNoPermit=u.searchParams.get('onlyNoPermit')==='true';
        const includeUnclassified=u.searchParams.get('includeUnclassified')!=='false';
        if(u.searchParams.size>6||!['all','Los Angeles','San Bernardino'].includes(area)||
          !Number.isSafeInteger(minAge)||minAge<0||minAge>120||city.length>70||
          !/^[a-zA-Z0-9 '\-]*$/.test(city)||
          !['',null,'true','false'].includes(u.searchParams.get('onlyNoPermit'))||
          !['',null,'true','false'].includes(u.searchParams.get('includeUnclassified')))
          return send(res,422,{error:'ROOF_BULK_FILTER_VALIDATION_HOLD'});
        return send(res,200,await bulkMarkets({county:area,city,minAge,onlyNoPermit,
          includeUnclassified,detail:u.pathname.endsWith('/candidates')}));
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/roofing/bulk/formulas'){
        if(u.searchParams.size>5) return send(res,422,{error:'ROOF_DUAL_FORMULA_TOO_MANY_FILTERS'});
        const allowed=new Set(['zips','years','recentYears','minBuildingAge','permitKind']);
        for(const key of u.searchParams.keys())if(!allowed.has(key))
          return send(res,422,{error:'ROOF_DUAL_FORMULA_UNKNOWN_FILTER'});
        const integer=(name,def)=>{
          const raw=u.searchParams.get(name);
          if(raw===null)return def;
          return /^\d+$/.test(raw)&&raw.length<=3?Number(raw):NaN;
        };
        const zips=u.searchParams.get('zips')||'90011,90049,90731,90037';
        const years=integer('years',20),recentYears=integer('recentYears',5);
        const minBuildingAge=integer('minBuildingAge',25);
        const permitKind=u.searchParams.get('permitKind')||'roof_related';
        if(zips.length>60||!/^\d{5}(,\d{5}){0,9}$/.test(zips)||
          !Number.isSafeInteger(years)||years<10||years>50||
          !Number.isSafeInteger(recentYears)||recentYears<1||recentYears>10||
          recentYears>=years||!Number.isSafeInteger(minBuildingAge)||
          minBuildingAge<20||minBuildingAge>100||
          !['roof_related','replacement_like'].includes(permitKind))
          return send(res,422,{error:'ROOF_DUAL_FORMULA_FILTER_VALIDATION_HOLD'});
        return send(res,200,await bulkDualFormulas({zips,years,recentYears,
          minBuildingAge,permitKind}));
      }
      if(req.method==='POST'&&u.pathname==='/api/fun/roofing/bulk/sync'){
        if(!acceptedActionOrigin(req)||req.headers['x-fi-roofing-bulk-click']!=='operator-sync-full-export'||
          (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))
          return send(res,403,{error:'ROOF_BULK_OPERATOR_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'ROOF_BULK_JSON_REQUIRED'});
        const body=await roofingBody(req,256);
        if(Object.keys(body).length!==1||typeof body.source!=='string')
          return send(res,422,{error:'ROOF_BULK_SOURCE_ID_ONLY'});
        return send(res,202,startBulkSync(body.source));
      }
      if(u.pathname==='/roofing/bulk/'||u.pathname.startsWith('/api/fun/roofing/bulk/'))
        return send(res,404,{error:'ROOF_BULK_READONLY_OR_OPERATOR_SYNC_ONLY'});
      // Property-opportunity research; operator-only refresh and explicit CSV import.
      // No Qwen, REA, external messaging, bid submissions, or model actions.
      if(req.method==='GET'&&u.pathname==='/roofing/'){
        const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; frame-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'none'";
        return send(res,200,ROOF_UI_HTML,'text/html; charset=utf-8',
          {'content-security-policy':csp,'x-fi-roofing-version':'fun-roofing-opportunity-v1'});
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/roofing/style.css')
        return send(res,200,await readFile(ROOF_CSS,'utf8'),'text/css; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/roofing/client.js')
        return send(res,200,await readFile(ROOF_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/roofing/status')
        return send(res,200,await roofingSnapshot());
      if(req.method==='GET'&&u.pathname==='/api/fun/roofing/leads'){
        const args={countyFilter:u.searchParams.get('county')||'all',cityFilter:(u.searchParams.get('city')||'').slice(0,80),
          category:u.searchParams.get('category')||'all',minAge:Number(u.searchParams.get('minAge')||20)};
        if(!['all','San Bernardino','Los Angeles'].includes(args.countyFilter)||
           !Number.isSafeInteger(args.minAge)||args.minAge<15||args.minAge>80||
           !['all','NO_PERMIT_FOUND_IN_INGESTED_RECORDS','LAST_RECORDED_ROOF_PERMIT_20_PLUS','RECENT_ROOF_PERMIT_FOUND'].includes(args.category))
          return send(res,422,{error:'ROOF_QUERY_FILTERS_INVALID'});
        return send(res,200,await roofingLeads({filters:args}));
      }
      if(req.method==='POST'&&['/api/fun/roofing/import','/api/fun/roofing/refresh-la','/api/fun/roofing/refresh-weather'].includes(u.pathname)){
        const action=u.pathname.split('/').at(-1);
        if(!acceptedActionOrigin(req)||req.headers['x-fi-roofing-click']!=='operator-'+action||
           (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))
          return send(res,403,{error:'ROOF_EXPLICIT_OPERATOR_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'ROOF_JSON_REQUIRED'});
        const body=await roofingBody(req,action==='import'?700000:128);
        if(action==='import')return send(res,200,await importRoofData(body));
        if(Object.keys(body).length!==0)return send(res,422,{error:'ROOF_REFRESH_EMPTY_BODY_REQUIRED'});
        return send(res,200,action==='refresh-la'?await refreshLaCity():await refreshNws());
      }
      if(u.pathname==='/roofing/'||u.pathname.startsWith('/api/fun/roofing/'))
        return send(res,404,{error:'ROOF_ROUTE_NOT_SUPPORTED'});
      // Opt-in organized interface preview. Production homepage and routes remain unchanged.
      if(req.method==='GET'&&u.pathname==='/ui-preview/'){
        const csp="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'self'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'";
        return send(res,200,PREVIEW_HTML,'text/html; charset=utf-8',
          {'content-security-policy':csp,'x-fi-preview-version':PREVIEW_VERSION});
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/ui-preview/app.css')
        return send(res,200,await readFile(PREVIEW_CSS,'utf8'),'text/css; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/ui-preview/app.js')
        return send(res,200,await readFile(PREVIEW_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/ui-preview/health')
        return send(res,200,await previewQwenHealth());
      if(u.pathname==='/ui-preview/'||u.pathname.startsWith('/api/fun/ui-preview/'))
        return send(res,404,{error:'FUN_UI_PREVIEW_ROUTE_READONLY'});
      if(req.method==='GET'&&(u.pathname==='/'||u.pathname==='/dashboard/')){
        const csp="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'self'; img-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'none'";
        return send(res,200,DASHBOARD_HTML,'text/html; charset=utf-8',
          {'content-security-policy':csp,'x-fi-dashboard-version':DASHBOARD_VERSION});
      }
      if(req.method==='GET'&&u.pathname==='/math/v3/'){
        const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'";
        return send(res,200,MATH_V3_HTML,'text/html; charset=utf-8',{'content-security-policy':csp,'x-fi-math-version':'fun-math-v3-readonly-8802'});
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/math/v3/client.js')
        return send(res,200,await readFile(MATH_V3_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/math/v3/status')
        return send(res,200,await researchV3Snapshot());
      if(req.method==='GET'&&u.pathname==='/api/fun/math/v3/candidates'){
        const era=u.searchParams.get('era');
        return send(res,200,await researchV3Candidates(era));
      }
      if(u.pathname==='/math/v3/'||u.pathname.startsWith('/api/fun/math/v3/'))
        return send(res,404,{error:'FUN_MATH_V3_READONLY_ROUTE_ONLY'});
      if(req.method==='GET'&&u.pathname==='/math/'){
        const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'";
        return send(res,200,MATH_HTML,'text/html; charset=utf-8',{'content-security-policy':csp,'x-fi-math-version':'fun-math-v2-readonly-8802'});
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/math/client.js')
        return send(res,200,await readFile(MATH_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/math/status')
        return send(res,200,await mathSnapshot());
      if(u.pathname==='/math/'||u.pathname.startsWith('/api/fun/math/'))
        return send(res,404,{error:'FUN_MATH_READONLY_ROUTE_ONLY'});
      if(req.method==='GET'&&u.pathname==='/control/'){
        // Dedicated optional visual UI. Original homepage remains identical.
        const csp="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'";
        return send(res,200,CONTROL_DECK_HTML,'text/html; charset=utf-8',
          {'content-security-policy':csp,'x-fi-control-deck-version':'fun-control-deck-v1'});
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/control/style.css')
        return send(res,200,await readFile(CONTROL_DECK_CSS,'utf8'),'text/css; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/control/client.js')
        return send(res,200,await readFile(CONTROL_DECK_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fun/control/status')
        return send(res,200,await readControlDeckStatus({ml}));
      if(u.pathname.startsWith('/api/fun/control/')||u.pathname==='/control/')
        return send(res,404,{error:'FUN_CONTROL_DECK_ROUTE_NOT_SUPPORTED'});
      if(req.method==='GET'&&u.pathname==='/chat/'){
        // Direct same-origin Qwen + memory; does not proxy through 8798.
        const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'none'";
        return send(res,200,FISRE_QWEN_CHAT_HTML,'text/html; charset=utf-8',
          {'content-security-policy':csp});
      }
      // Operator-initiated Semantic Reasoning, served under the existing 8802 host.
      // The current home page, Qwen, REA, ML, worker ports, and operator authority stay unchanged.
      if(req.method==='GET'&&u.pathname==='/fisre/'){
        const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'self'";
        return send(res,200,FISRE_WORKSPACE_HTML,'text/html; charset=utf-8',
          {'content-security-policy':csp});
      }
      if(req.method==='GET'&&u.pathname==='/api/fisre/client.js')
        return send(res,200,await readFile(FISRE_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/fisre/status')
        return send(res,200,fisreStatus());
      if(req.method==='GET'&&u.pathname==='/api/fun/capabilities/status')
        return send(res,200,capabilityInventory());
      if(req.method==='GET'&&u.pathname==='/api/fun/compute/status')
        return send(res,200,compute.status());
      if(req.method==='POST'&&['/api/fun/compute/prepare','/api/fun/compute/confirm','/api/fun/compute/cancel'].includes(u.pathname)){
        const action=u.pathname.split('/').at(-1);
        if(!acceptedActionOrigin(req)||req.headers['x-fi-compute-review']!=='operator-'+action||
           (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))
          return send(res,403,{error:'FUN_COMPUTE_EXPLICIT_OPERATOR_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'FUN_COMPUTE_JSON_REQUIRED'});
        const body=await reviewedComputeBody(req);
        if(action==='prepare')return send(res,200,await compute.prepare(body));
        if(action==='confirm')return send(res,200,await compute.confirm(body));
        if(Object.keys(body).length!==0)return send(res,422,{error:'FUN_COMPUTE_CANCEL_REQUIRES_EMPTY_BODY'});
        return send(res,200,compute.cancel());
      }
      if(req.method==='GET'&&u.pathname==='/api/fun/rea/dispatch/status'){
        return send(res,200,dispatch.status());
      }
      if(req.method==='POST'&&['/api/fun/rea/dispatch/prepare','/api/fun/rea/dispatch/confirm','/api/fun/rea/dispatch/cancel'].includes(u.pathname)){
        const action=u.pathname.split('/').at(-1);
        if(!acceptedActionOrigin(req)||req.headers['x-fi-rea-review']!=='operator-'+action||
           (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))
          return send(res,403,{error:'FUN_REA_SEPARATE_OPERATOR_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'FUN_REA_DISPATCH_JSON_REQUIRED'});
        const args=await reviewedDispatchBody(req);
        if(action==='prepare')return send(res,200,await dispatch.prepare(args));
        if(action==='confirm')return send(res,200,await dispatch.confirm(args));
        return send(res,200,dispatch.cancel(args));
      }

      if(req.method==='POST'&&u.pathname==='/api/fisre/analyze'){
        if(!acceptedActionOrigin(req)||req.headers['x-fi-fisre']!=='operator-click')
          return send(res,403,{error:'FISRE_EXPLICIT_OPERATOR_CLICK_REQUIRED'});
        const request=await parseFisreRequest(req);
        return send(res,200,await runFisrePython(request));
      }
      if(u.pathname.startsWith('/api/fisre/')||u.pathname==='/fisre/')
        return send(res,404,{error:'FISRE_ROUTE_NOT_SUPPORTED'});
      if(req.method==='GET'&&u.pathname==='/api/oneport/style.css')
        return send(res,200,await readFile(ONEPORT_CSS,'utf8'),'text/css; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/oneport/vendor/vanilla-tilt.js')
        return send(res,200,await readFile(ONEPORT_TILT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/oneport/client.js')
        return send(res,200,await readFile(ONEPORT_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/oneport/embed.css')
        return send(res,200,await readFile(ONEPORT_EMBED,'utf8'),'text/css; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/oneport/embed-operations.js')
        return send(res,200,await readFile(ONEPORT_EMBED_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='GET'&&['/workspace/','/unified/'].includes(u.pathname)){
        const unified=u.pathname==='/unified/';
        const embedded=u.searchParams.get('embedded')==='1';
        const source=await readPage(unified?8798:8789);
        let html=integrateDashboardHtml(source,await readWidget(),{unified});
        if(embedded)html=html.replace(/<\/head>/i,
          '<link rel="stylesheet" href="/api/oneport/embed.css"></head>');
        const csp=unified?"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'none'; base-uri 'none'; frame-ancestors "+(embedded?"'self'":"'none'")+"; form-action 'none'":
          "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors "+(embedded?"'self'":"'none'");
        return send(res,200,html,'text/html; charset=utf-8',{'content-security-policy':csp});
      }
      if(req.method==='GET'&&u.pathname==='/procurement/'){
        // Focused, bounded local-only view backed by existing procurement API.
        const csp="default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
        return send(res,200,PROCUREMENT_FOCUS_HTML,'text/html; charset=utf-8',
          {'content-security-policy':csp,'x-fi-procurement-view':PROCUREMENT_FOCUS_VERSION});
      }
      if(req.method==='GET'&&u.pathname==='/operations/'){
        const embedded=u.searchParams.get('embedded')==='1';
        const page=embedded?EXEC_PAGE
          .replace(/<\/head>/i,'<link rel="stylesheet" href="/api/oneport/embed.css"></head>')
          .replace(/<\/body>/i,'<script src="/api/oneport/embed-operations.js" defer></script></body>'):EXEC_PAGE;
        return send(res,200,page,'text/html; charset=utf-8',
          {'content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors "+(embedded?"'self'":"'none'")});
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/client.js'){
        return send(res,200,await readFile(EXEC_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/demand/client.js'){
        return send(res,200,await readFile(DEMAND_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/demand/status'){
        const r=await demandStatus();
        if(r.version!==DEMAND_VERSION||
         r.buyer?.id!=='bakersfield-city-school-district'||
         r.program?.awarded_to_bcsd_verified!==false||
         r.program?.awarded_to_elektron_verified!==false||
         r.program?.direct_vendor_order!==false||
         r.counts?.verified_live_ev_repair_rfps!==0||
         r.counts?.buyer_orders!==0||r.counts?.actual_revenue_usd!==0||
         r.counts?.verified_funded_district_awards!==0||
         r.decision?.bids_ready!==0||r.decision?.contact_authorized!==false||
         r.decision?.verified_live_ev_repair_rfps!==0||
         r.decision?.confirmed_current_ev_maintenance_buyers!==0||
         r.decision?.revenue_usd!==0||
         r.boundaries?.emails_sent!==0||r.boundaries?.bids_submitted!==0||
         r.boundaries?.forms_submitted!==0||r.boundaries?.applications_filed!==0||
         r.boundaries?.vendor_accounts_created!==0||
         r.boundaries?.customer_purchase_orders!==0||
         r.boundaries?.rea_calls!==0||r.boundaries?.model_calls!==0||
         !r.active_bid_review||
         r.active_bid_review.buyer_service_bid_verified!==0||
         !Array.isArray(r.active_bid_review.possible_relevant_titles)||
         r.active_bid_review.possible_relevant_titles.length>25)
         throw Error('FIAL514_DEMAND_AUTHORITY_OR_SCHEMA_INVALID');
        return send(res,200,r);
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/buyer/client.js'){
        return send(res,200,await readFile(BUYER_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/buyer/status'){
        const r=await buyerStatus();
        if(r.version!==BUYER_VERSION||r.buyer?.id!=='bakersfield-city-school-district'||
         r.buyer?.ev_bus_count_verified!==null||
         r.buyer?.actual_current_need_verified!==false||
         r.buyer?.open_ev_service_solicitation_verified!==false||
         r.buyer?.elektron_vendor_approved!==false||
         r.counts?.verified_revenue_usd!==0||r.counts?.verified_open_repair_bids!==0||
         r.counts?.verified_service_orders!==0||
         r.counts?.verified_public_buyer_pathways>1||
         r.boundaries?.emails_sent!==0||r.boundaries?.phone_calls_placed!==0||
         r.boundaries?.site_visits!==0||r.boundaries?.purchase_orders_verified!==0||
         r.boundaries?.rea_calls!==0||r.boundaries?.model_calls!==0||
         r.decision?.direct_bid_ready!==false||r.decision?.contact_approved!==false||
         r.decision?.current_need_status!=='NOT_VERIFIED')
          throw Error('FIAL513_BUYER_AUTHORITY_OR_SCHEMA_INVALID');
        return send(res,200,r);
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/bid-readiness/client.js'){
        return send(res,200,await readFile(BID_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/bid-readiness/status'){
        const r=await bidStatus();
        if(r.version!==BID_VERSION||r.counts?.verified_bid_ready!==0||
           r.counts?.actual_revenue_usd!==0||r.boundaries?.bids_submitted!==0||
           r.boundaries?.rea_tool_calls!==0||r.boundaries?.emails_sent!==0||
           r.boundaries?.registrations_made!==0||r.boundaries?.model_calls!==0||
           r.boundaries?.applications_submitted!==0||r.boundaries?.payments_made!==0||
           !Array.isArray(r.leads)||r.leads.length!==2||
           r.leads.some(x=>x.direct_bid_ready!==false||x.verified_eligibility!==false||
            x.contract_awarded!==false||x.contract_value_usd_verified!==0||
            x.buyer_accepting_submissions_verified!==false))
            throw Error('FIAL512_BID_READINESS_AUTHORITY_OR_SCHEMA_INVALID');
        return send(res,200,r);
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/fit/client.js'){
        return send(res,200,await readFile(FIT_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/fit/status'){
        const r=await fitStatus();
        if(r.version!==FIT_VERSION||r.counts?.directly_qualified_bids!==0||
          r.counts?.contracts_awarded!==0||r.counts?.actual_revenue_usd!==0||
          r.boundaries?.bids_submitted!==0||r.boundaries?.applications_submitted!==0||
          r.boundaries?.emails_sent!==0||r.boundaries?.rea_calls!==0||
          r.boundaries?.model_calls!==0||
          !Array.isArray(r.opportunities)||r.opportunities.length!==3||
          r.opportunities.some(x=>x.direct_bid_ready!==false||
            x.vendor_eligibility_verified!==false||x.validated_award_usd!==0||
            x.contract_amount_usd_verified!==0))
          throw Error('FIAL511_FIT_AUTHORITY_OR_SCHEMA_INVALID');
        return send(res,200,r);
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/procurement/client.js'){
        return send(res,200,await readFile(PROCUREMENT_CLIENT,'utf8'),
          'text/javascript; charset=utf-8');
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/procurement/status'){
        const r=await procurementStatus();
        if(r.version!==PROCUREMENT_VERSION||r.boundaries?.actual_rfps_submitted!==0||
         r.boundaries?.emails_sent!==0||r.boundaries?.rea_calls!==0||
         r.boundaries?.model_calls!==0||r.boundaries?.revenue_usd!==0||
         r.boundaries?.orders!==0||r.boundaries?.awarded_contracts!==0||
         r.counts?.verified_fit_for_elektron!==0||
         !Array.isArray(r.verified_current_published_notices)||
         r.verified_current_published_notices.length>1||
         r.counts?.verified_current_published_notices!==r.verified_current_published_notices.length||
         (r.state==='NOT_ACTIVATED'&&r.verified_current_published_notices.length!==0))
          throw Error('FIAL510_PROVENANCE_OR_AUTHORITY_INVALID');
        return send(res,200,r);
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
        const s=activeGrounded.status();
        return send(res,200,{version:GROUNDED_VERSION,model_interface:s.model_interface,
          memory_interface:s.memory_interface,
          state:s.state,busy:s.busy,
          tool_executions:0,rea_executions:0,authority_added:false,
          capability_fabric_version:s.capability_fabric_version||null});
      }
      if(req.method==='GET'&&u.pathname==='/api/fial/grounded/client.js')
        return send(res,200,await readFile(GROUNDED_CLIENT,'utf8'),'text/javascript; charset=utf-8');
      if(req.method==='POST'&&u.pathname==='/api/fial/grounded/chat'){
        if(!acceptedActionOrigin(req)||req.headers['x-fi-chat-click']!=='one-local-model-response'||
          (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))
          return send(res,403,{error:'FIAL53_EXPLICIT_SAME_ORIGIN_CLICK_REQUIRED'});
        if(req.headers['content-type']!=='application/json')
          return send(res,415,{error:'FIAL53_JSON_REQUIRED'});
        const body=await groundedChatBody(req);
        let approvedReaEvidence=null,approvedComputeEvidence=null;
        let researchEvidence=null,researchV3Evidence=null;
        if(body.useMathV3Evidence===true){
          const snapshot=await researchV3Snapshot();
          if(!snapshot.ready)throw Error('FUN_MATH_V3_REPORT_NOT_VERIFIED_'+snapshot.state);
          researchV3Evidence=researchV3EvidenceAdapter(snapshot);
        }
        if(body.useMathEvidence===true){
          const snapshot=await mathSnapshot();
          if(!snapshot.ready)throw Error('FUN_MATH_V2_REPORT_NOT_VERIFIED_'+snapshot.state);
          researchEvidence=mathEvidence(snapshot);
        }
        if(body.explainApprovedRea===true){
          const receipt=dispatch.lastEvidence();
          if(!receipt||receipt.verified!==true)
            throw Error('FUN_REA_NO_OPERATOR_APPROVED_RESULT_TO_EXPLAIN');
          approvedReaEvidence=JSON.stringify(receipt);
        }
        if(body.explainApprovedCompute===true){
          const result=compute.lastEvidence();
          if(!result||result.operatorApproved!==true)
            throw Error('FUN_COMPUTE_NO_APPROVED_RESULT_TO_EXPLAIN');
          approvedComputeEvidence=JSON.stringify(result);
        }
        const reviewedToolSuggestion=dispatch.recommend(body.question);
        const reviewedComputeSuggestion=compute.recommend(body.question);
        if(body.fisre===undefined){
          const answer=await activeGrounded.chat({question:body.question,reaEvidence:approvedReaEvidence,computeEvidence:approvedComputeEvidence,mathEvidence:researchEvidence,mathV3Evidence:researchV3Evidence});
          return send(res,200,{...answer,reviewedToolSuggestion,reviewedComputeSuggestion});
        }
        // Operator-submitted source is analyzed, then this same Qwen responds.
        // Neither Qwen nor a model-derived plan may execute a compute operation.
        const analysis=await runFisrePython(body.fisre);
        const evidence=createFisreChatEvidence(analysis,body.fisre.source);
        const answer=await activeGrounded.chat({question:body.question,fisreEvidence:evidence,reaEvidence:approvedReaEvidence,computeEvidence:approvedComputeEvidence,mathEvidence:researchEvidence,mathV3Evidence:researchV3Evidence});
        return send(res,200,{...answer,reviewedToolSuggestion,reviewedComputeSuggestion,
          fisre:{status:analysis.proof.status,source_sha256:analysis.source.sha256,
            replay:analysis.replay.state,cognitive:'proposed_only',
            independently_proved:false,tool_authority_added:false}});
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
        if(u.pathname.startsWith('/api/ui/')||u.pathname.startsWith('/api/oneport/'))return send(res,404,{error:'ML_HUB_UI_ROUTE_UNKNOWN'});
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
