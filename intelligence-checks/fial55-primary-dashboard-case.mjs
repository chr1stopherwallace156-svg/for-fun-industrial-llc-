import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
const original='<!doctype html><html><head><title>Test</title></head><body><main><div id="action-review">REA approval</div></main></body></html>';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_ML_EXECUTE')}};
const commerce={status:async()=>({version:'commerce-v1',shopify:{configured:false}}),data:async()=>({trends:null,shopify:null})};
const widget='(function(){})()'+' '.repeat(90);
async function call(server,path,method='GET'){
 return await new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,
   path,method,headers:{host:'127.0.0.1:8802'}},res=>{
    const chunks=[];res.on('data',b=>chunks.push(b));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
   });req.on('error',reject);req.end();
 })
}
async function withServer(real,fn){
 const server=createUnifiedMlHub({ml,commerce,realStatus:async()=>real,
  readPage:async()=>original,readWidget:async()=>widget,
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{return await fn(server)}finally{await new Promise(resolve=>server.close(resolve))}
}
test('FIAL5.5 real results in existing /operations/ view, no extra control center',()=>{
 assert.match(EXEC_PAGE,/fi-real-work/);
 assert.match(EXEC_PAGE,/api\/operator\/real\/client.js/);
 assert.match(EXEC_PAGE,/ELEKTRON operations/);
 assert.match(EXEC_PAGE,/Fun Industrial software/);
 assert.match(EXEC_PAGE,/Qwen Chat/);
});
test('new operations panel is read only and safely escapes text',async()=>{
 const js=await readFile(new URL('../src/operator/real-operations-widget-v5-5.js',import.meta.url),'utf8');
 assert.match(js,/textContent/);
 assert.doesNotMatch(js,/innerHTML\s*=|eval\(|method:\s*['"]POST['"]|new WebSocket|setInterval\(/);
});
test('GET /api/operator/real/status uses local receipt and keeps any POST blocked',async()=>{
 const real={version:'fial5.5-real-business-operations-v1',
  when_utc:'2026-11-14T22:08:23.664Z',emails_sent:0,government_filings:0,
  payments:0,rea_executions:0,applied_configs:0,artifacts:[],company_identity_status:'OPERATOR_PROVIDED_NOT_OFFICIALLY_VERIFIED'};
 await withServer(real,async server=>{
  const page=await call(server,'/operations/');assert.equal(page.status,200);
  assert.match(page.body,/fi-real-work/);
  const code=await call(server,'/api/operator/real/client.js');assert.equal(code.status,200);
  const r=await call(server,'/api/operator/real/status');assert.equal(r.status,200);
  const data=JSON.parse(r.body);assert.equal(data.government_filings,0);
  assert.equal(data.identity_display,'COMPANY_ONLY_NO_PRIVATE_CONTACTS');
  assert.equal(data.legal_submission_authorized,false);
  assert.equal((await call(server,'/api/operator/real/status','POST')).status,404);
 })
});
test('elevated or forged real work receipt fails closed',async()=>{
 const real={version:'fial5.5-real-business-operations-v1',
  emails_sent:1,government_filings:0,payments:0,rea_executions:0,applied_configs:0};
 await withServer(real,async server=>{
  const r=await call(server,'/api/operator/real/status');
  assert.equal(r.status,422);assert.match(r.body,/REAL_OPERATIONS_RECEIPT_INVALID/)
 })
});
