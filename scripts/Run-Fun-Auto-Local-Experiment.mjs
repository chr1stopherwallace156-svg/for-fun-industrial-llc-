// FI_AUTO_LOCAL_CLI_V1
// One explicit operator-run local session. Model tool calls are executed without
// per-call prompts through the existing Fun Industrial fixed-local-tool API.
// No daemon, no shell executor, no REA initialization, no source changes.
import {runAutoLocalExperiment,selectCurrentLocalTools} from '../src/experimental/auto-local-tools.mjs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const BASE='http://127.0.0.1:8789';
const COMPUTE_CHAT='http://127.0.0.1:8791/ai/chat';
const PROPOSAL_FALLBACK='The model proposed a tool call. Review it before execution.';
function unforwardedProposal(reply){
 return reply && typeof reply==='object' && reply.reply===PROPOSAL_FALLBACK &&
  (!Array.isArray(reply.tool_calls)||reply.tool_calls.length===0);
}
function arg(flag,defaultValue){
 const i=process.argv.indexOf(flag);
 return i<0?defaultValue:process.argv[i+1];
}
async function request(path,{method='GET',body=null,timeout=10000}={}){
 // The only permitted cross-service route is the existing loopback compute chat.
 // No arbitrary URLs, REA routes or executable shell endpoints are accepted.
 const endpoint=path==='/__compute_chat__'?COMPUTE_CHAT:BASE+path;
 const response=await fetch(endpoint,{method,
  headers:body===null?{}:{'content-type':'application/json'},
  body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error('LOCAL_API_ERROR '+path+' HTTP='+response.status+' DETAIL='+String(data.error||data.detail||'unknown').slice(0,350));
 return data;
}
export async function runHttpExperiment({prompt,rounds=3,maxTokens=384,client=request,onAction=()=>{}}={}){
 const [ai,cognition,index,registry]=await Promise.all([
  client('/api/ai/status'),
  client('/api/cognition/health'),
  client('/api/cognition/catalogue/status'),
  client('/api/ai/tools')
 ]);
 if(ai?.state!=='ready')throw Error('AUTO_LOCAL_AI_NOT_READY');
 if(cognition?.version!=='fi-cognitive-live-bridge-v1'||cognition?.reaExecutionGrants!==0)
  throw Error('AUTO_LOCAL_COGNITION_BASELINE_UNEXPECTED');
 if(index?.version!=='fi-capability-index-v1'||index?.executionGrants!==0)
  throw Error('AUTO_LOCAL_CAPABILITY_INDEX_BASELINE_UNEXPECTED');
 const local=selectCurrentLocalTools(registry.tools);
 if(local.length!==Number(registry.local_tool_count)||local.length!==Number(index.localCount))
  throw Error('AUTO_LOCAL_LOCAL_REGISTRY_COUNT_MISMATCH');
 // No REA catalogue or REA function names are submitted to the local model.
 return runAutoLocalExperiment({
  prompt,definitions:local,maxRounds:rounds,maxTokens,
  chat:async body=>{
   const dashboard=await client('/api/ai/chat',{method:'POST',body,timeout:180000});
   if(!unforwardedProposal(dashboard))return dashboard;
   // A known llama.cpp fallback arrived without an executable tool_calls array.
   // Make exactly one non-executing model request to the existing compute service.
   // This DOES NOT run a tool; the existing runner independently validates any
   // structured call against the actual local tool schemas before dispatch.
   const raw=await client('/__compute_chat__',{method:'POST',body,timeout:180000});
   if(unforwardedProposal(raw))throw Error('AUTO_LOCAL_UNSTRUCTURED_MODEL_PROPOSAL_AT_BOTH_CHAT_LAYERS');
   return raw;
  },
  execute:body=>client('/api/ai/tool-call',{method:'POST',body,timeout:180000}),
  onAction
 });
}
async function main(){
 if(!process.argv.includes('--run')){
  console.log('AUTO_LOCAL=INACTIVE. Run with --run --prompt "a specific task". No per-tool approval prompts inside an operator-started run.');
  return;
 }
 const prompt=arg('--prompt',null);
 if(typeof prompt!=='string'||!prompt.trim())throw Error('MISSING_--prompt');
 const roundsRaw=arg('--rounds','3'),tokensRaw=arg('--tokens','384');
 if(!/^[1-8]$/.test(roundsRaw)||!/^[0-9]+$/.test(tokensRaw))throw Error('INVALID_ROUNDS_OR_TOKENS');
 const counts={n:0};
 const result=await runHttpExperiment({
  prompt,rounds:Number(roundsRaw),maxTokens:Number(tokensRaw),
  onAction:action=>{
   counts.n++;
   const repr=JSON.stringify(action.result);
   console.log('AUTO_LOCAL_ACTION='+counts.n+' TOOL='+action.tool+' ROUND='+action.round);
   console.log('AUTO_LOCAL_RESULT='+String(repr).slice(0,2400));
  }
 });
 console.log('AUTO_LOCAL_SESSION='+result.state+' REGISTERED_LOCAL='+result.registeredLocal+' ROUNDS='+result.rounds+' EXECUTED='+counts.n);
 console.log('AUTO_LOCAL_AI_REPLY='+String(result.reply||'').slice(0,4000));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{console.error('AUTO_LOCAL_HOLD='+String(error.message||error));process.exitCode=1});
}
