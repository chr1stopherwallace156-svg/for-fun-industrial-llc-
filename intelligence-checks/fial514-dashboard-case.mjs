import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {readDemandStatus,VERSION} from '../src/demand/demand-engine-v5-14.mjs';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('UNAUTHORIZED')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({})};
async function withHub(demandStatus,fn){
 const server=createUnifiedMlHub({ml,commerce,demandStatus,
  readPage:async()=>'<html><body>prior Qwen and tools</body></html>',
  readWidget:async()=>'(function(){})();'+' '.repeat(120),
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn(server)}finally{await new Promise(resolve=>server.close(resolve))}
}
async function request(server,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,
   path,method,headers:{host:'127.0.0.1:8802'}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
  });req.once('error',reject);req.end()
 })
}
test('official purchase intent panel retains buyer, procurement, regulatory and existing Qwen controls',()=>{
 for(const id of ['fi-purchase-demand','fi-demand-summary','fi-demand-notice',
  'fi-demand-gates','fi-demand-sources','fi-fleet-buyer','fi-bid-readiness',
  'fi-commercial-fit','fi-procurement','fi-fleet-opportunities',
  'fi-regulatory-intelligence','fi-outcome-status','Qwen Chat']){
  assert.ok(EXEC_PAGE.includes(id),id)
 }
});
test('public purchase evidence client uses textContent, pinned official links and same-origin GET only',async()=>{
 const s=await readFile(new URL('../src/demand/demand-console-v5-14.js',import.meta.url),'utf8');
 assert.match(s,/textContent/);
 assert.match(s,/credentials:'same-origin'/);
 assert.match(s,/method:'GET'/);
 assert.doesNotMatch(s,/innerHTML|eval\(|WebSocket|setInterval\(|method:\s*['"]POST['"]/)
});
test('GET response is read-only and no bid, outreach, addendum rewrite or registration POST route exists',async()=>{
 const report=await readDemandStatus({root:'/nonexistent-fial514-tests'});
 let count=0;
 await withHub(async()=>{count++;return report},async server=>{
  const page=await request(server,'/operations/');
  assert.equal(page.status,200);assert.match(page.body,/fi-purchase-demand/);
  const client=await request(server,'/api/operator/purchase-demand/client.js');
  assert.equal(client.status,200);assert.match(client.body,/textContent/);
  const status=await request(server,'/api/operator/purchase-demand/status');
  assert.equal(status.status,200);
  assert.equal(JSON.parse(status.body).version,VERSION);
  assert.equal(count,1);
  for(const path of ['/api/operator/purchase-demand/status',
   '/api/operator/purchase-demand/bid','/api/operator/purchase-demand/contact',
   '/api/operator/purchase-demand/grant','/api/operator/purchase-demand/apply'])
    assert.equal((await request(server,path,'POST')).status,404);
 })
});
test('API refuses forged follow-on service contracts and executable authority',async()=>{
 const r=await readDemandStatus({root:'/nonexistent-fial514-tests'});
 const attacks=[
  {...r,counts:{...r.counts,current_maintenance_rfps_verified:1}},
  {...r,counts:{...r.counts,awarded_contracts:1}},
  {...r,boundaries:{...r.boundaries,emails_sent:1}},
  {...r,boundaries:{...r.boundaries,rea_calls:1}},
  {...r,notice:{...r.notice,future_maintenance_award_verified:true}},
  {...r,classification:{...r.classification,open_specialty_service_procurement_verified:true}},
 ];
 for(const x of attacks)await withHub(async()=>x,async server=>
  assert.equal((await request(server,'/api/operator/purchase-demand/status')).status,422))
});
