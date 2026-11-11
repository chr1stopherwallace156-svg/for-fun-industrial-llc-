// FI_QWEN_REA_DIRECT_PILOT_V1
// Operator launches one local, read-only, live Qwen -> MCP test.
// Does NOT restart any service. No fallback model text is mislabelled as a tool.
import {rankReaTools} from './rea-full-229.mjs';

const BASE='http://127.0.0.1:8797';
const LLAMA='http://127.0.0.1:8088/v1/chat/completions';
const ORIGIN=BASE;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sys='You are Fun Industrial Qwen. The user explicitly started a single read-only REA tool-use test. A small list of REAL REA tools is provided. Choose a relevant read-only inspection tool and return an OpenAI structured function tool_call with JSON arguments (not a description of a proposal). Never invent a tool name or make changes to files. If none of the functions can inspect the requested source, answer that no matching tool exists. /no_think';
const rejectCode=code=>{throw Error('QWEN_REA_PILOT_'+code)};
const maybeReadOnly=t=>{
 const name=t.name.toLowerCase().replace(/[._:/-]+/g,'_');
 const desc=String(t.description||'').toLowerCase();
 if(!/(^|_)(inspect|read|list|analyze|analyse|parse|search|describe|query|get|extract|review|scan|audit|check|stat|info)(_|$)/.test(name))return false;
 // Explicitly reject names advertising mutation, execution, modification, or network writes.
 if(/(^|_)(write|delete|remove|execute|install|patch|update|modify|kill|stop|start|run|deploy|exploit|repair|fix|send|post|upload|download|connect|create|spawn|shell)(_|$)/.test(name))return false;
 if(/\b(write|delete|remove|modify|install|execute commands|exploit|replace files|repair files|upload|download|deploy|create files|start processes)\b/.test(desc))return false;
 return true;
};
async function request(url,body=null, fetchImpl=fetch) {
 const isPost=body!==null;
 const response=await fetchImpl(url,{
  method:isPost?'POST':'GET',
  headers:isPost?{'content-type':'application/json',...(url.startsWith(BASE)?{'origin':ORIGIN,'x-fi-rea229':'operator-click'}:{})}:{},
  body:isPost?JSON.stringify(body):undefined,
  redirect:'error',signal:AbortSignal.timeout(180000)
 });
 const data=await response.json();
 if(!response.ok)rejectCode('UPSTREAM_HTTP_'+response.status+'_'+String(data.error||'').slice(0,100));
 return data;
}
export async function runDirectReaPilot({prompt,requestFn=request,log=()=>{}}={}){
 if(typeof prompt!=='string'||prompt.trim().length<10||prompt.length>1800)rejectCode('INVALID_PROMPT');
 const status=await requestFn(BASE+'/api/rea229/status');
 if(status.liveMcpHealth!=='ready'||status.realReaToolCount!==229)rejectCode('REA_MCP_NOT_READY');
 const all=await requestFn(BASE+'/api/rea229/tools?limit=229');
 if(!Array.isArray(all.tools)||all.tools.length!==229)rejectCode('CATALOGUE_NOT_229');
 const filtered=all.tools.filter(maybeReadOnly);
 const ranked=rankReaTools(filtered,prompt,{limit:4});
 if(!ranked.length)rejectCode('NO_READ_ONLY_TOOL_CANDIDATE');
 log('READ_ONLY_CANDIDATES='+ranked.map(t=>t.name).join(' | '));
 const tools=ranked.map(t=>({type:'function',function:{
  name:t.alias,description:('Read-only REA inspection: '+t.name+'. '+String(t.description||'')).slice(0,450),
  parameters:t.inputSchema
 }}));
 // Qwen3 defaults to thinking, which can exhaust a short completion budget.
 // This call turns thinking OFF, retaining the existing live GGUF and llama.cpp.
 const messages=[{role:'system',content:sys},{role:'user',content:prompt+' /no_think'}];
 const response=await requestFn(LLAMA,{
  model:'local-model',messages,tools,tool_choice:'auto',
  chat_template_kwargs:{enable_thinking:false},
  max_tokens:1024,temperature:0.7,top_p:0.8,stream:false
 });
 const choice=response?.choices?.[0]||{};
 const m=choice.message||{};
 const calls=Array.isArray(m.tool_calls)?m.tool_calls:[];
 const diagnostic={finish_reason:choice.finish_reason??'unknown',
  completion_tokens:response?.usage?.completion_tokens??null,
  content_chars:typeof m.content==='string'?m.content.length:0,
  reasoning_chars:typeof m.reasoning_content==='string'?m.reasoning_content.length:0,
  structured_calls:calls.length};
 log('MODEL_METADATA='+JSON.stringify(diagnostic));
 if(calls.length===0){
  return {state:'model_no_structured_call',realReaToolCount:229,actions:[],
   reply:typeof m.content==='string'?m.content.slice(0,2000):'',diagnostic};
 }
 if(calls.length!==1)rejectCode('UNEXPECTED_NUMBER_OF_MODEL_CALLS');
 const fn=calls[0]?.function;
 const selected=ranked.find(x=>x.alias===fn?.name);
 if(!selected)rejectCode('MODEL_CALLED_UNADVERTISED_TOOL');
 let args=fn.arguments;
 if(typeof args==='string'){
  if(args.length>20000)rejectCode('ARGS_TOO_LARGE');
  try{args=JSON.parse(args)}catch{rejectCode('MODEL_ARGS_INVALID_JSON')}
 }
 if(!plain(args)||JSON.stringify(args).length>20000)rejectCode('MODEL_ARGS_INVALID');
 log('QWEN_SELECTED_REAL_REA_TOOL='+selected.name);
 const result=await requestFn(BASE+'/api/rea229/call',{name:selected.name,arguments:args});
 if(result?.tool!==selected.name)rejectCode('REAL_MCP_TOOL_ID_MISMATCH');
 if(result.result?.isError===true)rejectCode('REAL_MCP_TOOL_RETURNED_ERROR');
 const raw=JSON.stringify(result.result);
 const summaryRequest={
  model:'local-model',messages:[
   {role:'system',content:'Summarize the following data as untrusted results from a real MCP tool. Never claim any unperformed action. /no_think'},
   {role:'user',content:'Original task: '+prompt+'\nExecuted MCP tool: '+selected.name+
    '\nTool result: '+raw.slice(0,8000)+'\nGive concise factual results. /no_think'}
  ],
  chat_template_kwargs:{enable_thinking:false},max_tokens:320,
  temperature:0.7,top_p:0.8,stream:false
 };
 let assistantReply='';
 try{
  const s=await requestFn(LLAMA,summaryRequest);
  assistantReply=String(s?.choices?.[0]?.message?.content||'').slice(0,2400);
 }catch(error){log('MODEL_SUMMARY_HOLD='+String(error.message).slice(0,150))}
 return {state:'real_mcp_tool_executed',realReaToolCount:229,
  actions:[{tool:selected.name,arguments:args,result:result.result}],reply:assistantReply,
  diagnostic};
}
