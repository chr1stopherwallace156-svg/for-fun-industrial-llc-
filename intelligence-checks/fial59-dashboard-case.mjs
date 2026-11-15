import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {VERSION,CATALOG_VERSION} from '../src/fleet/fleet-sources-v5-9.mjs';
import {readFleetStatus,verifyPublicFleetReport} from '../src/fleet/fleet-engine-v5-9.mjs';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_RUN')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({})};
async function withServer(fleetStatus,fn){
 const server=createUnifiedMlHub({ml,commerce,fleetStatus,
  readPage:async()=>'<html><body>Original controls and Qwen</body></html>',
  readWidget:async()=>'(function(){})();'+' '.repeat(100),
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn(server)}finally{await new Promise(resolve=>server.close(resolve))}
}
function request(server,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,
   method,path,headers:{host:'127.0.0.1:8802'}},res=>{
    const d=[];res.on('data',c=>d.push(c));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(d).toString('utf8')}));
  });req.on('error',reject);req.end()
 })
}
test('new fleet research dashboard is in existing 8802 operations without deleting Qwen or original tools',()=>{
 for(const s of ['fi-fleet-opportunities','fi-fleet-summary','fi-fleet-filter',
 'fi-fleet-queue','fi-fleet-sources','fi-fleet-current-signals','fi-regulatory-intelligence',
 'fi-competence','fi-outcome-status','Qwen Chat'])
  assert.ok(EXEC_PAGE.includes(s),s);
});
test('browser fleet opportunities are strictly same origin, read only and text escaped',async()=>{
 const code=await readFile(new URL('../src/fleet/fleet-console-v5-9.js',import.meta.url),'utf8');
 assert.match(code,/textContent/);
 assert.match(code,/createElement/);
 assert.match(code,/method:'GET'/);
 assert.match(code,/credentials:'same-origin'/);
 assert.doesNotMatch(code,/innerHTML|eval\(|setInterval\(|new WebSocket|method:\s*['"]POST['"]|\.click\(\)/);
});
test('GET fleet status is bounded, inert and contains named historical leads, POST blocked',async()=>{
 const report=await readFleetStatus({root:'/nonexistent-fial59-local-test'});
 assert.equal(report.state,'NOT_ACTIVATED');
 assert.equal(report.source_catalog_version,VERSION);
 let calls=0;
 await withServer(async()=>{calls++;return report},async server=>{
  const page=await request(server,'/operations/');
  assert.equal(page.status,200);
  assert.match(page.body,/fi-fleet-opportunities/);
  const client=await request(server,'/api/operator/fleet/client.js');
  assert.equal(client.status,200);
  assert.match(client.body,/textContent/);
  const res=await request(server,'/api/operator/fleet/status');
  assert.equal(res.status,200);
  const r=JSON.parse(res.body);
  assert.equal(r.version,'fial5.9-fleet-opportunity-evidence-v1');
  assert.ok(r.prospects.length>=30);
  assert.equal(r.counts.verified_open_rfps,0);
  assert.equal(calls,1);
  assert.equal((await request(server,'/api/operator/fleet/status','POST')).status,404);
  assert.equal((await request(server,'/api/operator/fleet/run','POST')).status,404);
 });
});
test('forged funding contract fields and elevated REA counts are rejected by 8802',async()=>{
 const prior=await readFleetStatus({root:'/nonexistent-fial59-local-test'});
 const loaded={...prior,state:'PUBLISHED_HISTORICAL_FLEET_PROSPECTS_AND_OFFICIAL_SOURCE_MONITOR',
  sources:[{id:'x'}]}; // malformed, should be held
 await withServer(async()=>loaded,async server=>{
  assert.equal((await request(server,'/api/operator/fleet/status')).status,422);
 });
 assert.equal(verifyPublicFleetReport({...loaded,boundaries:{...loaded.boundaries,rea_calls:1}}),false);
});
