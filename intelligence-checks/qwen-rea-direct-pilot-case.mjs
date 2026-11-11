import test from 'node:test';
import assert from 'node:assert/strict';
import {runDirectReaPilot,chooseReaDiagnosticTools} from '../src/experimental/rea-qwen-direct-pilot.mjs';
const BASE='http://127.0.0.1:8797';
const LLAMA='http://127.0.0.1:8088/v1/chat/completions';
const prompt='Inspect the current REA MCP analysis settings using a real read-only session tool. Report the returned settings without modifying them.';
function fixture(overrides={}){
 const all=Array.from({length:229},(_,i)=>{
  const name=i===7?'inspect_analysis_settings':i===8?'search_guidance':i===9?'read_adb_setting':i===10?'read_bytes':'rea_generic_fixture_'+String(i).padStart(3,'0');
  return {name,alias:'rea_tool_'+String(i+1).padStart(3,'0'),
   description:i===7?'Read-only inspect active REA analysis settings':i===8?'Search installed REA guidance':i===9?'Read Android ADB settings':i===10?'Read Ghidra analysis memory':'Generic fixture',
   inputSchema:{type:'object',properties:{},additionalProperties:false}};
 });
 let modelCount=0,toolCount=0,summaryCount=0,modelBody=null,exactPayload=null;
 const requestFn=async(url,body)=>{
  if(url===BASE+'/api/rea229/status')return {liveMcpHealth:'ready',realReaToolCount:229};
  if(url===BASE+'/api/rea229/tools?limit=229')return {tools:all,total:229};
  if(url===LLAMA){
   if(body.tools){
    modelBody=body;modelCount++;
    if(overrides.noCall)return {choices:[{finish_reason:'length',message:{content:null,reasoning_content:'some reasoning'}}],usage:{completion_tokens:1024}};
    if(overrides.unadvertised)return {choices:[{finish_reason:'tool_calls',message:{tool_calls:[{function:{name:'rea_tool_zzz',arguments:'{}'}}]}}]};
    return {choices:[{finish_reason:'tool_calls',message:{tool_calls:[{function:{name:body.tools[0].function.name,arguments:'{}'}}]}}],usage:{completion_tokens:65}};
   }
   summaryCount++;
   return {choices:[{finish_reason:'stop',message:{content:'The session settings were returned by REA.'}}]};
  }
  if(url===BASE+'/api/rea229/call'){
   toolCount++;exactPayload=body;
   return {tool:body.name,result:{isError:!!overrides.mcpError,content:[{type:'text',text:'REAL MCP SETTINGS RESULT'}]}};
  }
  throw Error('UNEXPECTED_URL_'+url);
 };
 return {all,requestFn,stats:()=>({modelCount,toolCount,summaryCount,modelBody,exactPayload})};
}
test('purpose-locked Qwen emits one real REA analysis-settings call with no ADB candidate',async()=>{
 const f=fixture(),logs=[];
 const result=await runDirectReaPilot({prompt,requestFn:f.requestFn,log:x=>logs.push(x)});
 assert.equal(result.state,'real_mcp_tool_executed');
 assert.equal(result.actions.length,1);
 assert.equal(result.actions[0].tool,'inspect_analysis_settings');
 assert.deepEqual(result.actions[0].arguments,{});
 assert.equal(result.actions[0].result.content[0].text,'REAL MCP SETTINGS RESULT');
 assert.equal(result.reply,'The session settings were returned by REA.');
 const s=f.stats();
 assert.equal(s.modelCount,1);assert.equal(s.toolCount,1);assert.equal(s.summaryCount,1);
 assert.equal(s.exactPayload.name,'inspect_analysis_settings');
 assert.equal(s.modelBody.chat_template_kwargs.enable_thinking,false);
 assert.equal(s.modelBody.max_tokens,1024);
 assert.equal(s.modelBody.tool_choice,'auto');
 assert.equal(s.modelBody.tools.length,1);
 assert.equal(s.modelBody.tools[0].function.name,'rea_tool_008');
 assert.ok(s.modelBody.tools.every(x=>!/adb|ghidra|delete|memory/i.test(x.function.description)));
 assert.ok(logs.some(x=>x==='READ_ONLY_CANDIDATES=inspect_analysis_settings'));
 assert.ok(logs.some(x=>x.startsWith('MODEL_METADATA=')));
 assert.ok(logs.some(x=>x.startsWith('QWEN_SELECTED_REAL_REA_TOOL=')));
});
test('JavaScript source inspection request stops instead of offering Android and Ghidra tools',async()=>{
 const f=fixture();
 const request='Read-only inspect this JavaScript source file: C:\\test\\rea-full-229.mjs using REA tools. Do not modify it.';
 await assert.rejects(runDirectReaPilot({prompt:request,requestFn:f.requestFn}),/NO_VERIFIED_COMPATIBLE_READ_ONLY_REA_TOOL_FOR_TASK/);
 assert.equal(f.stats().modelCount,0);
 assert.equal(f.stats().toolCount,0);
});
test('guidance profile selects only installed REA search_guidance',async()=>{
 const f=fixture();
 const selected=chooseReaDiagnosticTools(f.all,'Search the built-in REA MCP guidance on analysis workflows');
 assert.deepEqual(selected.map(x=>x.name),['search_guidance']);
});
test('catalogue missing matching inspection function fails closed without model call',async()=>{
 const f=fixture();
 const custom=async(url,body)=>{
  if(url===BASE+'/api/rea229/tools?limit=229')return {tools:f.all.map(t=>t.name==='inspect_analysis_settings'?{...t,name:'read_adb_settings_renamed'}:t)};
  return f.requestFn(url,body);
 };
 await assert.rejects(runDirectReaPilot({prompt,requestFn:custom}),/REQUIRED_READ_ONLY_TOOL_NOT_INSTALLED/);
 assert.equal(f.stats().modelCount,0);
 assert.equal(f.stats().toolCount,0);
});
test('empty content and no calls yields truthful finish-reason and no fabricated action',async()=>{
 const f=fixture({noCall:true});
 const result=await runDirectReaPilot({prompt,requestFn:f.requestFn});
 assert.equal(result.state,'model_no_structured_call');
 assert.equal(result.diagnostic.finish_reason,'length');
 assert.equal(result.diagnostic.reasoning_chars,'some reasoning'.length);
 assert.equal(result.diagnostic.completion_tokens,1024);
 assert.equal(result.actions.length,0);
 assert.equal(f.stats().toolCount,0);
});
test('unadvertised model alias cannot execute',async()=>{
 const f=fixture({unadvertised:true});
 await assert.rejects(runDirectReaPilot({prompt,requestFn:f.requestFn}),/MODEL_CALLED_UNADVERTISED_TOOL/);
 assert.equal(f.stats().toolCount,0);
});
test('MCP isError never treated as successful execution',async()=>{
 const f=fixture({mcpError:true});
 await assert.rejects(runDirectReaPilot({prompt,requestFn:f.requestFn}),/REAL_MCP_TOOL_RETURNED_ERROR/);
 assert.equal(f.stats().toolCount,1);
 assert.equal(f.stats().summaryCount,0);
});
test('invalid catalogue count fails before model inference',async()=>{
 const f=fixture();
 const custom=async(url,body)=>{
  if(url===BASE+'/api/rea229/tools?limit=229')return {tools:f.all.slice(0,228)};
  return f.requestFn(url,body);
 };
 await assert.rejects(runDirectReaPilot({prompt,requestFn:custom}),/CATALOGUE_NOT_229/);
 assert.equal(f.stats().modelCount,0);
});
test('catalogue tool aliases and input schemas must be well formed',async()=>{
 const f=fixture();
 const changed=f.all.map(t=>t.name==='inspect_analysis_settings'?{...t,alias:'javascript:evil'}:t);
 assert.throws(()=>chooseReaDiagnosticTools(changed,prompt),/READ_ONLY_TOOL_SCHEMA_INVALID/);
});
test('CLI remains inert without explicit --run and --prompt',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const file=fileURLToPath(new URL('../scripts/Diagnose-Fun-Qwen-Rea229.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:10000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/QWEN_REA_DIAGNOSTIC=INACTIVE/);
});
