import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {VERSION} from '../src/outcomes/outcome-engine-v5-7.mjs';
const base='<!doctype html><html><head><title>Hub</title></head><body><main id="action-review">Old tools</main></body></html>';
const widget='(function(){window.syntheticWidget=true})();'+' '.repeat(100);
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_ML_RUN')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({trends:null,shopify:null})};
const sample=()=>({version:VERSION,state:'DRAFT_AWAITING_REVIEW',
 inquiry:{recipient:'City of Victorville Business License Division',
 source:'https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division',
 sent:false,gmail_receipt_id:null,receipt_state:'NOT_SENT'},
 mailbox_state:'MAILBOX_UNAVAILABLE',reply_candidate_count:0,
 reply_state:'NO_VERIFIED_REPLY',send_attempts:0,external_form_submissions:0,
 certified_license_status:false,verified_customer_revenue:0,
 progress_measure:'NO_CONFIRMED_EXTERNAL_OUTCOME',next_gate:'REVIEW_AND_AUTHORIZE_SINGLE_EMAIL'});
async function serverTest(status,fn){
 const server=createUnifiedMlHub({ml,commerce,outcomeStatus:status,
  readPage:async()=>base,readWidget:async()=>widget,
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{return await fn(server)}finally{await new Promise(ok=>server.close(ok))}
}
function call(server,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,
   method,path,headers:{host:'127.0.0.1:8802'}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}))});
  req.on('error',reject);req.end()
 })
}
test('outcome view is part of the existing dashboard, no new server',()=>{
 assert.match(EXEC_PAGE,/fi-outcome-status/);
 assert.match(EXEC_PAGE,/verified business outcomes/i);
 assert.match(EXEC_PAGE,/Qwen Chat/);
 assert.match(EXEC_PAGE,/fi-competence/);
 assert.match(EXEC_PAGE,/fi-real-work/);
});
test('outcome browser code is read-only and does not expose a send control',async()=>{
 const js=await readFile(new URL('../src/outcomes/outcome-console-v5-7.js',import.meta.url),'utf8');
 assert.match(js,/textContent/);
 assert.doesNotMatch(js,/fetch\(['"]https?:|innerHTML|setInterval\(|method:'POST'|messages\/send/);
});
test('outcome status is only GET and does not trigger model or OAuth',async()=>{
 let reads=0;
 await serverTest(async()=>{reads++;return sample()},async server=>{
  assert.equal((await call(server,'/operations/')).status,200);
  const code=await call(server,'/api/operator/outcomes/client.js');assert.equal(code.status,200);
  const r=await call(server,'/api/operator/outcomes/status');assert.equal(r.status,200);
  const data=JSON.parse(r.body);assert.equal(data.version,VERSION);
  assert.equal(data.verified_customer_revenue,0);
  assert.equal(data.progress_measure,'NO_CONFIRMED_EXTERNAL_OUTCOME');
  assert.equal((await call(server,'/api/operator/outcomes/status','POST')).status,404);
  assert.equal((await call(server,'/api/operator/outcomes/send','POST')).status,404);
  assert.equal(reads,1);
 })
});
test('tampered outcome receipt or forged revenue status is held',async()=>{
 await serverTest(async()=>({...sample(),verified_customer_revenue:1000}),async server=>{
  const r=await call(server,'/api/operator/outcomes/status');
  assert.equal(r.status,422);assert.match(r.body,/OUTCOME_STATUS_UNVERIFIED/);
 });
 await serverTest(async()=>({...sample(),send_attempts:3}),async server=>{
  const r=await call(server,'/api/operator/outcomes/status');
  assert.equal(r.status,422);
 });
});
