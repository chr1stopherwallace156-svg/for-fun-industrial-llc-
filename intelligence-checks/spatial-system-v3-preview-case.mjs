// V3.1: qualify immersive iPhone-ready Canvas preview and preserve hostile read-only boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {buildGraph,SPATIAL_VERSION} from '../src/spatial-v3/graph.mjs';
import {observeSpatialV3,OBSERVED_ENDPOINTS} from '../src/spatial-v3/observer.mjs';
import {createSpatialPreview} from '../src/spatial-v3/server.mjs';
async function withServer(fn){
 let observations=0;
 const s=createSpatialPreview({observer:async()=>{
  observations++;
  return {...buildGraph(),observed_at:'2026-11-15T22:30:00Z',evidence:[],
    remote_execution:false,tools_called:0,model_calls:0,external_actions:0}
 }});
 await new Promise(ok=>s.listen(0,'127.0.0.1',ok));
 try{await fn(s,()=>observations)}finally{await new Promise(ok=>s.close(ok))}
}
function get(server,path,method='GET',host='127.0.0.1:8808'){
 return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:server.address().port,path,method,headers:{host}},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({
    status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),headers:res.headers
   }));
  });req.on('error',reject);req.end()
 })
}
test('curated system topology has all six branches and fails unverified by default',()=>{
 const graph=buildGraph();
 assert.equal(graph.version,SPATIAL_VERSION);assert.equal(graph.read_only,true);assert.equal(graph.external_actions,0);
 assert.ok(graph.nodes.length>=30&&graph.nodes.length<=40);
 const ids=new Set(graph.nodes.map(n=>n.id));
 assert.equal(ids.size,graph.nodes.length);
 for(const id of ['core','ai','tools','compute','business','voice','security','qwen','rea','optuna','or-tools','voice-lab','outcomes'])
  assert.ok(ids.has(id),id);
 assert.ok(graph.nodes.every(n=>n.state==='unverified'));
 assert.ok(graph.links.every(l=>ids.has(l.source)&&ids.has(l.target)));
 assert.equal(buildGraph({qwen:'grant_tool_authority'}).nodes.find(n=>n.id==='qwen').state,'unverified')
});
test('source-bound observations never claim Qwen healthy from adapter status alone',async()=>{
 const requested=[];
 const fetchMock=async(url,opts)=>{
  requested.push({url,method:opts.method});
  let body={};
  if(url.endsWith('/api/fial/grounded/status'))body={
   version:'fial5.3-primary-grounded-chat-v1',
   model_interface:'fixed_local_qwen_8088',
   authority_added:false
  };
  if(url.endsWith('/api/unified/status'))body={version:'fi-unified-task-chat-8798-v1',rea:{ready:true,count:229}};
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}})
 };
 const result=await observeSpatialV3(fetchMock);
 assert.equal(requested.length,OBSERVED_ENDPOINTS.length);
 assert.ok(requested.every(x=>x.method==='GET'&&x.url.startsWith('http://127.0.0.1:')));
 assert.equal(result.nodes.find(n=>n.id==='qwen').state,'unverified');
 assert.equal(result.nodes.find(n=>n.id==='model-health').state,'unverified');
 assert.equal(result.external_actions,0);assert.equal(result.tools_called,0);assert.equal(result.model_calls,0);
 const healthy=await observeSpatialV3(async(url,options)=>{
  const d=url.endsWith(':8088/health')?{status:'ok'}:url.endsWith('/api/fial/grounded/status')?
   {version:'fial5.3-primary-grounded-chat-v1',model_interface:'fixed_local_qwen_8088',authority_added:false}:{};
  return new Response(JSON.stringify(d),{headers:{'content-type':'application/json'}})
 });
 assert.equal(healthy.nodes.find(n=>n.id==='qwen').state,'available');
});
test('single-purpose port 8808 serves full-screen browser, strict Host and GET only',async()=>{
 await withServer(async(s,count)=>{
  const home=await get(s,'/');
  assert.equal(home.status,200);
  assert.match(home.body,/SYSTEM UNIVERSE/);
  assert.match(home.body,/canvas id="scene"/);
  assert.doesNotMatch(home.body,/iframe|3d-force-graph\.min\.js/);
  assert.equal(home.headers['x-fi-spatial-v3'],SPATIAL_VERSION);
  assert.match(home.headers['content-security-policy'],/connect-src 'self'/);
  for(const p of ['/assets/spatial-v3.js','/assets/spatial-v3.css']){
   const result=await get(s,p);assert.equal(result.status,200,p)
  }
  const phone=await get(s,'/','GET','127.0.0.1:18808');assert.equal(phone.status,200);
  assert.equal((await get(s,'/','GET','rogue.example')).status,403);
  assert.equal((await get(s,'/api/spatial-v3/status','POST')).status,405);
  assert.equal((await get(s,'/api/spatial-v3/actions')).status,404);
  assert.equal((await get(s,'/vendor/3d-force-graph.min.js')).status,404);
  const topology=await get(s,'/api/spatial-v3/topology');assert.equal(topology.status,200);
  assert.equal(JSON.parse(topology.body).read_only,true);assert.equal(count(),0);
  const status=await get(s,'/api/spatial-v3/status');assert.equal(status.status,200);assert.equal(count(),1);
  await get(s,'/api/spatial-v3/status','HEAD');assert.equal(count(),1);
  assert.notEqual((await get(s,'/%2fetc%2fpasswd')).status,200);
 })
});
test('mobile Canvas2D handles gestures, branches, pause and iOS fallback without action routes',async()=>{
 const browser=await readFile(new URL('../src/spatial-v3/spatial-v3.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/spatial-v3/spatial-v3.css',import.meta.url),'utf8');
 for(const snippet of ['getContext(\'2d\'','pointerdown','pointermove','pointerup','touchDistance',
  'requestAnimationFrame','visibilitychange','prefers-reduced-motion','select(id,show=true)',
  'node-state','drawFibers','pause','min(window.devicePixelRatio']){
  assert.ok((browser+css).includes(snippet),snippet)
 }
 assert.ok(css.includes('height:100dvh'));assert.ok(css.includes('touch-action:none'));
 assert.doesNotMatch(browser,/innerHTML\s*=|eval\(|method\s*:\s*['"]POST['"]|setInterval\(|fetch\(['"]https:/);
 assert.doesNotMatch(browser,/window\.ForceGraph3D|WebGLRenderingContext/);
});
