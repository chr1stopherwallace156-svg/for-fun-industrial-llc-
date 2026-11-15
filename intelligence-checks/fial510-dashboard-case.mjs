import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {readProcurementStatus,VERSION} from '../src/procurement/procurement-engine-v5-10.mjs';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NOT_AUTHORIZED')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({})};
async function withServer(procurementStatus,fn){
 const server=createUnifiedMlHub({ml,commerce,procurementStatus,
  readPage:async()=>'<html><body>existing Qwen tools</body></html>',
  readWidget:async()=>'(function(){})();'+' '.repeat(100),
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{await fn(server)}finally{await new Promise(ok=>server.close(ok))}
}
async function get(server,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,
   path,method,headers:{host:'127.0.0.1:8802'}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
  });req.once('error',reject);req.end()
 })
}
test('published procurement panel is present alongside every existing business, fleet and regulatory control',()=>{
 for(const id of ['fi-procurement','fi-procurement-status','fi-procurement-notices',
  'fi-procurement-sources','fi-fleet-opportunities','fi-regulatory-intelligence',
  'fi-competence','fi-outcome-status','Qwen Chat'])assert.match(EXEC_PAGE,new RegExp(id))
});
test('browser display is read-only and safely escapes the official issuer content',async()=>{
 const code=await readFile(new URL('../src/procurement/procurement-console-v5-10.js',import.meta.url),'utf8');
 assert.match(code,/textContent/);
 assert.match(code,/createElement/);
 assert.match(code,/method:'GET'/);
 assert.doesNotMatch(code,/innerHTML|eval\(|setInterval\(|WebSocket|method:\s*['"]POST['"]/);
});
test('GET serves source-linked notice with zero bid authority; prohibited POST does nothing',async()=>{
 const report=await readProcurementStatus({root:'/nonexistent-fial510-fixture'});
 let calls=0;
 await withServer(async()=>{calls++;return report},async server=>{
  const page=await get(server,'/operations/');
  assert.equal(page.status,200);
  assert.match(page.body,/fi-procurement/);
  const client=await get(server,'/api/operator/procurement/client.js');
  assert.equal(client.status,200);
  assert.match(client.body,/textContent/);
  const status=await get(server,'/api/operator/procurement/status');
  assert.equal(status.status,200);
  assert.equal(JSON.parse(status.body).version,VERSION);
  assert.equal(calls,1);
  assert.equal((await get(server,'/api/operator/procurement/status','POST')).status,404);
  assert.equal((await get(server,'/api/operator/procurement/bid','POST')).status,404);
  assert.equal((await get(server,'/api/operator/procurement/refresh','POST')).status,404);
 });
});
test('elevated revenue, emails or vendor fitness status are refused at REST boundary',async()=>{
 const original=await readProcurementStatus({root:'/nonexistent-fial510-fixture'});
 for(const fake of [
  {...original,boundaries:{...original.boundaries,rea_calls:1}},
  {...original,boundaries:{...original.boundaries,emails_sent:1}},
  {...original,counts:{...original.counts,verified_fit_for_elektron:1}},
  {...original,verified_current_published_notices:[{id:'fabricated'}]},
 ]){
  await withServer(async()=>fake,async server=>{
   assert.equal((await get(server,'/api/operator/procurement/status')).status,422)
  })
 }
});
