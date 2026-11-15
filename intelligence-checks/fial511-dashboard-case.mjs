import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {readFitStatus,VERSION} from '../src/fit/commercial-fit-engine-v5-11.mjs';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('UNAUTHORIZED')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({})};
async function withHub(fitStatus,fn){
 const hub=createUnifiedMlHub({ml,commerce,fitStatus,
  readPage:async()=>'<html><body>Existing Qwen tools and review</body></html>',
  readWidget:async()=>'(function(){})();'+' '.repeat(120),
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(ok=>hub.listen(0,'127.0.0.1',ok));
 try{await fn(hub)}finally{await new Promise(ok=>hub.close(ok))}
}
function request(hub,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:hub.address().port,
   method,path,headers:{host:'127.0.0.1:8802'}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
  });req.on('error',reject);req.end()
 })
}
test('existing dashboard Operations includes qualification and all earlier modules',()=>{
 for(const x of ['fi-commercial-fit','fi-fit-summary','fi-fit-queue','fi-fit-sources',
  'fi-procurement','fi-fleet-opportunities','fi-regulatory-intelligence',
  'fi-competence','fi-outcome-status','Qwen Chat'])assert.ok(EXEC_PAGE.includes(x),x)
});
test('qualification frontend never uses HTML injection or silently submits anything',async()=>{
 const code=await readFile(new URL('../src/fit/commercial-fit-console-v5-11.js',import.meta.url),'utf8');
 assert.match(code,/textContent/);assert.match(code,/method:'GET'/);
 assert.match(code,/credentials:'same-origin'/);
 assert.doesNotMatch(code,/innerHTML|eval\(|method:\s*['"]POST['"]|api\/rea\/|setInterval|<script/);
});
test('fit API returns cached researched qualification without invoking tools or outbound network',async()=>{
 const status=await readFitStatus({root:'/nonexistent-fial511-for-dashboard-tests'});
 let called=0;
 await withHub(async()=>{called++;return status},async hub=>{
  const page=await request(hub,'/operations/');
  assert.equal(page.status,200);assert.match(page.body,/fi-commercial-fit/);
  const js=await request(hub,'/api/operator/fit/client.js');
  assert.equal(js.status,200);assert.match(js.body,/textContent/);
  const result=await request(hub,'/api/operator/fit/status');
  assert.equal(result.status,200);
  assert.equal(JSON.parse(result.body).version,VERSION);
  assert.equal(called,1);
  for(const path of ['/api/operator/fit/status','/api/operator/fit/refresh','/api/operator/fit/bid'])
   assert.equal((await request(hub,path,'POST')).status,404);
 })
});
test('forged ELEKTRON qualifications, revenue, award or executable authority blocked at dashboard',async()=>{
 const original=await readFitStatus({root:'/nonexistent-fial511-for-dashboard-tests'});
 for(const fake of [
  {...original,boundaries:{...original.boundaries,emails_sent:1}},
  {...original,boundaries:{...original.boundaries,bids_submitted:1}},
  {...original,counts:{...original.counts,directly_qualified_bids:1}},
  {...original,counts:{...original.counts,actual_revenue_usd:55000}},
  {...original,opportunities:[{...original.opportunities[0],direct_bid_ready:true},...original.opportunities.slice(1)]},
 ]){
  await withHub(async()=>fake,async hub=>
   assert.equal((await request(hub,'/api/operator/fit/status')).status,422));
 }
});
