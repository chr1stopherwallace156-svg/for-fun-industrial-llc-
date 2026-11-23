import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {PREVIEW_HTML,PREVIEW_VERSION} from '../src/ui/organized-preview-v1.mjs';
import {previewQwenHealth} from '../src/ui/organized-preview-health-v1.mjs';
import {DASHBOARD_HTML,DASHBOARD_VERSION} from '../src/ui/oneport-dashboard-v1.mjs';
const css=new URL('../src/ui/organized-preview-v1.css',import.meta.url);
const client=new URL('../src/ui/organized-preview-v1.js',import.meta.url);

test('production dashboard source is unchanged and preview has separate route',()=>{
 assert.equal(DASHBOARD_VERSION,'fun-industrial-one-port-spatial-ux-v2');
 assert.ok(DASHBOARD_HTML.includes('fi-app'));
 assert.ok(!DASHBOARD_HTML.includes('organized-preview-v1'));
 assert.equal(PREVIEW_VERSION,'fun-industrial-organized-ui-preview-v1');
 assert.match(PREVIEW_HTML,/href="\/api\/fun\/ui-preview\/app.css"/);
 assert.match(PREVIEW_HTML,/src="\/api\/fun\/ui-preview\/app.js"/);
 assert.match(PREVIEW_HTML,/href="\/"/);
});
test('all seven groups and primary destinations are real links and views',()=>{
 const routes=['home','chat','research','operations','commerce','tools','system'];
 for(const route of routes){
  assert.ok(PREVIEW_HTML.includes('data-view="'+route+'"'),'missing '+route+' view');
  assert.ok(PREVIEW_HTML.includes('data-route="'+route+'"'),'missing '+route+' navigation');
 }
 assert.ok(PREVIEW_HTML.includes('href="/math/v3/"'));
 assert.ok(PREVIEW_HTML.includes('href="/chat/"'));
 assert.ok(PREVIEW_HTML.includes('href="/operations/"'));
 assert.ok(PREVIEW_HTML.includes('href="/control/"'));
});
test('responsive CSS and no remote dependencies or scripts',async()=>{
 const style=await readFile(css,'utf8'),code=await readFile(client,'utf8');
 assert.match(style,/@media\(max-width:780px\)/);
 assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(code,/fetch\('\/api\/fial\/grounded\/chat'/);
 assert.match(code,/useMathV3Evidence/);
 assert.match(code,/if\(chatBusy\)return/);
 assert.match(code,/textContent/);
 assert.doesNotMatch(PREVIEW_HTML,/https?:\/\//);
 assert.doesNotMatch(PREVIEW_HTML,/<script(?![^>]*\bsrc=)[^>]*>/i);
 assert.doesNotMatch(code,/localStorage|sessionStorage|WebSocket|setInterval|document\.write/);
 assert.doesNotMatch(style,/url\(\s*["']?https?:/);
});
test('Qwen health is verified with read-only GET and no new model',async()=>{
 let calls=0;
 const mock=async(url,init)=>{
  calls++;
  assert.equal(url,'http://127.0.0.1:8088/health');
  assert.equal(init.method,'GET');
  return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({status:'ok'})};
 };
 const ready=await previewQwenHealth({fetchImpl:mock,timeoutMs:100});
 assert.equal(calls,1);assert.equal(ready.ready,true);assert.equal(ready.modelStart,false);
 assert.equal(ready.state,'READY');
});
test('unavailable Qwen never gets represented as healthy',async()=>{
 const fetchImpl=async()=>{throw Error('connection refused')};
 const result=await previewQwenHealth({fetchImpl,timeoutMs:100});
 assert.equal(result.ready,false);assert.equal(result.state,'OFFLINE_OR_UNVERIFIED');
});

test('HTTP preview is served on existing one-port app and does not replace /',async()=>{
 const server=createUnifiedMlHub({
  ml:{},commerce:{},
  grounded:{status:()=>({})},
  reviewedDispatch:{},reviewedCompute:{}
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 function request(path,method='GET'){
  return new Promise((resolve,reject)=>{
   const req=http.request({hostname:'127.0.0.1',port,path,method,
    headers:{host:'127.0.0.1:8802'}},res=>{
    let data='';res.setEncoding('utf8');res.on('data',c=>data+=c);
    res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:data}));
   });
   req.on('error',reject);req.end();
  });
 }
 try{
  const existing=await request('/');
  const preview=await request('/ui-preview/');
  const css=await request('/api/fun/ui-preview/app.css');
  const js=await request('/api/fun/ui-preview/app.js');
  const denied=await request('/api/fun/ui-preview/health','POST');
  assert.equal(existing.status,200);
  assert.equal(existing.body,DASHBOARD_HTML);
  assert.equal(preview.status,200);
  assert.equal(preview.headers['x-fi-preview-version'],PREVIEW_VERSION);
  assert.match(preview.headers['content-security-policy'],/frame-src 'self'/);
  assert.match(preview.body,/data-view="chat"/);
  assert.equal(css.status,200);assert.match(css.headers['content-type'],/text\/css/);
  assert.equal(js.status,200);assert.match(js.body,/useMathV3Evidence/);
  assert.equal(denied.status,404);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
