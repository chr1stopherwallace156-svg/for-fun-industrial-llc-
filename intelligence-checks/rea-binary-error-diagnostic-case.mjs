import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {diagnoseBinarySession} from '../scripts/Diagnose-Fun-Rea-Binary-Error.mjs';
const names=Array.from({length:229},(_,i)=>i===7?'binary_session':'rea_fixture_'+String(i).padStart(3,'0'));
function fixture({toolResult,throws=false,changeName=false}={}){
 const calls=[],output=[],state={ready:false,stops:0,startCount:0};
 const adapter={
  start:async()=>{state.startCount++;state.ready=true;return {state:'ready',tool_count:229}},
  stop:async()=>{state.stops++;state.ready=false},
  health:async()=>({state:state.ready?'ready':'stopped'}),
  tools:()=>names.map(name=>({name:name==='binary_session'&&changeName?'missing_binary_session':name,
   inputSchema:{type:'object',properties:{detail:{type:'string'},refresh_candidates:{type:'boolean'}}}})),
  callTool:async(name,args)=>{
   calls.push({name,args});
   if(throws)throw Error('TEMP_MCP_TRANSPORT_FAILURE');
   return {tool:name,result:toolResult||{isError:false,structuredContent:{status:'observed'}}};
  }
 };
 return {adapter,calls,output,state};
}
test('one temporary MCP request captures real isError code, details and recovery and closes its child',async()=>{
 const error={error:{code:'provider_unavailable',
  message:'No usable provider configured',details:{reason:'no_provider',available:[]},
  remediation:{action:'configure_supported_provider'}}};
 const f=fixture({toolResult:{isError:true,content:[{type:'text',text:JSON.stringify(error)}]}});
 const res=await diagnoseBinarySession({adapter:f.adapter,expectedNames:names,write:s=>f.output.push(s)});
 assert.equal(res.state,'mcp_tool_error_captured');
 assert.equal(res.callCount,1);
 assert.equal(res.error.code,'provider_unavailable');
 assert.match(res.error.message,/No usable provider configured/);
 assert.match(res.error.details,/no_provider/);
 assert.match(res.error.remediation,/configure_supported_provider/);
 assert.equal(f.calls.length,1);
 assert.deepEqual(f.calls[0],{name:'binary_session',args:{detail:'summary',refresh_candidates:false}});
 assert.equal(f.state.stops,1);
 assert.ok(f.output.includes('DIAGNOSTIC_TEMPORARY_MCP_STOPPED=TRUE'));
 assert.ok(f.output.some(s=>s.includes('REA_MCP_ERROR_RAW_EXCERPT=')));
});
test('a healthy MCP result is truthful and never classified as an error',async()=>{
 const f=fixture();
 const res=await diagnoseBinarySession({adapter:f.adapter,expectedNames:names,write:s=>f.output.push(s)});
 assert.equal(res.state,'mcp_tool_success_in_fresh_session');
 assert.equal(res.error,null);
 assert.equal(f.calls.length,1);
 assert.equal(f.state.stops,1);
});
test('transport failure stops only the temporary MCP child; no second call',async()=>{
 const f=fixture({throws:true});
 await assert.rejects(diagnoseBinarySession({adapter:f.adapter,expectedNames:names,write:s=>f.output.push(s)}),/TEMP_MCP_TRANSPORT_FAILURE/);
 assert.equal(f.calls.length,1);
 assert.equal(f.state.stops,1);
});
test('exact 229 name mismatch prevents REA tool execution, still cleans up',async()=>{
 const f=fixture({changeName:true});
 await assert.rejects(diagnoseBinarySession({adapter:f.adapter,expectedNames:names}),/INDEPENDENT_CATALOGUE_NAME_MISMATCH/);
 assert.equal(f.calls.length,0);
 assert.equal(f.state.stops,1);
});
test('missing binary_session in expected catalogue refuses before MCP child start',async()=>{
 const f=fixture();
 await assert.rejects(diagnoseBinarySession({adapter:f.adapter,expectedNames:names.filter(x=>x!=='binary_session')}),/VERIFIED_PARENT_229_WITH_BINARY_SESSION_REQUIRED/);
 assert.equal(f.state.startCount,0);
 assert.equal(f.calls.length,0);
});
test('script is inert without an explicit operator argument',async()=>{
 const file=fileURLToPath(new URL('../scripts/Diagnose-Fun-Rea-Binary-Error.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:15000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/REA_BINARY_DIAGNOSTIC=INACTIVE/);
});
