// A real copied MIT interactive library, not a fake static Spline screenshot.
// The Spline-style spatial scene is original CSS geometry with opt-in pointer tilt.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {DASHBOARD_HTML,DASHBOARD_VERSION} from '../src/ui/oneport-dashboard-v1.mjs';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';

const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_ML_RUN')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({})};
async function withHub(fn){
 const hub=createUnifiedMlHub({ml,commerce,
  readPage:async()=>'<html><head></head><body><main>Original functionality</main></body></html>',
  readWidget:async()=>'(function(){})();'+' '.repeat(120),
  proxy:async()=>{throw Error('NO_UPSTREAM')}});
 await new Promise(resolve=>hub.listen(0,'127.0.0.1',resolve));
 try{await fn(hub)}finally{await new Promise(resolve=>hub.close(resolve))}
}
function request(hub,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:hub.address().port,
   path,method,headers:{host:'127.0.0.1:8802'}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));
    res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,
     text:Buffer.concat(chunks).toString('utf8')}));
  });req.once('error',reject);req.end()
 })
}
test('v2 uses genuine original dimensional scene + separately licensed local open source vendor',async()=>{
 assert.equal(DASHBOARD_VERSION,'fun-industrial-one-port-spatial-ux-v2');
 for(const x of ['id="fi-spatial-stage"','fi-spatial-orbit','fi-spatial-device',
  'fi-spatial-chip-ai','fi-spatial-chip-ops','fi-spatial-chip-ml',
  'fi-command-open','fi-command-dialog','fi-command-input',
  '/api/oneport/vendor/vanilla-tilt.js']){
  assert.ok(DASHBOARD_HTML.includes(x),x)
 }
 const src=await readFile(new URL('../src/ui/vendor/vanilla-tilt-1.8.1.js',import.meta.url),'utf8');
 const license=await readFile(new URL('../src/ui/vendor/VANILLA-TILT-LICENSE.txt',import.meta.url),'utf8');
 assert.match(src,/VanillaTilt/);assert.match(src,/Version 1\.8\.1/);
 assert.match(license,/MIT License/);
 assert.match(license,/Copyright \(c\) 2017/);
});
test('command palette is keyboard searchable and only routes to existing local hash sections',async()=>{
 const src=await readFile(new URL('../src/ui/oneport-dashboard-v1.js',import.meta.url),'utf8');
 for(const x of ['e.ctrlKey||e.metaKey','ArrowDown','ArrowUp','Enter',
  'showModal()','close()','createElement','replaceChildren','window.location.hash',
  'data-spatial-card','VanillaTilt.init','pointer: fine','prefers-reduced-motion']){
  assert.ok(src.includes(x),x)
 }
 assert.doesNotMatch(src,/innerHTML\s*=|eval\(|method:\s*['"]POST['"]|setInterval\(|location\.href=['"]https:\/\//);
});
test('spatial visual effects honor accessibility, pointer and device performance',async()=>{
 const css=await readFile(new URL('../src/ui/oneport-dashboard-v1.css',import.meta.url),'utf8');
 for(const x of ['fi-spatial-stage','fi-spatial-orbit','fi-spatial-device',
   'fi-gradient-word','fi-command-dialog','fi-command-results',
   'focus-visible','prefers-reduced-motion','max-width:880px']){
  assert.ok(css.includes(x),x)
 }
 assert.match(css,/\.fi-spatial-chip\s*\{animation:none/);
});
test('same-origin real asset URLs are GET-only on the single 8802 listener',async()=>{
 await withHub(async server=>{
  const home=await request(server,'/');
  assert.equal(home.status,200);
  assert.equal(home.headers['x-fi-dashboard-version'],DASHBOARD_VERSION);
  assert.match(home.text,/api\/oneport\/vendor\/vanilla-tilt.js/);
  const vendor=await request(server,'/api/oneport/vendor/vanilla-tilt.js');
  assert.equal(vendor.status,200);
  assert.match(vendor.text,/VanillaTilt/);
  assert.match(vendor.headers['content-type'],/javascript/);
  for(const path of ['/api/oneport/client.js','/api/oneport/style.css']){
   const r=await request(server,path);
   assert.equal(r.status,200,path);
  }
  assert.equal((await request(server,'/api/oneport/vendor/vanilla-tilt.js','POST')).status,404);
  assert.equal((await request(server,'/api/oneport/vendor/unknown.js')).status,404)
 })
});
