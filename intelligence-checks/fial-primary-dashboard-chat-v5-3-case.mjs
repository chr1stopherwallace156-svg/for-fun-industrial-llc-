// FIAL5.3: primary 8802 grounded Qwen chat, non-invasive merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {integrateDashboardHtml,createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {GROUNDED_PANEL,GROUNDED_VERSION} from '../src/fial/primary-grounded-ui-v5-3.mjs';
const original='<html><head><title>Control Center</title></head><body><main id="original"><button id="legacy-action">Keep legacy controls</button></main></body></html>';
const unified='<html><head><title>Unified</title></head><body><main><div id="history">Historical conversation</div><section id="action-review">Existing REA approvals</section><button id="rea-confirm">REA review</button></main></body></html>';
const widget='(()=>{window.fixtureWidget=true})()'+' '.repeat(120);
const dummy={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_MODEL_RUN')}};
const commerce={status:async()=>({}),data:async()=>({trends:null,shopify:null}),refreshTrends:async()=>{throw Error('NO_FETCH')}};
const prompt='What approval is required before external tool execution at Fun Industrial?';
async function listen(server){return await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',()=>ok(server)))}
async function query(server,path,{method='GET',origin,click,body,host='127.0.0.1:8802'}={}){
 return new Promise((ok,fail)=>{
  const headers={host};
  if(origin)headers.origin=origin;
  if(click)headers['x-fi-chat-click']='one-local-model-response';
  if(body!==undefined){headers['content-type']='application/json';headers['content-length']=Buffer.byteLength(body)}
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method,headers},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>ok({status:res.statusCode,text:Buffer.concat(chunks).toString('utf8'),headers:res.headers}))});
  req.on('error',fail);req.end(body);
 });
}
test('main 8802 keeps legacy workspace and merges grounded chat into existing Qwen page only',()=>{
 const root=integrateDashboardHtml(original,widget);
 const view=integrateDashboardHtml(unified,widget,{unified:true});
 assert.match(root,/id="legacy-action"/);
 assert.doesNotMatch(root,/id="fi-fial53-grounded"/);
 assert.match(view,/id="fi-fial53-grounded"/);
 assert.match(view,/Existing REA approvals/);
 assert.match(view,/id="rea-confirm"/);
 assert.match(view,/api\/fial\/grounded\/client\.js/);
 assert.match(view,/id="fi-ml-panel"/);
 assert.match(view,/id="fi-commerce-panel"/);
 assert.match(view,/id="fi-fial4-panel"/);
 assert.equal((view.match(/id="fi-fial53-grounded"/g)||[]).length,1);
});
test('primary shell routes ordinary chat to grounded view and never deletes original tools',async()=>{
 const script=await readFile(new URL('../src/ui/integrated-hub-v1.js',import.meta.url),'utf8');
 assert.match(script,/togg\(grounded,view!=='chat'\)/);
 assert.match(script,/togg\(nativeMain,view==='chat'\)/);
 assert.match(script,/action-review/);
 assert.doesNotMatch(script,/innerHTML\s*=|eval\(|method:'POST'/);
});
test('client renders model responses using safe textContent and one click, with no direct external requests',async()=>{
 const script=await readFile(new URL('../src/fial/primary-grounded-client-v5-3.js',import.meta.url),'utf8');
 assert.match(script,/textContent/);
 assert.match(script,/x-fi-chat-click/);
 assert.match(script,/api\/fial\/grounded\/chat/);
 assert.match(script,/REFERENCE_ONLY_MODEL_EMPTY/);
 assert.match(script,/tool/);
 assert.doesNotMatch(script,/innerHTML\s*=|eval\(|setInterval\(|fetch\(['"]https?:\/\//);
});
test('HTTP hub grounded status is read-only and chat requires same-origin click, with no REA actions',async()=>{
 let chatCalls=0,legacyProxy=0;
 const grounded={status:()=>({model_interface:'fixed_local_qwen_8088',memory_interface:'fixed_readonly_cognee_8789',state:'not_used',busy:false}),
  chat:async input=>{chatCalls++;return {state:'ANSWERED_BY_QWEN',answer:'Operator approval is required.',source:'qwen_local',memory_state:'included',memory_excerpts_included:1,tool_executions:0,rea_executions:0,received:input.question}}};
 const hub=await listen(createUnifiedMlHub({ml:dummy,commerce,grounded,
  readPage:async port=>port===8798?unified:original,readWidget:async()=>widget,
  proxy:async()=>{legacyProxy++;throw Error('PROXY_SHOULD_NOT_BE_CALLED')}}));
 try{
  const status=await query(hub,'/api/fial/grounded/status');
  assert.equal(status.status,200);
  assert.equal(JSON.parse(status.text).version,GROUNDED_VERSION);
  assert.equal(chatCalls,0);
  const client=await query(hub,'/api/fial/grounded/client.js');
  assert.equal(client.status,200);assert.match(client.text,/Send/);
  const page=await query(hub,'/unified/?view=chat');
  assert.equal(page.status,200);
  assert.match(page.text,/fi-fial53-grounded/);
  assert.match(page.text,/action-review/);
  const body=JSON.stringify({question:prompt});
  assert.equal((await query(hub,'/api/fial/grounded/chat',{method:'POST',body})).status,403);
  assert.equal((await query(hub,'/api/fial/grounded/chat',{method:'POST',body,origin:'http://evil.invalid',click:true})).status,403);
  assert.equal((await query(hub,'/api/fial/grounded/chat',{method:'POST',body,origin:'http://127.0.0.1:8802'})).status,403);
  assert.equal((await query(hub,'/api/fial/grounded/chat',{method:'POST',body:'{}',origin:'http://127.0.0.1:8802',click:true})).status,422);
  assert.equal(chatCalls,0);
  const result=await query(hub,'/api/fial/grounded/chat',{method:'POST',body,origin:'http://127.0.0.1:8802',click:true});
  assert.equal(result.status,200);
  assert.equal(JSON.parse(result.text).state,'ANSWERED_BY_QWEN');
  assert.equal(chatCalls,1);assert.equal(legacyProxy,0);
  assert.equal((await query(hub,'/api/fial/grounded/unknown')).status,404);
  assert.equal((await query(hub,'/unified/',{host:'evil.invalid'})).status,403);
  assert.equal(legacyProxy,0);
 }finally{await new Promise(ok=>hub.close(ok))}
});
test('non-grounded legacy proxy routes and tool-review UI remain available',async()=>{
 const ports=[];
 const hub=await listen(createUnifiedMlHub({ml:dummy,commerce,grounded:{status:()=>({}),chat:async()=>{throw Error('NOT_ALLOWED')}},
  readPage:async p=>p===8798?unified:original,readWidget:async()=>widget,
  proxy:async(req,res,port)=>{ports.push(port);res.writeHead(200,{'content-type':'application/json'});res.end('{}')}}));
 try{
  assert.equal((await query(hub,'/api/unified/status')).status,200);
  assert.equal((await query(hub,'/api/ai/status')).status,200);
  assert.deepEqual(ports,[8798,8789]);
  const result=await query(hub,'/unified/?view=tools');
  assert.match(result.text,/action-review/);assert.match(result.text,/id="rea-confirm"/);
 }finally{await new Promise(ok=>hub.close(ok))}
});
