import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {readReadinessStatus,VERSION} from '../src/bid-readiness/readiness-engine-v5-12.mjs';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('UNAUTHORIZED')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({})};
async function withHub(bidStatus,fn){
 const server=createUnifiedMlHub({ml,commerce,bidStatus,
  readPage:async()=>'<html><body>Existing tools and Qwen</body></html>',
  readWidget:async()=>'(function(){})();'+' '.repeat(120),
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn(server)}finally{await new Promise(resolve=>server.close(resolve))}
}
function request(server,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,
   method,path,headers:{host:'127.0.0.1:8802'}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
  });req.on('error',reject);req.end()
 })
}
test('bid readiness panel preserves all existing business/fleet/regulatory and Qwen areas',()=>{
 for(const id of ['fi-bid-readiness','fi-bid-summary','fi-bid-leads','fi-bid-sources',
  'fi-commercial-fit','fi-procurement','fi-fleet-opportunities',
  'fi-regulatory-intelligence','fi-competence','fi-outcome-status','Qwen Chat'])
  assert.ok(EXEC_PAGE.includes(id),id)
});
test('new client uses safe textContent, exact GET and no autonomous POST or HTML injection',async()=>{
 const src=await readFile(new URL('../src/bid-readiness/readiness-console-v5-12.js',import.meta.url),'utf8');
 assert.match(src,/textContent/);
 assert.match(src,/credentials:'same-origin'/);
 assert.match(src,/method:'GET'/);
 assert.doesNotMatch(src,/innerHTML|eval\(|WebSocket|setInterval|method:\s*['"]POST['"]|api\/rea\//)
});
test('public status is inert and manual bid or outreach POST route does not exist',async()=>{
 const report=await readReadinessStatus({root:'/nonexistent-fial512-dashboard-fixture'});
 let n=0;
 await withHub(async()=>{n++;return report},async s=>{
  const page=await request(s,'/operations/');
  assert.equal(page.status,200);assert.match(page.body,/fi-bid-readiness/);
  const js=await request(s,'/api/operator/bid-readiness/client.js');
  assert.equal(js.status,200);assert.match(js.body,/textContent/);
  const status=await request(s,'/api/operator/bid-readiness/status');
  assert.equal(status.status,200);
  assert.equal(JSON.parse(status.body).version,VERSION);
  assert.equal(n,1);
  for(const route of ['/api/operator/bid-readiness/status',
   '/api/operator/bid-readiness/bid','/api/operator/bid-readiness/contact',
   '/api/operator/bid-readiness/apply'])
   assert.equal((await request(s,route,'POST')).status,404)
 })
});
test('forged licenses, bids or revenue never escape the API boundary',async()=>{
 const r=await readReadinessStatus({root:'/nonexistent-fial512-dashboard-fixture'});
 const attacks=[
  {...r,counts:{...r.counts,verified_bid_ready:1}},
  {...r,counts:{...r.counts,actual_revenue_usd:100000}},
  {...r,boundaries:{...r.boundaries,emails_sent:1}},
  {...r,boundaries:{...r.boundaries,registrations_made:1}},
  {...r,leads:[{...r.leads[0],direct_bid_ready:true},r.leads[1]]},
  {...r,leads:[{...r.leads[0],verified_eligibility:true},r.leads[1]]},
  {...r,leads:[{...r.leads[0],buyer_accepting_submissions_verified:true},r.leads[1]]}
 ];
 for(const bad of attacks)await withHub(async()=>bad,async s=>{
  const response=await request(s,'/api/operator/bid-readiness/status');
  assert.equal(response.status,422)
 })
});
