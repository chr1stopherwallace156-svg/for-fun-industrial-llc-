import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
 assert.doesNotMatch(PREVIEW_HTML,/https?:\/\/|<script[^>]*>[\s\S]*?<\/script>/);
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
