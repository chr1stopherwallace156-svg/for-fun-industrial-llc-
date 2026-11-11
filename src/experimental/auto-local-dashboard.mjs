// FI_AUTO_LOCAL_DASHBOARD_BRIDGE_V1
// One user-click starts a bounded session without per-tool confirmation.
// Live model + existing local registry only; never executes REA or arbitrary shell.
import {runAutoLocalExperiment,selectCurrentLocalTools} from './auto-local-tools.mjs';
const DASH='http://127.0.0.1:8789';
const LLAMA='http://127.0.0.1:8088/v1/chat/completions';
const EMPTY_PROPOSAL='The model proposed a tool call. Review it before execution.';
const SYSTEM='You are Fun Industrial local AI. The human operator clicked Run AI Tools Automatically for this one task, so you may use supplied local Fun Industrial functions without a separate confirmation for each call. When a supplied function is helpful, emit a structured OpenAI tool_calls response with JSON arguments. Never claim that a function ran before the software provides its result. Never request a tool that was not supplied.';
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const filtered=x=>x?.reply===EMPTY_PROPOSAL&&(!Array.isArray(x.tool_calls)||x.tool_calls.length===0);
async function fixedRequest(path,body=null,{timeoutMs=15000,fetchImpl=fetch}={}){
 const uri=path==='/__raw_llama__'?LLAMA:DASH+path;
 if(path!=='/__raw_llama__'&&!['/api/ai/status','/api/cognition/health','/api/cognition/catalogue/status','/api/ai/tools','/api/ai/chat','/api/ai/tool-call'].includes(path))
  throw Error('AUTO_DASH_UNEXPECTED_ROUTE');
 const response=await fetchImpl(uri,{method:body===null?'GET':'POST',
  headers:body===null?{}:{'content-type':'application/json'},
  body:body===null?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
 if(!response.ok)throw Error('AUTO_DASH_UPSTREAM_HTTP_'+response.status+'_'+path);
 const json=await response.json();
 if(!plain(json))throw Error('AUTO_DASH_RESPONSE_INVALID_'+path);
 return json;
}
export function createAutoLocalDashboard({client=fixedRequest}={}){
 if(typeof client!=='function')throw Error('AUTO_DASH_CLIENT_INVALID');
 let busy=false,completed=0,failed=0;
 function status(){return {version:'fi-auto-local-dashboard-v1',enabled:true,busy,
  completedSessions:completed,failedSessions:failed,operatorStarted:true,
  perToolApprovalPrompts:false,reaExecutionGrants:0,backgroundExecution:false,
  scope:'existing_local_registered_tools_only'};}
 async function run({prompt,rounds=2}={}){
  if(busy)throw Error('AUTO_DASH_CONCURRENT_SESSION');
  if(typeof prompt!=='string'||prompt.length<3||prompt.length>2000||!prompt.trim())
   throw Error('AUTO_DASH_INVALID_PROMPT');
  if(!Number.isInteger(rounds)||rounds<1||rounds>3)throw Error('AUTO_DASH_INVALID_ROUNDS');
  busy=true;
  try{
   const [ai,cognitive,index,toolsResponse]=await Promise.all([
    client('/api/ai/status'),client('/api/cognition/health'),
    client('/api/cognition/catalogue/status'),client('/api/ai/tools')
   ]);
   if(ai.state!=='ready')throw Error('AUTO_DASH_AI_NOT_READY');
   if(cognitive.version!=='fi-cognitive-live-bridge-v1'||cognitive.reaExecutionGrants!==0)
    throw Error('AUTO_DASH_COGNITION_IDENTITY_HOLD');
   if(index.version!=='fi-capability-index-v1'||index.executionGrants!==0)
    throw Error('AUTO_DASH_INDEX_IDENTITY_HOLD');
   const tools=selectCurrentLocalTools(toolsResponse.tools);
   if(tools.length!==toolsResponse.local_tool_count||tools.length!==index.localCount)
    throw Error('AUTO_DASH_LOCAL_TOOL_COUNT_HOLD');
   const result=await runAutoLocalExperiment({
    prompt,definitions:tools,maxRounds:rounds,maxTokens:384,
    chat:async body=>{
     const forwarded=await client('/api/ai/chat',body,{timeoutMs:180000});
     if(!filtered(forwarded))return forwarded;
     const raw=await client('/__raw_llama__',{
      model:'local-model',messages:[{role:'system',content:SYSTEM},...body.messages],
      tools:body.tools,tool_choice:'auto',max_tokens:body.max_tokens,
      temperature:body.temperature,stream:false
     },{timeoutMs:180000});
     const message=raw?.choices?.[0]?.message;
     if(!message||!Array.isArray(message.tool_calls)||message.tool_calls.length===0)
      throw Error('AUTO_DASH_NO_STRUCTURED_TOOL_CALL');
     return {reply:typeof message.content==='string'?message.content:'',
      tool_calls:message.tool_calls};
    },
    execute:payload=>client('/api/ai/tool-call',payload,{timeoutMs:180000})
   });
   completed++;
   return {version:'fi-auto-local-dashboard-v1',...result,reaExecutionGrants:0};
  }catch(error){failed++;throw error}
  finally{busy=false}
 }
 return Object.freeze({status,run});
}
