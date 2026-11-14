// FUN_INTEGRATED_CONTROL_CENTER_UI_V1: offline UI and route compatibility checks.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {SHELL,UI_CSS,UI_CLIENT,UI_VIEWS} from '../src/ui/integrated-hub-shell-v1.mjs';
import {integrateDashboardHtml,createUnifiedMlHub,HOST} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';

const original='<!doctype html><html lang="en"><head><title>Original</title></head><body><main><h1>Original dashboard</h1><button id="legacy-start">Original action</button></main><script>window.originalStillPresent=true;</script></body></html>';
const unified='<!doctype html><html lang="en"><head><title>Unified</title></head><body><main><div id="history">Conversation</div><textarea id="task"></textarea><button id="send">Send</button><section id="v3-panel">REA review</section><section id="v31-panel">Staged review</section></main><script src="/api/unified/client.js" defer></script></body></html>';
const mlWidget='(()=>{document.getElementById("fi-ml-panel").setAttribute("data-test","ok")})();'+' '.repeat(80);
const uiScript=()=>readFile(UI_CLIENT,'utf8');
const uiStyles=()=>readFile(UI_CSS,'utf8');

test('the same six-view navigation is present on existing and unified pages',()=>{
 assert.deepEqual(UI_VIEWS,['overview','commerce','ml','chat','tools','workspace']);
 const main=integrateDashboardHtml(original,mlWidget);
 const chat=integrateDashboardHtml(unified,mlWidget,{unified:true});
 for(const page of [main,chat]){
  assert.match(page,/id="fi-ui-shell"/);
  assert.match(page,/data-fi-view="overview"/);
  assert.match(page,/data-fi-view="commerce"/);
  assert.match(page,/data-fi-view="ml"/);
  assert.match(page,/data-fi-view="chat"/);
  assert.match(page,/data-fi-view="tools"/);
  assert.match(page,/data-fi-view="workspace"/);
  assert.match(page,/href="\/api\/ui\/style\.css"/);
  assert.match(page,/src="\/api\/ui\/client\.js" defer/);
  assert.match(page,/id="fi-commerce-panel"/);
  assert.match(page,/id="fi-ml-panel"/);
  assert.equal((page.match(/id="fi-ui-shell"/g)||[]).length,1);
 }
 assert.match(main,/Original action/);
 assert.match(main,/window\.originalStillPresent=true/);
 assert.match(main,/data-test/);
 assert.match(chat,/id="history"/);
 assert.match(chat,/id="v31-panel"/);
 assert.match(chat,/src="\/api\/unified\/client\.js"/);
 assert.match(chat,/src="\/api\/ml\/dashboard\/widget\.js"/);
 assert.doesNotMatch(chat,/data-test/);
});
test('client script retains original DOM and uses bounded read-only status checks only',async()=>{
 const script=await uiScript();
 assert.match(script,/FUN_INTEGRATED_CONTROL_CENTER_UI_V1/);
 assert.match(script,/document\.body\.classList\.add\('fi-ui-ready'\)/);
 assert.match(script,/a\.addEventListener\('click'/);
 assert.match(script,/history\.pushState/);
 assert.match(script,/popstate/);
 assert.match(script,/fi-ui-hidden/);
 assert.match(script,/action-review/);
 assert.match(script,/credentials:'same-origin'/);
 assert.match(script,/method:'GET'/);
 assert.match(script,/Promise\.allSettled/);
 assert.match(script,/if\(!shell\|\|!commerce\|\|!ml\)return/);
 assert.doesNotMatch(script,/method:'POST'|fetch\('https?:\/\/|innerHTML\s*=|setInterval|eval\(/);
});
test('responsive CSS includes accessible states and a safe fallback to the original UI',async()=>{
 const style=await uiStyles();
 assert.match(style,/#fi-ui-shell\{isolation:isolate;display:none/);
 assert.match(style,/body\.fi-ui-ready #fi-ui-shell\{display:block\}/);
 assert.match(style,/@media \(max-width:850px\)/);
 assert.match(style,/@media \(max-width:490px\)/);
 assert.match(style,/prefers-reduced-motion/);
 assert.match(style,/focus-visible/);
 assert.match(style,/\.fi-ui-hidden\{display:none!important\}/);
});
async function listen(server){
 return await new Promise((resolve,reject)=>server.once('error',reject).listen(0,HOST,()=>resolve(server)));
}
async function request(server,path){
 return await new Promise((resolve,reject)=>{
  const req=http.request({hostname:HOST,port:server.address().port,path,method:'GET',
   headers:{host:'127.0.0.1:8802'}},res=>{
    const chunks=[];res.on('data',x=>chunks.push(x));
    res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString('utf8'),headers:res.headers}));
   });
  req.once('error',reject);req.end();
 });
}
test('the live HTTP adapter serves only immutable UI assets, without proxying or action execution',async()=>{
 let proxyCount=0,runCount=0,fetchCount=0;
 const ml={status:async()=>({state:'ready'}),run:async()=>{runCount++;throw Error('UNEXPECTED_RUN')}};
 const commerce={
  status:async()=>({version:'fun-commerce-intelligence-v1'}),
  data:async()=>({trends:null,shopify:null}),
  refreshTrends:async()=>{fetchCount++;throw Error('UNEXPECTED_FETCH')},
  refreshShopify:async()=>{fetchCount++;throw Error('UNEXPECTED_FETCH')}
 };
 const server=await listen(createUnifiedMlHub({
  ml,commerce,readPage:async p=>p===8798?unified:original,readWidget:async()=>mlWidget,
  proxy:async()=>{proxyCount++;throw Error('UNEXPECTED_PROXY')}
 }));
 try{
  const css=await request(server,'/api/ui/style.css');
  const js=await request(server,'/api/ui/client.js');
  assert.equal(css.status,200);assert.match(css.headers['content-type'],/^text\/css/);
  assert.equal(js.status,200);assert.match(js.headers['content-type'],/^text\/javascript/);
  assert.match(css.text,/FUN_INTEGRATED_CONTROL_CENTER_UI_V1/);
  assert.match(js.text,/FUN_INTEGRATED_CONTROL_CENTER_UI_V1/);
  for(const path of ['/','/unified/']){
   const page=await request(server,path);
   assert.equal(page.status,200);
   assert.match(page.text,/id="fi-ui-shell"/);
   assert.match(page.headers['content-security-policy'],/script-src 'self'/);
   assert.match(page.headers['content-security-policy'],/style-src 'self'/);
  }
  assert.equal(proxyCount,0);assert.equal(runCount,0);assert.equal(fetchCount,0);
  assert.equal((await request(server,'/api/ui/not-allowed')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
