// Offline qualification for V3 consolidated control center. No protected process started.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {integrateDashboardHtml,createUnifiedMlHub,HOST,ORIGIN} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {createMlDashboardBridge,validateDashboardMlPayload,mlDashboardOriginAccepted} from '../src/ml/dashboard-ml-proxy-v3.mjs';

const source='<html><head></head><body><h1>Legacy dashboard</h1><script>window.example=true;</script></body></html>';
const widget='(()=>{document.getElementById("fi-ml-panel").setAttribute("data-test","ok")})();'+' '.repeat(80);
const deals=()=>({deals:Array.from({length:8},(_,i)=>({
  id:'case'+i,cost:1+i,sale_price:9+i,shipping:1,fees:.5,return_allowance:.2
}))});
const status={state:'ready',bridge:'fun-ml-dashboard-v3',externalActions:0};
const headers={host:'127.0.0.1:8802',origin:ORIGIN,'x-fi-ml':'operator-click','content-type':'application/json'};
function app(){
  let taskCalls=0,serviceCalls=[];
  const ml={status:async()=>status,run:async data=>{
    taskCalls++;return {state:'completed',route:'automatic_verified_ml',verifiedML:{ok:true,kind:'deal_analysis',external_actions:0},externalActions:0}
  }};
  const server=createUnifiedMlHub({
    ml,readPage:async p=>{serviceCalls.push(p);return source},
    proxy:async(req,res,port)=>{
      serviceCalls.push(port);
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({port}))
    },readWidget:async()=>widget
  });
  return {server,counts:()=>({taskCalls,serviceCalls})};
}
async function start(server){return await new Promise((resolve,reject)=>server.once('error',reject).listen(0,HOST,()=>resolve(server)))}
async function req(server,method,url,payload=null,h={}){
  return await new Promise((resolve,reject)=>{
    const body=payload===null?null:JSON.stringify(payload);
    const request=http.request({hostname:HOST,port:server.address().port,path:url,method,headers:{host:'127.0.0.1:8802',...h}},res=>{
      const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({
        status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),headers:res.headers
      }));
    });
    request.once('error',reject);request.end(body??undefined);
  });
}
test('original and unified pages include one integrated ML panel without removing prior content',()=>{
  const original=integrateDashboardHtml(source,widget);
  const unified=integrateDashboardHtml(source,widget,{unified:true});
  assert.match(original,/Legacy dashboard/);assert.match(original,/fi-ml-panel/);
  assert.match(original,/\/unified\//);assert.match(original,/data-test/);
  assert.match(unified,/src="\/api\/ml\/dashboard\/widget.js"/);
  assert.doesNotMatch(unified,/data-test/);
});
test('one bounded ML task requires a valid dataset; training needs a new approval',()=>{
  validateDashboardMlPayload({prompt:'Analyze deals',data:deals()});
  assert.throws(()=>validateDashboardMlPayload({prompt:'Train sales model',data:{history:Array.from({length:16},(_,i)=>({visits:i+1,price:5,ad_spend:3,units_sold:2}))}}),/ML_DASHBOARD_TRAIN_APPROVAL_REQUIRED/);
  const bad=deals();bad.deals[0].cost=Number.NaN;
  assert.throws(()=>validateDashboardMlPayload({prompt:'Analyze deals',data:bad}),/ML_DASHBOARD_NUMBER_INVALID/);
  const extra=deals();extra.deals[0].cmd='rm';
  assert.throws(()=>validateDashboardMlPayload({prompt:'Analyze deals',data:extra}),/ML_DASHBOARD_FIELDS_INVALID/);
});
test('status request is read-only and does not execute an ML task',async()=>{
  const f=app();const server=await start(f.server);
  try{
    const x=await req(server,'GET','/api/ml/dashboard/status');
    assert.equal(x.status,200);assert.equal(f.counts().taskCalls,0);
    const main=await req(server,'GET','/');
    assert.equal(main.status,200);
    assert.match(main.body,/fi-ml-panel/);
    assert.equal(f.counts().taskCalls,0);
    assert.equal(f.counts().serviceCalls[0],8789);
  }finally{await new Promise(r=>server.close(r))}
});
test('unified task interface stays accessible with existing route names',async()=>{
  const f=app();const server=await start(f.server);
  try{
    const page=await req(server,'GET','/unified/');
    assert.equal(page.status,200);
    assert.match(page.body,/api\/ml\/dashboard\/widget.js/);
    const result=await req(server,'GET','/api/unified/status');
    assert.equal(result.status,200);assert.deepEqual(JSON.parse(result.body),{port:8798});
    assert.ok(f.counts().serviceCalls.includes(8798));
  }finally{await new Promise(r=>server.close(r))}
});
test('same-origin explicit click required for ML execution',async()=>{
  const f=app();const server=await start(f.server);
  try{
    const p={prompt:'Analyze deals',data:deals()};
    assert.equal((await req(server,'POST','/api/ml/dashboard/run',p)).status,403);
    assert.equal((await req(server,'POST','/api/ml/dashboard/run',p,{
      ...headers,origin:'https://untrusted.invalid'
    })).status,403);
    assert.equal(f.counts().taskCalls,0);
    const x=await req(server,'POST','/api/ml/dashboard/run',p,headers);
    assert.equal(x.status,200);assert.equal(f.counts().taskCalls,1);
    const bad=await req(server,'POST','/api/ml/dashboard/run',{...p,unexpected:true},headers);
    assert.equal(bad.status,422);
  }finally{await new Promise(r=>server.close(r))}
});
test('bridge validates ML results and never accepts unverified upstream computation',async()=>{
  const calls=[];
  const bridge=createMlDashboardBridge({read:async(url,body)=>{
    calls.push({url,body});
    if(body)return {state:'completed',route:'automatic_verified_ml',
      externalActions:0,verifiedML:{ok:true,kind:'deal_analysis',external_actions:0}};
    return {version:'fun-qwen-scikit-v2',pythonInstalled:true,reaExecutionGrants:0,externalActions:0};
  }});
  const s=await bridge.status();assert.equal(s.state,'ready');
  const result=await bridge.run({prompt:'Analyze deals',data:deals()});
  assert.equal(result.verifiedML.kind,'deal_analysis');
  assert.equal(calls.length,2);
  const failed=createMlDashboardBridge({read:async()=>({state:'completed',route:'automatic_verified_ml',externalActions:2,verifiedML:{ok:true,external_actions:0}})});
  await assert.rejects(failed.run({prompt:'Analyze deals',data:deals()}),/ATTESTATION_FAILED/);
});
test('forwards original dashboard POST only when user origin is same as dashboard',async()=>{
  const f=app();const server=await start(f.server);
  try{
    const failed=await req(server,'POST','/api/ai/chat',{messages:[]});
    assert.equal(failed.status,403);
    const passed=await req(server,'POST','/api/ai/chat',{messages:[]},{
      'content-type':'application/json',origin:ORIGIN
    });
    assert.equal(passed.status,200);
    assert.ok(f.counts().serviceCalls.includes(8789));
  }finally{await new Promise(r=>server.close(r))}
});
test('rejects unsupported route and malformed host instead of proxying elsewhere',async()=>{
  const f=app();const server=await start(f.server);
  try{
    assert.equal((await req(server,'GET','http://malicious.invalid/')).status,400);
    assert.equal((await req(server,'GET','/',null,{host:'evil.invalid'})).status,403);
    assert.equal((await req(server,'GET','/api/ml/private')).status,404);
    assert.equal(f.counts().taskCalls,0);
  }finally{await new Promise(r=>server.close(r))}
});
test('hub remains inert without explicit --serve',()=>{
  const path=fileURLToPath(new URL('../scripts/Run-Fun-ML-Dashboard8802.mjs',import.meta.url));
  const p=spawnSync(process.execPath,[path],{encoding:'utf8',timeout:12000});
  assert.equal(p.status,0,p.stderr);assert.match(p.stdout,/INACTIVE/);
});
