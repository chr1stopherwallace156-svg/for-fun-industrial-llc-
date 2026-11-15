import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {readDemandStatus,VERSION} from '../src/demand/demand-engine-v5-14.mjs';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('UNAUTHORIZED')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({})};
async function server(status,fn){
 const hub=createUnifiedMlHub({ml,commerce,demandStatus:status,
  readPage:async()=>'<html><body>Qwen and original tools</body></html>',
  readWidget:async()=>'(function(){})();'+' '.repeat(120),
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(resolve=>hub.listen(0,'127.0.0.1',resolve));
 try{await fn(hub)}finally{await new Promise(resolve=>hub.close(resolve))}
}
function request(hub,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:hub.address().port,
   path,method,headers:{host:'127.0.0.1:8802'}},res=>{
    const out=[];res.on('data',x=>out.push(x));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(out).toString('utf8')}));
  });req.once('error',reject);req.end()
 })
}
test('primary original Operations page keeps earlier modules with demand panel',()=>{
 for(const id of ['fi-purchase-demand','fi-demand-status','fi-demand-buyer',
  'fi-demand-funding','fi-demand-hints','fi-demand-sources',
  'fi-fleet-buyer','fi-bid-readiness','fi-commercial-fit','fi-procurement',
  'fi-fleet-opportunities','fi-regulatory-intelligence','Qwen Chat']){
  assert.ok(EXEC_PAGE.includes(id),id)
 }
});
test('demand browser is text escaped and read-only, with no grant application or external model calls',async()=>{
 const src=await readFile(new URL('../src/demand/demand-console-v5-14.js',import.meta.url),'utf8');
 assert.match(src,/textContent/);
 assert.match(src,/method:'GET'/);
 assert.match(src,/credentials:'same-origin'/);
 assert.doesNotMatch(src,/innerHTML|eval\(|setInterval\(|WebSocket|method:\s*['"]POST['"]|\/api\/rea\//)
});
test('GET saved official demand is inert; POST bid, grant, contact or refresh are unavailable',async()=>{
 const result=await readDemandStatus({root:'/nonexistent-fial514-dashboard'});
 let count=0;
 await server(async()=>{count++;return result},async hub=>{
  const page=await request(hub,'/operations/');
  assert.equal(page.status,200);
  assert.match(page.body,/fi-purchase-demand/);
  const js=await request(hub,'/api/operator/demand/client.js');
  assert.equal(js.status,200);
  assert.match(js.body,/textContent/);
  const status=await request(hub,'/api/operator/demand/status');
  assert.equal(status.status,200);
  assert.equal(JSON.parse(status.body).version,VERSION);
  assert.equal(count,1);
  for(const path of ['/api/operator/demand/status','/api/operator/demand/refresh',
   '/api/operator/demand/contact','/api/operator/demand/grant',
   '/api/operator/demand/bid','/api/operator/demand/pay']){
   assert.equal((await request(hub,path,'POST')).status,404)
  }
 })
});
test('forged buyer electric bus count, district award, model execution and revenue are rejected',async()=>{
 const r=await readDemandStatus({root:'/nonexistent-fial514-dashboard'});
 for(const bad of [
  {...r,program:{...r.program,awarded_to_elektron_verified:true}},
  {...r,program:{...r.program,direct_vendor_order:true}},
  {...r,boundaries:{...r.boundaries,emails_sent:1}},
  {...r,boundaries:{...r.boundaries,rea_calls:1}},
  {...r,boundaries:{...r.boundaries,customer_purchase_orders:1}},
  {...r,decision:{...r.decision,bids_ready:1}},
  {...r,counts:{...r.counts,actual_revenue_usd:80000}},
  {...r,active_bid_review:{...r.active_bid_review,buyer_service_bid_verified:1}}
 ]){
  await server(async()=>bad,async hub=>{
   assert.equal((await request(hub,'/api/operator/demand/status')).status,422)
  })
 }
});
