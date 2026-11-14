// Offline qualification tests: no live services, network sites, model or Python subprocess.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {routeML,validateMLData,createMlQwen} from '../src/ml/qwen-ml-v2.mjs';
import {createMlQwenServer,HOST,ORIGIN} from '../scripts/Run-Fun-QwenML8801.mjs';

const deals=()=>({deals:Array.from({length:8},(_,i)=>({
  id:'demo'+i,cost:1+i,sale_price:8+i,shipping:1,fees:0.5,return_allowance:0.25
}))});
const history=()=>({history:Array.from({length:16},(_,i)=>({
  visits:100+i,price:6+i%3,ad_spend:2+i%4,units_sold:i+3
}))});
const candidates=()=>({candidates:[{visits:300,price:6,ad_spend:5}]});
test('deterministic task router selects only task matching supplied schema',()=>{
  assert.equal(routeML('Analyze deals and rank profit',deals()),'analyze_deals');
  assert.equal(routeML('Train sales model',history()),'train_sales');
  assert.equal(routeML('Predict sales demand',candidates()),'predict_sales');
  assert.throws(()=>routeML('Buy products now',deals()),/TASK_NOT_SUPPORTED/);
  assert.throws(()=>routeML('Analyze prices',history()),/TASK_NOT_SUPPORTED/);
});
test('data validation rejects unexpected keys, unsafe identifiers and non-finite values',()=>{
  validateMLData('analyze_deals',deals());
  const extra=deals();extra.deals[0].execute='yes';
  assert.throws(()=>validateMLData('analyze_deals',extra),/DATA_FIELDS_INVALID/);
  const bad=deals();bad.deals[0].cost=Infinity;
  assert.throws(()=>validateMLData('analyze_deals',bad),/DATA_NUMBER_INVALID/);
  const dup=deals();dup.deals[0].id=dup.deals[1].id;
  assert.throws(()=>validateMLData('analyze_deals',dup),/DEAL_ID_INVALID/);
  const few=deals();few.deals.length=7;
  assert.throws(()=>validateMLData('analyze_deals',few),/DATA_ROW_COUNT/);
});
test('no ML process or model starts on health status',()=>{
  let calls=0;
  const app=createMlQwen({runPython:async()=>{calls++;return{}},explain:async()=>''});
  const s=app.status();
  assert.equal(s.reaExecutionGrants,0);
  assert.equal(s.externalActions,0);
  assert.equal(calls,0);
});
test('deal analysis routes autonomously to bounded Python and optional Qwen summary',async()=>{
  const received=[];
  const app=createMlQwen({
    runPython:async(command,data)=>{received.push({command,data});return{ok:true,external_actions:0,kind:'deal_analysis',count:8,results:[]}},
    explain:async()=> 'Verified profit estimates only.'
  });
  const r=await app.run({prompt:'Analyze deals and rank profit',data:deals()});
  assert.equal(r.command,'analyze_deals');
  assert.equal(r.route,'automatic_verified_ml');
  assert.equal(r.explanation,'Verified profit estimates only.');
  assert.equal(received.length,1);
  assert.equal(received[0].command,'analyze_deals');
  assert.equal(r.externalActions,0);
});
test('training cannot run without specific operator consent, prediction may',async()=>{
  let calls=0;
  const app=createMlQwen({runPython:async(command)=>{
    calls++;return{ok:true,external_actions:0,kind:command==='train_sales'?'train_sales':'predict_sales',predictions:[2]};
  },explain:async()=>'summary'});
  await assert.rejects(app.run({prompt:'Train sales model',data:history()}),/TRAIN_OPERATOR_CONFIRMATION_REQUIRED/);
  assert.equal(calls,0);
  const trained=await app.run({prompt:'Train sales model',data:history(),operatorConfirmed:true});
  assert.equal(trained.operatorApproval,'explicit_train_approval');
  const predicted=await app.run({prompt:'Predict sales demand',data:candidates()});
  assert.equal(predicted.command,'predict_sales');
  assert.equal(calls,2);
});
test('unverified Python output cannot be presented as computed',async()=>{
  const app=createMlQwen({runPython:async()=>({ok:true,kind:'deal_analysis',external_actions:2}),explain:async()=>'fake'});
  await assert.rejects(app.run({prompt:'Analyze deals',data:deals()}),/UNVERIFIED_RESULT/);
  assert.equal(app.status().failed,1);
});
test('Qwen failure preserves grounded ML result instead of fabricating explanation',async()=>{
  const app=createMlQwen({
    runPython:async()=>({ok:true,kind:'deal_analysis',external_actions:0,count:8}),
    explain:async()=>{throw Error('MODEL_UNAVAILABLE')}
  });
  const r=await app.run({prompt:'Analyze deals',data:deals()});
  assert.equal(r.modelState,'unavailable');
  assert.equal(r.explanation,null);
  assert.equal(r.verifiedML.count,8);
});
async function start(app){
  const server=createMlQwenServer({app,readClient:async()=>'(function(){})()'});
  return await new Promise((resolve,reject)=>server.once('error',reject).listen(0,HOST,()=>resolve(server)));
}
async function req(server,method,path,payload=null,headers={}){
  return await new Promise((resolve,reject)=>{
    const bytes=payload===null?null:JSON.stringify(payload);
    const h={host:'127.0.0.1:8801',...(bytes===null?{}:{'content-type':'application/json'}),...headers};
    const request=http.request({hostname:HOST,port:server.address().port,path,method,headers:h},r=>{
      let value='';r.on('data',x=>value+=x.toString());r.on('end',()=>resolve({status:r.statusCode,body:value}));
    });
    request.once('error',reject);request.end(bytes??undefined);
  });
}
test('HTTP GET status does not execute tasks and POST requires same-origin explicit click',async()=>{
  let invoked=0;
  const app={status:()=>({state:'ready',externalActions:0}),run:async()=>{invoked++;return{state:'completed'}}};
  const server=await start(app);
  try{
    const s=await req(server,'GET','/api/ml/status');
    assert.equal(s.status,200);assert.equal(invoked,0);
    const body={prompt:'Analyze deals',data:deals()};
    assert.equal((await req(server,'POST','/api/ml/run',body)).status,403);
    assert.equal((await req(server,'POST','/api/ml/run',body,{origin:'https://untrusted.invalid','x-fi-ml':'operator-click'})).status,403);
    assert.equal(invoked,0);
    const ok=await req(server,'POST','/api/ml/run',body,{origin:ORIGIN,'x-fi-ml':'operator-click'});
    assert.equal(ok.status,200,ok.body);assert.equal(invoked,1);
    assert.equal((await req(server,'POST','/api/ml/run',{...body,hidden:'value'},{origin:ORIGIN,'x-fi-ml':'operator-click'})).status,422);
  }finally{await new Promise(r=>server.close(r))}
});
test('runner remains inert unless started explicitly with --serve',()=>{
  const file=fileURLToPath(new URL('../scripts/Run-Fun-QwenML8801.mjs',import.meta.url));
  const r=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/INACTIVE/);
});
