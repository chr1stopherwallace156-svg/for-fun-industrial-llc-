import {fileURLToPath} from 'node:url';
import {createReaAdapter} from '../src/adapters/rea.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {createFullReaRunner,rankReaTools} from '../src/experimental/rea-full-229.mjs';
import {createRea229Server,PORT,HOST} from '../scripts/Run-Fun-Rea229-Sidecar8797.mjs';

const catalogue=Array.from({length:229},(_,i)=>({
 name:i===4?'rea_inspect_rust_binary':'rea_fixture_tool_'+String(i).padStart(3,'0'),
 description:i===4?'Analyze Rust binary and inspect build metadata':'Synthetic REA tool '+i,
 inputSchema:{type:'object',properties:{filename:{type:'string'}},required:[]}
}));
function testAdapter({fail=false}={}){
 const actions=[];let initialized=false;
 const adapter={
  start:async()=>{initialized=true;return {state:'ready',tool_count:229}},
  health:async()=>({state:initialized?'ready':'stopped'}),
  tools:()=>catalogue,
  callTool:async(name,args)=>{
   if(fail)throw Error('SYNTHETIC_MCP_ERROR');
   actions.push({name,args});return {tool:name,result:{content:[{type:'text',text:'synthetic result'}],isError:false}};
  },
  stop:async()=>{initialized=false}
 };
 return {adapter,actions};
}
async function initialized(infer=async()=>({choices:[{message:{content:'No REA tool needed'}}]}),opt={}){
 const {adapter,actions}=testAdapter(opt);
 const runner=createFullReaRunner({adapter,infer});
 const result=await runner.initialize({expectedNames:catalogue.map(x=>x.name)});
 assert.equal(result.realReaToolCount,229);
 return {runner,adapter,actions};
}
test('all 229 are real adapter-backed, accessible by exact name, not fabricated',async()=>{
 const {runner,actions}=await initialized();
 const all=runner.list();
 assert.equal(all.tools.length,229);
 assert.equal(new Set(all.tools.map(x=>x.name)).size,229);
 assert.equal(new Set(all.tools.map(x=>x.alias)).size,229);
 for(const tool of all.tools){
  const result=await runner.callExact({name:tool.name,arguments:{}});
  assert.equal(result.tool,tool.name);
 }
 assert.equal(actions.length,229);
 assert.equal(runner.status().executedCalls,229);
 assert.equal(runner.status().independentMcpSession,true);
});
test('229 name identity mismatch fails before granting use',async()=>{
 const {adapter}=testAdapter();
 const runner=createFullReaRunner({adapter,infer:async()=>({})});
 await assert.rejects(runner.initialize({expectedNames:Array(229).fill('mismatch')}),/PARENT_CATALOGUE_NAMES_DIFFER/);
 assert.equal(runner.status().realReaToolCount,0);
});
test('model selects real rust inspection tool dynamically and executes via independent MCP adapter',async()=>{
 let modelCalls=0,seen;
 const {runner,actions}=await initialized(async payload=>{
  modelCalls++;seen=payload;
  return {choices:[{message:{content:null,tool_calls:[{
   type:'function',function:{name:payload.tools[0].function.name,
    arguments:JSON.stringify({filename:'synthetic.bin'})}
  }]}}]};
 });
 const result=await runner.run({prompt:'Inspect Rust binary metadata for synthetic.bin',rounds:1});
 assert.equal(result.actions.length,1);
 assert.equal(result.actions[0].tool,'rea_inspect_rust_binary');
 assert.equal(actions[0].name,'rea_inspect_rust_binary');
 assert.equal(modelCalls,1);
 assert.ok(seen.tools.length<=4);
 assert.ok(seen.tools.every(x=>!x.function.name.startsWith('fi_')));
 assert.equal(seen.tools[0].function.name,'rea_tool_005');
});
test('no model call execution if model declines and no fabricated result',async()=>{
 const {runner,actions}=await initialized();
 const res=await runner.run({prompt:'Describe what REA can do',rounds:1});
 assert.equal(res.state,'model_no_tool_call');
 assert.equal(actions.length,0);
});
test('unregistered or unadvertised model tool and malformed args cannot execute',async()=>{
 const {runner,actions}=await initialized(async()=>({
  choices:[{message:{tool_calls:[{function:{name:'rea__arbitrary_shell',arguments:'{}'}}]}}]
 }));
 await assert.rejects(runner.run({prompt:'Inspect Rust binary',rounds:1}),/MODEL_CALLED_UNKNOWN_OR_UNADVERTISED_TOOL/);
 assert.equal(actions.length,0);
});
test('MCP tool errors terminate without automatic retries',async()=>{
 const {runner}=await initialized(async payload=>({
  choices:[{message:{tool_calls:[{function:{name:payload.tools[0].function.name,arguments:'{}'}}]}}]
 }),{fail:true});
 await assert.rejects(runner.run({prompt:'Inspect Rust binary',rounds:2}),/SYNTHETIC_MCP_ERROR/);
 assert.equal(runner.status().failedSessions,1);
 assert.equal(runner.status().busy,false);
});
test('initial catalogue requires 229 unique well-formed real MCP tool schemas',async()=>{
 const {adapter}=testAdapter();
 adapter.tools=()=>catalogue.slice(0,228);
 const runner=createFullReaRunner({adapter,infer:async()=>({})});
 await assert.rejects(runner.initialize({expectedNames:catalogue.map(x=>x.name)}),/NOT_EXACTLY_229_REAL_TOOLS/);
 assert.equal(runner.status().readyForModelToolCalls,false);
});
test('ranked selection respects query and allows search across all 229',async()=>{
 const {runner}=await initialized();
 const result=rankReaTools(runner.list().tools,'rust binary metadata',{limit:4});
 assert.equal(result[0].name,'rea_inspect_rust_binary');
 assert.equal(runner.list({query:'rust binary'}).tools[0].name,'rea_inspect_rust_binary');
});
async function withHttp(fn){
 const {runner,adapter,actions}=await initialized();
 const server=createRea229Server({runner,adapter,
  readClient:async()=>'// FI_REA229_BROWSER_V1'});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,HOST,resolve)});
 const realPort=server.address().port;
 function request(method,url,body=null,headers={}){
  return new Promise((resolve,reject)=>{
   const raw=body===null?null:JSON.stringify(body);
   const req=http.request({hostname:HOST,port:realPort,path:url,method,
    headers:{host:HOST+':'+PORT,...(raw?{'content-type':'application/json'}:{}),...headers}},
    res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{
     resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),
      headers:res.headers});
    })});
   req.once('error',reject);
   req.end(raw||undefined);
  });
 }
 try{await fn({request,runner,actions})}
 finally{await new Promise(resolve=>server.close(resolve))}
}
test('HTTP exposes actual full 229 catalogue, health, same-origin client and UI with no auto-execution on GET',async()=>{
 await withHttp(async({request,actions})=>{
  const status=await request('GET','/api/rea229/status');
  assert.equal(status.status,200);
  const body=JSON.parse(status.body);
  assert.equal(body.realReaToolCount,229);
  assert.equal(body.liveMcpHealth,'ready');
  const all=await request('GET','/api/rea229/tools?limit=229');
  assert.equal(JSON.parse(all.body).tools.length,229);
  assert.equal((await request('GET','/')).status,200);
  assert.equal((await request('GET','/api/rea229/client.js')).status,200);
  assert.equal(actions.length,0);
 });
});
test('HTTP refuses cross-origin, missing click attestation, unlisted tool, and malformed body',async()=>{
 await withHttp(async({request,actions})=>{
  const data={name:'rea_inspect_rust_binary',arguments:{}};
  const wrong=await request('POST','/api/rea229/call',data,{origin:'http://wrong.invalid','x-fi-rea229':'operator-click'});
  assert.equal(wrong.status,403);
  const noHeader=await request('POST','/api/rea229/call',data,{origin:'http://127.0.0.1:8797'});
  assert.equal(noHeader.status,403);
  const unknown=await request('POST','/api/rea229/call',{name:'not_registered',arguments:{}},{
   origin:'http://127.0.0.1:8797','x-fi-rea229':'operator-click'});
  assert.equal(unknown.status,422);
  assert.equal(actions.length,0);
 });
});
test('single explicitly clicked exact tool HTTP executes one actual MCP call, not an 8789 route',async()=>{
 await withHttp(async({request,actions})=>{
  const response=await request('POST','/api/rea229/call',{
   name:'rea_inspect_rust_binary',arguments:{filename:'synthetic.bin'}
  },{origin:'http://127.0.0.1:8797','x-fi-rea229':'operator-click'});
  assert.equal(response.status,200,response.body);
  assert.equal(JSON.parse(response.body).tool,'rea_inspect_rust_binary');
  assert.equal(actions.length,1);
 });
});
test('client and launcher preserve existing 8789, 8796, 8088, 8791 processes',async()=>{
 const client=await readFile(new URL('../src/experimental/rea229-client.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Script(client));
 const ps=await readFile(new URL('../Start-Fun-Rea229-Sidecar8797.ps1',import.meta.url),'utf8');
 for(const item of ['PARENT_SERVICES_NOT_ALL_RUNNING','PARENT_REA_NOT_READY',
  'PARENT_229_PLUS_19_NOT_CONFIRMED','PARENT_LISTENER_CHANGED_',
  'PARENT_REA_NAMES_CHANGED','/api/rea/catalog']){
  assert.ok(ps.includes(item),'missing '+item);
 }
 assert.match(ps,/REAL_REA_MCP_TOOLS=229 ADDRESSABLE=229 EXECUTION_ENABLED=TRUE/);
 assert.doesNotMatch(ps,/Stop-Process -Id \$OldPid|\/api\/activate|\/api\/stop/);
});

test('real stdio MCP child handshakes with 229 entries and executes a genuine tools/call',async()=>{
 const fixture=fileURLToPath(new URL('./fixtures/rea229-mcp-fixture.cjs',import.meta.url));
 const adapter=createReaAdapter({enabled:true,command:process.execPath,args:[fixture]});
 try{
  const runner=createFullReaRunner({adapter,infer:async()=>({choices:[{message:{content:'no tools needed'}}]})});
  const expected=Array.from({length:229},(_,i)=>'rea_fixture_'+String(i).padStart(3,'0'));
  const status=await runner.initialize({expectedNames:expected});
  assert.equal(status.realReaToolCount,229);
  assert.equal((await adapter.health()).state,'ready');
  const item=await runner.callExact({name:'rea_fixture_228',arguments:{message:'hello 229'}});
  assert.equal(item.tool,'rea_fixture_228');
  assert.match(item.result.content[0].text,/SIMULATED rea_fixture_228/);
  assert.equal(runner.status().executedCalls,1);
 }finally{
  await adapter.stop();
  assert.equal((await adapter.health()).state,'stopped');
 }
});
test('entrypoint is inert without --serve and launcher does not terminate unrelated parents',async()=>{
 const {spawnSync}=await import('node:child_process');
 const launcher=fileURLToPath(new URL('../scripts/Run-Fun-Rea229-Sidecar8797.mjs',import.meta.url));
 const result=spawnSync(process.execPath,[launcher],{encoding:'utf8',timeout:12000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/FUN_REA229=INACTIVE/);
 const powershell=await readFile(new URL('../Start-Fun-Rea229-Sidecar8797.ps1',import.meta.url),'utf8');
 assert.match(powershell,/-WorkingDirectory \$Primary/);
 assert.match(powershell,/taskkill\.exe \/PID \$Child\.Id \/T \/F/);
});
