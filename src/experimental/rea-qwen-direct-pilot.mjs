// FI_QWEN_REA_DIRECT_PILOT_V1
// Operator launches one local, read-only, live Qwen -> MCP test.
// Does NOT restart any service. No fallback model text is mislabelled as a tool.

const BASE='http://127.0.0.1:8797';
const LLAMA='http://127.0.0.1:8088/v1/chat/completions';
const ORIGIN=BASE;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sys='You are Fun Industrial Qwen in a one-shot REA verification task. The human operator requested inspection of this MCP session and authorized use of the ONE advertised read-only REA inspection function. To answer with real evidence, emit an OpenAI structured function tool_call with JSON arguments matching its schema. If the function is binary_session, use an empty JSON arguments object. Do not propose a different tool, modify settings, access Android, or claim a result before the tool returns. /no_think';
const rejectCode=code=>{throw Error('QWEN_REA_PILOT_'+code)};
// An MCP tool's name containing 'read' is not a filesystem-reading capability.
// The earlier heuristic offered read_adb_setting for a .mjs file, causing a
// genuine but unrelated REA tools/call error. Use exact purpose-bound profiles.
const matchPrompt={
 settings:p=>/\b(?:rea|mcp)\b/i.test(p)&&/\banalys[ie]s\b/i.test(p)&&
  /\bsettings?\b/i.test(p)&&!/\.(?:js|mjs|cjs|ts|tsx|jsx)\b/i.test(p),
 status:p=>/\b(?:rea|mcp)\b/i.test(p)&&
  /\b(?:binary.session|session.status|providers?|capabilit(?:y|ies)|availab(?:le|ility))\b/i.test(p)&&
  /\b(?:status|inspect|inspectable|check|report|show|list|available|availability)\b/i.test(p)&&
  !/\.(?:js|mjs|cjs|ts|tsx|jsx)\b/i.test(p)
};
export function chooseReaDiagnosticTools(catalogue,prompt){
 if(!Array.isArray(catalogue)||catalogue.length!==229)rejectCode('CATALOGUE_NOT_229');
 if(typeof prompt!=='string'||prompt.length<10||prompt.length>1800)rejectCode('INVALID_PROMPT');
 const category=matchPrompt.settings(prompt)?'settings':matchPrompt.status(prompt)?'status':null;
 if(!category)rejectCode('NO_VERIFIED_COMPATIBLE_READ_ONLY_REA_TOOL_FOR_TASK');
 const names=category==='settings'?['inspect_analysis_settings']:['binary_session'];
 const selected=names.map(name=>catalogue.find(t=>t?.name===name));
 if(selected.some(t=>!t))rejectCode('REQUIRED_READ_ONLY_TOOL_NOT_INSTALLED');
 for(const tool of selected){
  if(typeof tool.alias!=='string'||!/^rea_tool_[0-9]{3}$/.test(tool.alias)
   ||!plain(tool.inputSchema)||tool.inputSchema.type!=='object'
   ||typeof tool.name!=='string')rejectCode('READ_ONLY_TOOL_SCHEMA_INVALID');
 }
 return selected;
}
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
 const ranked=chooseReaDiagnosticTools(all.tools,prompt);
 log('READ_ONLY_CANDIDATES='+ranked.map(t=>t.name).join(' | '));
 // A tool's full MCP input schema can advertise effects that this smoke test
 // deliberately does not grant (binary_session: complete/refresh). Only show
 // Qwen the no-arguments schema; the client supplies fixed safe status options.
 const tools=ranked.map(t=>({type:'function',function:{
  name:t.alias,description:('Read-only REA inspection: '+t.name+'. '+String(t.description||'')).slice(0,450),
  parameters:t.name==='binary_session'?{type:'object',properties:{},additionalProperties:false}:t.inputSchema
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
 // The live MCP input schema, not the upstream docs, owns the contract.
 // The installed REA rejected both 'detail' and 'refresh_candidates' as
 // unrecognized. For this read-only status pilot, submit NO arguments.
 // If the live schema requires fields, refuse instead of guessing values.
 let actualArgs=args;
 if(selected.name==='binary_session'){
  const schema=selected.inputSchema;
  if(!plain(schema)||schema.type!=='object')rejectCode('LIVE_BINARY_SCHEMA_INVALID');
  if(schema.required!==undefined&&
     (!Array.isArray(schema.required)||schema.required.length!==0))
   rejectCode('LIVE_BINARY_SCHEMA_REQUIRES_ARGUMENTS');
  if(schema.additionalProperties===true||schema.patternProperties!==undefined||
     schema.anyOf!==undefined||schema.oneOf!==undefined||schema.allOf!==undefined)
   rejectCode('LIVE_BINARY_SCHEMA_NOT_BOUNDED');
  if(Object.keys(args).some(key=>!['detail','refresh_candidates'].includes(key)))
   rejectCode('SESSION_UNKNOWN_ARGUMENTS');
  actualArgs={};
  log('LIVE_BINARY_SCHEMA_REQUIRED='+JSON.stringify(schema.required??[]));
  if(Object.keys(args).length)log('QWEN_ARGS_DISCARDED_TO_LIVE_SCHEMA=TRUE');
  log('MCP_EXECUTION_ARGS='+JSON.stringify(actualArgs));
 }
 log('QWEN_SELECTED_REAL_REA_TOOL='+selected.name);
 // Validate that the selected operation remains the one exact allowed purpose.
 if(!ranked.some(t=>t.name===selected.name))rejectCode('TOOL_PURPOSE_CHANGED');
 const result=await requestFn(BASE+'/api/rea229/call',{name:selected.name,arguments:actualArgs});
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
  actions:[{tool:selected.name,arguments:actualArgs,result:result.result}],reply:assistantReply,
  diagnostic};
}
