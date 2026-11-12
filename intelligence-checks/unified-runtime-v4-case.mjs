// V4 stage 1: mock-only read-only service gateway qualifications.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createUnifiedGatewayV4,fixedGatewayGetV4} from '../src/experimental/unified-gateway-v4.mjs';
import {createUnifiedChatServer} from '../scripts/Run-Fun-Unified-Chat8798.mjs';
import {createUnifiedTaskChat} from '../src/experimental/unified-task-chat.mjs';
const urls={
 parent:'http://127.0.0.1:8789/api/ai/status',
 catalogue:'http://127.0.0.1:8789/api/ai/tools',
 local:'http://127.0.0.1:8796/api/ai/auto-local/status',
 rea:'http://127.0.0.1:8797/api/rea229/status',
 qwen:'http://127.0.0.1:8088/health',
 compute:'http://127.0.0.1:8791/health'
};
const result={
 [urls.parent]:{state:'ready'},
 [urls.catalogue]:{rea_tool_count:229,local_tool_count:19},
 [urls.local]:{sidecar:true,reaExecutionGrants:0},
 [urls.rea]:{liveMcpHealth:'ready',realReaToolCount:229,busy:false},
 [urls.qwen]:{status:'ok'},
 [urls.compute]:{state:'running'}
};
test('V4 one gateway reports all six known components through read-only fixed GETs',async()=>{
 const seen=[];
 const gateway=createUnifiedGatewayV4({read:async url=>{seen.push(url);return result[url]}});
 const output=await gateway.status();
 assert.equal(output.version,'fi-unified-runtime-v4-stage1');
 assert.equal(output.state,'ready');
 assert.equal(output.entrypoint,'http://127.0.0.1:8798/');
 assert.equal(output.registered.verifiedCounts,true);
 assert.deepEqual([...seen].sort(),Object.values(urls).sort());
 assert.deepEqual(output.services.map(s=>s.port),[8798,8789,8796,8797,8088,8791]);
 assert.equal(output.legacyPortsRetired.length,0);
 assert.equal(output.componentsStillSeparate,true);
 assert.equal(output.toolExecutionsPerformed,0);
 assert.equal(output.approvalGrantsCreated,0);
 assert.equal(output.restartPerformed,false);
 assert.equal(output.noBackgroundMonitoring,true);
});
test('V4 refuses claiming full health when a single required internal service is missing',async()=>{
 for(const name of Object.keys(urls)){
  const gateway=createUnifiedGatewayV4({read:async u=>{
   if(u===urls[name])throw Error('offline:SECRET_HIDDEN');
   return result[u]
  }});
  const output=await gateway.status();
  assert.equal(output.state,'degraded',name);
  assert.ok(output.services.some(s=>!s.ready)||!output.registered.verifiedCounts);
  assert.equal(JSON.stringify(output).includes('SECRET_HIDDEN'),false);
 }
});
test('V4 rejects catalog count drift and unexpected REA grants',async()=>{
 for(const drift of [
  {...result,[urls.catalogue]:{rea_tool_count:230,local_tool_count:19}},
  {...result,[urls.local]:{sidecar:true,reaExecutionGrants:1}},
  {...result,[urls.rea]:{liveMcpHealth:'ready',realReaToolCount:229,busy:true}}
 ]){
  const gateway=createUnifiedGatewayV4({read:async u=>drift[u]});
  const snapshot=await gateway.status();
  assert.equal(snapshot.state,'degraded');
  assert.equal(snapshot.operatorApprovalsUnchanged,true);
 }
});
test('V4 coalesces simultaneous snapshots but does not create a timer or job',async()=>{
 let reads=0;
 const gateway=createUnifiedGatewayV4({read:async url=>{
  reads++;await Promise.resolve();return result[url]
 }});
 const [a,b,c]=await Promise.all([gateway.status(),gateway.status(),gateway.status()]);
 assert.equal(reads,6);
 assert.deepEqual(a,b);assert.deepEqual(b,c);
 const d=await gateway.status();
 assert.equal(d.state,'ready');assert.equal(reads,12);
});
test('V4 default transport refuses arbitrary addresses and bodies',async()=>{
 await assert.rejects(fixedGatewayGetV4('https://example.com'),/NOT_ALLOWLISTED/);
 await assert.rejects(fixedGatewayGetV4('http://127.0.0.1:1234/private'),/NOT_ALLOWLISTED/);
 await assert.rejects(fixedGatewayGetV4(urls.rea,{timeoutMs:1}),/READ_BOUNDS_INVALID/);
 await assert.rejects(fixedGatewayGetV4(urls.rea,{maxBytes:999}),/READ_BOUNDS_INVALID/);
});
test('existing 8798 HTTP owns V4 read-only status without a new listener',async()=>{
 let reads=0;const gateway=createUnifiedGatewayV4({read:async url=>{reads++;return result[url]}});
 const app=createUnifiedTaskChat({request:async()=>({}),fetchWeb:async()=>({})});
 const server=createUnifiedChatServer({app,gateway,readClient:async()=>''});
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)});
 const port=server.address().port;
 async function httpCall(route,method='GET',origin){
  return await new Promise((resolve,reject)=>{
   const req=http.request({host:'127.0.0.1',port,path:route,method,headers:{
    host:'127.0.0.1:8798',...(origin?{origin}:{})
   }},res=>{let body='';res.on('data',v=>body+=v);
    res.on('end',()=>resolve({code:res.statusCode,result:JSON.parse(body)}))});
   req.once('error',reject);req.end();
  });
 }
 try{
  const a=await httpCall('/api/unified/v4/status');
  assert.equal(a.code,200);assert.equal(a.result.services.length,6);
  assert.equal(reads,6);
  const b=await httpCall('/api/unified/v4/status','POST','http://127.0.0.1:8798');
  assert.equal(b.code,404);assert.equal(reads,6);
  const c=await httpCall('/api/unified/v4/status','GET','https://evil.example');
  assert.equal(c.code,403);assert.equal(reads,6);
  const d=await httpCall('/api/unified/v4/status?x=1');
  assert.equal(d.code,404);assert.equal(reads,6);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('UI is static health panel with explicit refresh and no service mutations',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {fileURLToPath}=await import('node:url');
 const script=await readFile(fileURLToPath(new URL('../src/experimental/unified-task-client.js',import.meta.url)),'utf8');
 const server=await readFile(fileURLToPath(new URL('../scripts/Run-Fun-Unified-Chat8798.mjs',import.meta.url)),'utf8');
 assert.match(script,/v4button\.addEventListener\('click',checkV4\)/);
 assert.match(server,/id="v4-panel"/);
 assert.match(server,/id="v4-refresh"/);
 assert.ok(!script.includes('setInterval('));
 assert.ok(!script.includes('setTimeout('));
});
