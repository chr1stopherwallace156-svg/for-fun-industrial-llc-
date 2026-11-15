import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {readBuyerStatus,VERSION} from '../src/buyers/buyer-engine-v5-13.mjs';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NOT_AUTHORIZED')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({})};
async function hub(buyerStatus,fn){
 const server=createUnifiedMlHub({ml,commerce,buyerStatus,
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
    const parts=[];res.on('data',c=>parts.push(c));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(parts).toString('utf8')}));
  });req.on('error',reject);req.end()
 })
}
test('existing 8802 Operations keeps all earlier modules while adding buyer evidence',()=>{
 for(const id of ['fi-fleet-buyer','fi-buyer-summary','fi-buyer-details','fi-buyer-gates',
  'fi-buyer-sources','fi-bid-readiness','fi-commercial-fit','fi-procurement',
  'fi-fleet-opportunities','fi-regulatory-intelligence','fi-outcome-status','Qwen Chat'])
   assert.ok(EXEC_PAGE.includes(id),id)
});
test('buyer evidence client renders with textContent and same-origin read-only GET',async()=>{
 const src=await readFile(new URL('../src/buyers/buyer-console-v5-13.js',import.meta.url),'utf8');
 assert.match(src,/textContent/);
 assert.match(src,/credentials:'same-origin'/);
 assert.match(src,/method:'GET'/);
 assert.doesNotMatch(src,/innerHTML|eval\(|setInterval\(|WebSocket|method:\s*['"]POST['"]/);
});
test('GET buyer status is inert; contact, site visit and supplier registration POST routes do not exist',async()=>{
 const report=await readBuyerStatus({root:'/nonexistent-fial513-fixture'});
 let n=0;
 await hub(async()=>{n++;return report},async s=>{
  const page=await request(s,'/operations/');
  assert.equal(page.status,200);assert.match(page.body,/fi-fleet-buyer/);
  const script=await request(s,'/api/operator/buyer/client.js');
  assert.equal(script.status,200);assert.match(script.body,/textContent/);
  const status=await request(s,'/api/operator/buyer/status');
  assert.equal(status.status,200);assert.equal(JSON.parse(status.body).version,VERSION);
  assert.equal(n,1);
  for(const path of ['/api/operator/buyer/status','/api/operator/buyer/contact',
   '/api/operator/buyer/register','/api/operator/buyer/site-visit',
   '/api/operator/buyer/bid','/api/operator/buyer/revenue'])
    assert.equal((await request(s,path,'POST')).status,404)
 })
});
test('forged bus counts, company permission, email, orders or sales cannot leave the dashboard',async()=>{
 const original=await readBuyerStatus({root:'/nonexistent-fial513-fixture'});
 const attacks=[
  {...original,buyer:{...original.buyer,ev_bus_count_verified:22}},
  {...original,buyer:{...original.buyer,elektron_vendor_approved:true}},
  {...original,counts:{...original.counts,verified_open_repair_bids:1}},
  {...original,counts:{...original.counts,verified_revenue_usd:1000}},
  {...original,boundaries:{...original.boundaries,emails_sent:1}},
  {...original,boundaries:{...original.boundaries,phone_calls_placed:1}},
  {...original,decision:{...original.decision,contact_approved:true}}
 ];
 for(const x of attacks)await hub(async()=>x,async s=>
  assert.equal((await request(s,'/api/operator/buyer/status')).status,422))
});
