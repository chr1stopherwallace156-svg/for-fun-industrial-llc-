import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {integrateDashboardHtml,createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE,EXEC_CONSOLE_VERSION} from '../src/operator/executive-console-v1.mjs';
import {VERSION,PROHIBITED} from '../src/operator/executive-ops-v1.mjs';
const source='<!doctype html><html lang="en"><head><title>Test</title></head><body><main><section id="action-review">Operator actions</section></main></body></html>';
const widget='(()=>{window.mlPanelWidgetReady=true})();'+' '.repeat(100);
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_ML_RUN')}};
const commerce={status:async()=>({version:'fun-commerce-intelligence-v1'}),data:async()=>({trends:null,shopify:null})};
const status=()=>({version:VERSION,cycle_utc:'2026-11-14T20:20:00Z',items:[{kind:'mail',title:'Follow-up review',company:'fun',due:null,priority:45,required:['Review recipient']}],
 active_items:1,new_or_changed:1,review_required:1,
 mail_state:'not_connected',domains:['mail','filings','configuration','projects'],
 grants:{state:'no_verified_local_snapshot'},outbound_permissions:PROHIBITED});
async function serverTest(fn,executor){
 const server=createUnifiedMlHub({ml,commerce,executiveStatus:fn,
  readPage:async()=>source,readWidget:async()=>widget,
  proxy:async(req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({legacy:true}))}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{return await executor(server)}
 finally{await new Promise(resolve=>server.close(resolve))}
}
function request(server,path,{method='GET',origin,host='127.0.0.1:8802'}={}){
 return new Promise((resolve,reject)=>{
  const headers={host};if(origin)headers.origin=origin;
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method,headers},
   res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),headers:res.headers}))});
  req.on('error',reject);req.end();
 });
}
test('executive link appears in the primary dashboard without removing prior controls',()=>{
 const page=integrateDashboardHtml(source,widget,{unified:true});
 assert.match(page,/href="\/operations\/">Executive Assistant/);
 assert.match(page,/id="action-review"/);
 assert.match(page,/fi-fial53-grounded/);
 assert.match(page,/id="fi-ml-panel"/);
 assert.match(page,/id="fi-commerce-panel"/);
});
test('new executive console uses locally served client and textContent, no action buttons',async()=>{
 const client=await readFile(new URL('../src/operator/executive-console-client-v1.js',import.meta.url),'utf8');
 assert.match(EXEC_PAGE,/Executive Assistant/);
 assert.match(EXEC_PAGE,/api\/operator\/client.js/);
 assert.match(EXEC_PAGE,/fi-exec-queue/);
 assert.match(client,/textContent/);
 assert.doesNotMatch(client,/(?:innerHTML|eval\(|fetch\(['"]https?:\/\/|method:'POST'|setInterval\()/);
});
test('primary 8802 serves status read-only, never changes state or routes to REA',async()=>{
 let calls=0;
 await serverTest(async()=>{calls++;return status()},async server=>{
  const home=await request(server,'/');
  assert.equal(home.status,200);assert.match(home.body,/Executive Assistant/);
  const consolePage=await request(server,'/operations/');
  assert.equal(consolePage.status,200);
  assert.match(consolePage.headers['content-security-policy'],/script-src 'self'/);
  const client=await request(server,'/api/operator/client.js');
  assert.equal(client.status,200);assert.match(client.body,/read-only/);
  const statusReq=await request(server,'/api/operator/status');
  assert.equal(statusReq.status,200);
  const data=JSON.parse(statusReq.body);
  assert.equal(data.version,VERSION);
  assert.equal(data.console_version,EXEC_CONSOLE_VERSION);
  assert.equal(data.active_items,1);
  assert.equal(data.outbound_permissions.government_filings,0);
  assert.equal(data.outbound_permissions.email_sent,0);
  assert.equal(calls,1);
  assert.equal((await request(server,'/api/operator/status',{method:'POST',origin:'http://127.0.0.1:8802'})).status,404);
  assert.equal((await request(server,'/api/operator/action')).status,404);
  assert.equal((await request(server,'/operations/',{host:'evil.example'})).status,403);
  assert.equal(calls,1);
 });
});
test('an elevated or malformed local ledger fails closed and does not expose action grants',async()=>{
 await serverTest(async()=>({...status(),outbound_permissions:{...PROHIBITED,email_sent:1}}),async server=>{
  const r=await request(server,'/api/operator/status');
  assert.equal(r.status,422);assert.match(r.body,/EXEC_OPERATOR_STATUS_UNVERIFIED/);
 });
});
