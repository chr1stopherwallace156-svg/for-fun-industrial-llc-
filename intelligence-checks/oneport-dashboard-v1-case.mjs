// One-port UI integration: HTTP contracts, embedded CSP, original routes and zero new actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {DASHBOARD_HTML,DASHBOARD_VERSION} from '../src/ui/oneport-dashboard-v1.mjs';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_RUN')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({}),
 refreshTrends:async()=>{throw Error('NO_EXTERNAL_REFRESH')},refreshShopify:async()=>{throw Error('NO_EXTERNAL_SYNC')}};
const original='<!doctype html><html><head><title>Original</title></head><body><main><button id="original-action">Legacy kept</button></main></body></html>';
const unified='<!doctype html><html><head><title>Unified</title></head><body><main><div id="history">Chat</div><textarea id="task"></textarea><section id="action-review">REA approved controls</section></main></body></html>';
const widget='(()=>{document.querySelector("#fi-ml-panel")})()'+' '.repeat(100);
async function withHub(fn){
 let pageReads=0,proxyCount=0;
 const hub=createUnifiedMlHub({ml,commerce,
  readPage:async port=>{pageReads++;return port===8798?unified:original},
  readWidget:async()=>widget,proxy:async()=>{proxyCount++;throw Error('NO_UPSTREAM_PROXY')}});
 await new Promise(resolve=>hub.listen(0,'127.0.0.1',resolve));
 try{await fn(hub,()=>({pageReads,proxyCount}))}
 finally{await new Promise(resolve=>hub.close(resolve))}
}
function request(hub,path,{method='GET',host='127.0.0.1:8802',origin}={}){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:hub.address().port,
   method,path,headers:{host,...origin?{origin}:{}}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));
    res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
  });req.once('error',reject);req.end()
 })
}
test('one localhost home has a single cohesive sidebar with no separate port links',()=>{
 assert.match(DASHBOARD_HTML,/id="fi-app"/);
 assert.match(DASHBOARD_HTML,/fi-sidebar/);
 assert.match(DASHBOARD_HTML,/href="#chat"/);
 for(const section of ['operations','buyers','procurement','commercial','regulatory','commerce','ml','tools','workspace'])
  assert.match(DASHBOARD_HTML,new RegExp('data-section="'+section+'"'));
 assert.match(DASHBOARD_HTML,/api\/oneport\/style.css/);
 assert.match(DASHBOARD_HTML,/api\/oneport\/client.js/);
 assert.doesNotMatch(DASHBOARD_HTML,/https?:\/\/|src="http|:8789|:8798|:8088|:8801|iframe[^>]+src/);
 assert.equal((DASHBOARD_HTML.match(/id="fi-sidebar"/g)||[]).length,1);
});
test('one-port dashboard client only mounts same-origin modules and reads status',async()=>{
 const js=await readFile(new URL('../src/ui/oneport-dashboard-v1.js',import.meta.url),'utf8');
 assert.match(js,/location.hash/);
 assert.match(js,/createElement\('iframe'\)/);
 assert.match(js,/\/operations\/\?embedded=1/);
 assert.match(js,/\/workspace\/\?view=/);
 assert.match(js,/\/unified\/\?view=chat&embedded=1/);
 assert.match(js,/\/unified\/\?view=tools&embedded=1/);
 assert.match(js,/method:'GET'/);
 assert.match(js,/Promise\.allSettled/);
 assert.doesNotMatch(js,/innerHTML\s*=|eval\(|setInterval\(|method:'POST'|fetch\(['"]https?:\/\//);
});
test('responsive styles and safe original module implementation are present',async()=>{
 const css=await readFile(new URL('../src/ui/oneport-dashboard-v1.css',import.meta.url),'utf8');
 const embed=await readFile(new URL('../src/ui/oneport-embedded-v1.css',import.meta.url),'utf8');
 const op=await readFile(new URL('../src/ui/oneport-embedded-operations-v1.js',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:880px\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/focus-visible/);
 assert.match(css,/\.fi-sidebar/);
 assert.match(embed,/#fi-ui-shell/);
 assert.match(embed,/body>header/);
 assert.match(op,/document\.getElementById\(target\)/);
 assert.doesNotMatch(op,/innerHTML|eval\(|fetch\(|method:'POST'/);
});
test('GET home is new one-port shell while original controls and Qwen are kept on 8802',async()=>{
 await withHub(async(hub,counters)=>{
  const start=counters();
  const home=await request(hub,'/');
  assert.equal(home.status,200);
  assert.equal(home.headers['x-fi-dashboard-version'],DASHBOARD_VERSION);
  assert.match(home.body,/id="fi-app"/);
  assert.match(home.headers['content-security-policy'],/frame-src 'self'/);
  assert.equal(counters().pageReads,start.pageReads);
  const old=await request(hub,'/workspace/?view=ml&embedded=1');
  assert.equal(old.status,200);
  assert.match(old.body,/original-action/);
  assert.match(old.body,/api\/oneport\/embed.css/);
  assert.match(old.headers['content-security-policy'],/frame-ancestors 'self'/);
  const chat=await request(hub,'/unified/?view=chat&embedded=1');
  assert.equal(chat.status,200);
  assert.match(chat.body,/id="action-review"/);
  assert.match(chat.body,/fi-fial53-grounded/);
  assert.match(chat.headers['content-security-policy'],/frame-ancestors 'self'/);
  const ops=await request(hub,'/operations/?embedded=1');
  assert.equal(ops.status,200);
  assert.match(ops.body,/fi-purchase-demand/);
  assert.match(ops.body,/oneport\/embed-operations.js/);
  assert.match(ops.headers['content-security-policy'],/frame-ancestors 'self'/);
  assert.equal(counters().proxyCount,0)
 })
});
test('same-origin assets served from primary port; unknown UI action routes and external hosts blocked',async()=>{
 await withHub(async hub=>{
  for(const url of ['/api/oneport/style.css','/api/oneport/client.js',
   '/api/oneport/embed.css','/api/oneport/embed-operations.js']){
   const r=await request(hub,url);
   assert.equal(r.status,200,url);
   assert.ok(r.body.length>80,url)
  }
  assert.equal((await request(hub,'/api/oneport/unreviewed-action',{method:'POST',
   origin:'http://127.0.0.1:8802'})).status,404);
  assert.equal((await request(hub,'/api/oneport/client.js',{host:'not-local.example'})).status,403);
  assert.equal((await request(hub,'/operations/?embedded=1',{host:'not-local.example'})).status,403)
 })
});
