import test from 'node:test';
import assert from 'node:assert/strict';
import {runDirectReaPilot} from '../src/experimental/rea-qwen-direct-pilot.mjs';
const BASE='http://127.0.0.1:8797';
const LLAMA='http://127.0.0.1:8088/v1/chat/completions';
function fixture(overrides={}){
 const all=Array.from({length:229},(_,i)=>{
  const name=i===7?'rea_inspect_source_code':i===9?'rea_delete_source_file':'rea_generic_fixture_'+String(i).padStart(3,'0');
  return {name,alias:'rea_tool_'+String(i+1).padStart(3,'0'),
   description:i===7?'Read-only source code inspection':i===9?'Delete a source file':'Generic fixture',
   inputSchema:{type:'object',properties:{path:{type:'string'}},required:[]}};
 });
 let modelCount=0,toolCount=0,summaryCount=0,modelBody=null,exactPayload=null;
 const requestFn=async(url,body)=>{
  if(url===BASE+'/api/rea229/status')return {liveMcpHealth:'ready',realReaToolCount:229};
  if(url===BASE+'/api/rea229/tools?limit=229')return {tools:all,total:229};
  if(url===LLAMA){
   if(body.tools){
    modelBody=body;modelCount++;
    if(overrides.noCall)return {choices:[{finish_reason:'length',message:{content:null,reasoning_content:'some reasoning'}}],
      usage:{completion_tokens:1024}};
    if(overrides.unadvertised)return {choices:[{finish_reason:'tool_calls',
      message:{tool_calls:[{function:{name:'rea_tool_zzz',arguments:'{}'}}]}}]};
    return {choices:[{finish_reason:'tool_calls',
      message:{tool_calls:[{function:{
       name:body.tools[0].function.name,arguments:JSON.stringify({path:'test-file.mjs'})}}]}}],
     usage:{completion_tokens:67}};
   }
   summaryCount++;
   return {choices:[{finish_reason:'stop',message:{content:'Confirmed read-only source findings.'}}]};
  }
  if(url===BASE+'/api/rea229/call'){
   toolCount++;exactPayload=body;
   return {tool:body.name,result:{isError:!!overrides.mcpError,content:[{type:'text',text:'REAL MCP RESULT'}]}};
  }
  throw Error('UNEXPECTED_URL_'+url);
 };
 return {all,requestFn,stats:()=>({modelCount,toolCount,summaryCount,modelBody,exactPayload})};
}
const prompt='Read-only inspect the source code for test-file.mjs using a real REA capability; do not modify it.';
test('no-thinking Qwen emits one genuine MCP call; result summarized with distinct verified action',async()=>{
 const f=fixture(),logs=[];
 const result=await runDirectReaPilot({prompt,requestFn:f.requestFn,log:x=>logs.push(x)});
 assert.equal(result.state,'real_mcp_tool_executed');
 assert.equal(result.actions.length,1);
 assert.equal(result.actions[0].tool,'rea_inspect_source_code');
 assert.equal(result.actions[0].result.content[0].text,'REAL MCP RESULT');
 assert.equal(result.reply,'Confirmed read-only source findings.');
 const s=f.stats();
 assert.equal(s.modelCount,1);assert.equal(s.toolCount,1);assert.equal(s.summaryCount,1);
 assert.equal(s.exactPayload.name,'rea_inspect_source_code');
 assert.equal(s.modelBody.chat_template_kwargs.enable_thinking,false);
 assert.equal(s.modelBody.max_tokens,1024);
 assert.equal(s.modelBody.tool_choice,'auto');
 assert.ok(s.modelBody.tools.length<=4);
 assert.ok(s.modelBody.tools.every(x=>!x.function.description.toLowerCase().includes('delete')));
 assert.ok(logs.some(x=>x.includes('MODEL_METADATA=')));
 assert.ok(logs.some(x=>x.includes('QWEN_SELECTED_REAL_REA_TOOL=')));
});
test('empty content and no calls returns truthful diagnostics with no fabricated execution',async()=>{
 const f=fixture({noCall:true});
 const result=await runDirectReaPilot({prompt,requestFn:f.requestFn});
 assert.equal(result.state,'model_no_structured_call');
 assert.equal(result.diagnostic.finish_reason,'length');
 assert.equal(result.diagnostic.reasoning_chars,'some reasoning'.length);
 assert.equal(result.diagnostic.completion_tokens,1024);
 assert.equal(result.actions.length,0);
 assert.equal(f.stats().toolCount,0);
});
test('a model-selected but unadvertised name cannot execute',async()=>{
 const f=fixture({unadvertised:true});
 await assert.rejects(runDirectReaPilot({prompt,requestFn:f.requestFn}),/MODEL_CALLED_UNADVERTISED_TOOL/);
 assert.equal(f.stats().toolCount,0);
});
test('MCP reported isError is never treated as a successfully executed tool',async()=>{
 const f=fixture({mcpError:true});
 await assert.rejects(runDirectReaPilot({prompt,requestFn:f.requestFn}),/REAL_MCP_TOOL_RETURNED_ERROR/);
 assert.equal(f.stats().toolCount,1);
 assert.equal(f.stats().summaryCount,0);
});
test('invalid catalogues are rejected and no inference is attempted',async()=>{
 const f=fixture();
 const custom=async(url,body)=>{
  if(url===BASE+'/api/rea229/tools?limit=229')return {tools:f.all.slice(0,228)};
  return f.requestFn(url,body);
 };
 await assert.rejects(runDirectReaPilot({prompt,requestFn:custom}),/CATALOGUE_NOT_229/);
 assert.equal(f.stats().modelCount,0);
});
test('no source-inspection read-only matching capability fails closed',async()=>{
 const f=fixture();
 const custom=async(url,body)=>{
  if(url===BASE+'/api/rea229/tools?limit=229')
   return {tools:f.all.map(t=>({...t,name:'rea_delete_'+t.name,description:'Delete file and modify source code'}))};
  return f.requestFn(url,body);
 };
 await assert.rejects(runDirectReaPilot({prompt,requestFn:custom}),/NO_READ_ONLY_TOOL_CANDIDATE/);
 assert.equal(f.stats().modelCount,0);
});
test('CLI is inert until explicitly --run and --prompt are provided',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const file=fileURLToPath(new URL('../scripts/Diagnose-Fun-Qwen-Rea229.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:10000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/QWEN_REA_DIAGNOSTIC=INACTIVE/);
});
