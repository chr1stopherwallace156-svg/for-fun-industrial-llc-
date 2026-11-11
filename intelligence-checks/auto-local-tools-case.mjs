import test from 'node:test';
import assert from 'node:assert/strict';
import {runAutoLocalExperiment,selectCurrentLocalTools,selectRelevantLocalTools} from '../src/experimental/auto-local-tools.mjs';
import {runHttpExperiment} from '../scripts/Run-Fun-Auto-Local-Experiment.mjs';
const defs=['fi_graph_analyze','fi_tensor_contract','fi_compute_train','fi_compute_predict','fi_hopfield_store','fi_hopfield_recall','fi_universe_list']
 .map(name=>({type:'function',function:{name,description:name.replaceAll('_',' '),parameters:{type:'object',properties:{}}}}));
const call=(name,args={})=>({function:{name,arguments:JSON.stringify(args)},type:'function'});
test('all currently registered local functions are available but only relevant schemas consume tokens',()=>{
 const tools=selectCurrentLocalTools(defs);
 assert.equal(tools.length,7);
 assert.equal(selectRelevantLocalTools(tools,'analyze a graph').length,6);
 assert.equal(selectRelevantLocalTools(tools,'analyze a graph')[0].function.name,'fi_graph_analyze');
 assert.equal(selectRelevantLocalTools(tools,'tensor matrix')[0].function.name,'fi_tensor_contract');
});
test('model executes two local actions in a single operator-started session without per-call confirmation',async()=>{
 const executed=[],seen=[];
 const result=await runAutoLocalExperiment({prompt:'Analyze graph nodes and edges',definitions:defs,maxRounds:2,
  chat:async body=>{
   seen.push(body);
   if(seen.length===1)return {reply:'Using graph analysis',tool_calls:[call('fi_graph_analyze',{nodes:['a','b'],edges:[['a','b']]})]};
   return {reply:'Two connected nodes.',tool_calls:[]};
  },
  execute:async body=>{executed.push(body);return {tool:body.name,result:{nodes:2,edges:1}}},
  onAction:()=>{}});
 assert.equal(result.state,'completed_with_actions');
 assert.equal(result.registeredLocal,defs.length);
 assert.equal(executed.length,1);
 assert.equal(executed[0].name,'fi_graph_analyze');
 assert.equal(seen[0].tools.length,6);
 assert.ok(seen[1].messages.at(-1).content.includes('"nodes":2'));
});
test('REA tools are never registered or executed by the local-runner',async()=>{
 const calls=[];
 const result=runAutoLocalExperiment({prompt:'Try REA MCP tool execution',definitions:defs,
  chat:async()=>({tool_calls:[call('rea__scan')]}),
  execute:async args=>{calls.push(args);return {tool:args.name,result:'oops'}}});
 await assert.rejects(result,/TOOL_NOT_IN_ACTIVE_LOCAL_REGISTRY/);
 assert.equal(calls.length,0);
});
test('rejects unknown or unadvertised local functions',async()=>{
 const calls=[];
 await assert.rejects(runAutoLocalExperiment({prompt:'Use an unavailable tool',definitions:defs,
  chat:async()=>({tool_calls:[call('fi_unknown')]}),
  execute:async value=>{calls.push(value);return {tool:value.name,result:{}}}}),/TOOL_NOT_IN_ACTIVE_LOCAL_REGISTRY/);
 assert.equal(calls.length,0);
});
test('model declines without invoking any action',async()=>{
 let n=0;
 const result=await runAutoLocalExperiment({prompt:'Describe the tools',definitions:defs,
  chat:async()=>({reply:'No tool needed'}),execute:async()=>{n++}});
 assert.equal(result.state,'model_declined_or_no_calls');
 assert.equal(n,0);
});
test('tool HTTP failure stops session; never replays action automatically',async()=>{
 let n=0;
 await assert.rejects(runAutoLocalExperiment({prompt:'Analyze graph',definitions:defs,
  chat:async()=>({tool_calls:[call('fi_graph_analyze',{})]}),
  execute:async()=>{n++;throw Error('HTTP 503')}}),/HTTP 503/);
 assert.equal(n,1);
});
test('bounded rounds do not create a daemon or continue without an operator',async()=>{
 let n=0;
 const result=await runAutoLocalExperiment({prompt:'Analyze graph',definitions:defs,maxRounds:1,
  chat:async()=>({tool_calls:[call('fi_graph_analyze',{})]}),
  execute:async x=>{n++;return {tool:x.name,result:{nodes:2}}}});
 assert.equal(result.state,'round_budget_reached');
 assert.equal(n,1);
});
test('malformed model arguments cannot cause an action',async()=>{
 let n=0;
 await assert.rejects(runAutoLocalExperiment({prompt:'Analyze graph',definitions:defs,
  chat:async()=>({tool_calls:[call('fi_graph_analyze','bad')]}),
  execute:async()=>{n++}}),/INVALID_ARGUMENTS/);
 assert.equal(n,0);
});
test('HTTP adapter verifies working deployed cognition and capability index before model request',async()=>{
 const seen=[];
 const client=async(path,options)=>{
  seen.push(path);
  if(path==='/api/ai/status')return {state:'ready'};
  if(path==='/api/cognition/health')return {version:'fi-cognitive-live-bridge-v1',reaExecutionGrants:0};
  if(path==='/api/cognition/catalogue/status')return {version:'fi-capability-index-v1',executionGrants:0,localCount:defs.length};
  if(path==='/api/ai/tools')return {local_tool_count:defs.length,tools:defs};
  if(path==='/api/ai/chat')return {reply:'No tool needed'};
  throw Error('unexpected '+path);
 };
 const res=await runHttpExperiment({prompt:'Explain graph capabilities',client});
 assert.equal(res.state,'model_declined_or_no_calls');
 assert.ok(seen.includes('/api/ai/chat'));
 assert.ok(!seen.includes('/api/rea/call'));
});
test('no unauthenticated production REA or arbitrary server action in source',async()=>{
 const {readFile}=await import('node:fs/promises');
 const s=await readFile(new URL('../scripts/Run-Fun-Auto-Local-Experiment.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/\/api\/rea\/call|\/api\/activate|\/api\/stop|child_process|spawn\(/);
 assert.match(s,/127\.0\.0\.1:8789/);
});
