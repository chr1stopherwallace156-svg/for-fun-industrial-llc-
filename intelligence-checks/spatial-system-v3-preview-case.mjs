import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {buildGraph,NODES,LINKS,SPATIAL_VERSION} from '../src/spatial-v3/graph.mjs';
import {observeSpatialV3,OBSERVED_ENDPOINTS} from '../src/spatial-v3/observer.mjs';
import {createSpatialPreview} from '../src/spatial-v3/server.mjs';
const origin='http://127.0.0.1:';
function req(s,path,method='GET',host='127.0.0.1:8807'){
 return new Promise((resolve,reject)=>{
  const r=http.request({hostname:'127.0.0.1',port:s.address().port,path,method,headers:{host}},res=>{
   const parts=[];res.on('data',b=>parts.push(b));
   res.once('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts).toString('utf8')}));
  });r.once('error',reject);r.end();
 })
}
async function within(callback){
 let calls=0;const server=createSpatialPreview({
  observer:async()=>{calls++;return {...buildGraph(),observed_at:'2026-11-15T00:00:00Z',evidence:[],tools_called:0,model_calls:0,external_actions:0}},
  vendor:new URL('../src/spatial-v3/3d-force-graph.min.js',import.meta.url).pathname,
  files:async filename=>filename.endsWith('3d-force-graph.min.js')?'// fixture':await (await import('node:fs/promises')).readFile(filename)
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{await callback(server,()=>calls)}finally{await new Promise(ok=>server.close(ok))}
}
test('spatial topology represents real named modules and never invents health or execution',()=>{
 const g=buildGraph();
 assert.equal(g.version,SPATIAL_VERSION);assert.equal(g.read_only,true);assert.equal(g.external_actions,0);
 assert.equal(g.nodes.length,NODES.length);assert.equal(g.links.length,LINKS.length);
 assert.equal(new Set(g.nodes.map(n=>n.id)).size,g.nodes.length);
 assert.ok(['ai','tools','business','voice','compute','security'].every(id=>g.nodes.some(n=>n.id===id)));
 assert.ok(g.nodes.every(n=>n.state==='unverified'));
 assert.ok(g.links.every(l=>g.nodes.some(n=>n.id===l.source)&&g.nodes.some(n=>n.id===l.target)));
 assert.equal(buildGraph({qwen:'available',rea:'FAKE_PRIVILEGED'}).nodes.find(n=>n.id==='rea').state,'unverified')
});
test('real bounded observations are GET only and never count an unverified model, tools or contracts',async()=>{
 const requests=[];
 const mock=async(url,init)=>{
  requests.push({url,method:init.method});
  let result={state:'wrong'};
  if(url.endsWith('/api/fial/grounded/status'))result={version:'fial5.3-primary-grounded-chat-v1',state:'ANSWERED_BY_QWEN',model_interface:'fixed_local_qwen_8088',authority_added:false};
  if(url.endsWith('/api/ai/automatic-memory/status'))result={memoryAvailable:true,memoryWrites:false,mode:'automatic_contextual_read_only'};
  if(url.endsWith('/api/unified/status'))result={version:'fi-unified-task-chat-8798-v1',rea:{ready:true,count:229}};
  return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}})
 };
 const observed=await observeSpatialV3(mock);
 assert.equal(requests.length,OBSERVED_ENDPOINTS.length);
 assert.ok(requests.every(x=>x.method==='GET'&&x.url.startsWith(origin)));
 assert.equal(observed.tools_called,0);assert.equal(observed.model_calls,0);assert.equal(observed.external_actions,0);
 assert.equal(observed.nodes.find(n=>n.id==='qwen').state,'available');
 assert.equal(observed.nodes.find(n=>n.id==='rea').state,'available');
 assert.equal(observed.nodes.find(n=>n.id==='buyers').state,'unverified');
 assert.equal(observed.nodes.find(n=>n.id==='authority').state,'unverified');
});
test('isolated preview serves local HTML, CSS, JS and fixed read-only endpoints',async()=>{
 await within(async(s,calls)=>{
  const h=await req(s,'/');assert.equal(h.status,200);assert.match(h.body,/Spatial System V3/);
  assert.equal(h.headers['x-fi-spatial-v3'],SPATIAL_VERSION);
  for(const p of ['/assets/spatial-v3.css','/assets/spatial-v3.js']){
   const r=await req(s,p);assert.equal(r.status,200,p)
  }
  const s1=await req(s,'/api/spatial-v3/status');assert.equal(s1.status,200);
  assert.equal(JSON.parse(s1.body).read_only,true);assert.equal(calls(),1);
  const top=await req(s,'/api/spatial-v3/topology');assert.equal(top.status,200);
  assert.equal(calls(),1);
  const head=await req(s,'/api/spatial-v3/status','HEAD');assert.equal(head.status,200);
  assert.equal(calls(),1);
  assert.equal((await req(s,'/api/spatial-v3/status','POST')).status,405);
  assert.equal((await req(s,'/api/spatial-v3/status','GET','malicious.example')).status,403);
  for(const p of ['/../secret','/%2e%2e/secret','/unknown','/api/spatial-v3/actions']){
   const r=await req(s,p);assert.notEqual(r.status,200,p)
  }
 })
});
test('browser only inspects status and supports on-device 2D fallback without action routes',async()=>{
 const fs=await import('node:fs/promises');
 const script=await fs.readFile(new URL('../src/spatial-v3/spatial-v3.js',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../src/spatial-v3/spatial-v3.css',import.meta.url),'utf8');
 for(const fragment of ['ForceGraph3D','WebGLRenderingContext','createElementNS','showNode','node-list','onNodeClick','touch-action','pauseAnimation'])
  assert.ok((script+css).includes(fragment),fragment);
 assert.doesNotMatch(script,/innerHTML\s*=|eval\(|method\s*:\s*['"]POST['"]|setInterval\(|\.tool\s*\(/);
});
