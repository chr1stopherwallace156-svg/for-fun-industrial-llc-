import test from "node:test";
import assert from "node:assert/strict";
import {constrainForReadOnlyCodeAnswer,selectCapabilities} from "../src/unified-agent.mjs";
const tool={type:"function",function:{name:"fi_graph_analyze",description:"Analyze a graph",parameters:{type:"object",properties:{}}}};
const rea={name:"inspect_rust_binary",description:"Inspect rust binary dependency metadata",inputSchema:{type:"object",properties:{}}};
const context={context:"FILE src/unified-agent.mjs\n42: function selectCapabilities(){}",files:["src/unified-agent.mjs"]};
test("read-only coding explanation strips unneeded tools",()=>{
 const route={tools:[tool],routes:[{name:"fi_graph_analyze"}],strategy:"bounded-tool-discovery-v1"};
 const x=constrainForReadOnlyCodeAnswer("Inspect src/unified-agent.mjs source code. Explain tool selection and suggest one improvement without modifying files.",route,context);
 assert.equal(x.tools.length,0);
 assert.equal(x.strategy,"read-only-code-analysis-v1");
 assert.equal(route.tools.length,1);
});
test("explicit REA invocation remains eligible for approval",()=>{
 const route=selectCapabilities("Use REA tool rea__inspect_rust_binary to inspect rust binary",[],[rea]);
 const x=constrainForReadOnlyCodeAnswer("Use REA tool rea__inspect_rust_binary to inspect rust binary",route,context);
 assert.deepEqual(x.tools,route.tools);
});
test("missing source context never strips tool proposals",()=>{
 const route={tools:[tool],routes:[{name:"fi_graph_analyze"}],strategy:"bounded-tool-discovery-v1"};
 const x=constrainForReadOnlyCodeAnswer("Explain the source code",route,{files:[],context:""});
 assert.deepEqual(x,route);
});
test("pure data explanations still work without tool schemas",()=>{
 const route={tools:[tool],routes:[{name:"fi_graph_analyze"}],strategy:"bounded-tool-discovery-v1"};
 const x=constrainForReadOnlyCodeAnswer("What is this function doing?",route,context);
 assert.equal(x.tools.length,0);
});

test("exact live question: negated tool execution preserves read-only code route",()=>{
 const route={tools:[tool],routes:[{name:"fi_graph_analyze"}],strategy:"bounded-tool-discovery-v1"};
 const query="Explain the selectCapabilities function in src/unified-agent.mjs using its retrieved source. Describe how it filters candidates, chooses web tools and limits tool definitions. Cite source line numbers. Do not execute tools.";
 const result=constrainForReadOnlyCodeAnswer(query,route,context);
 assert.equal(result.strategy,"read-only-code-analysis-v1");
 assert.equal(result.tools.length,0);
 assert.equal(result.routes.length,0);
 assert.equal(route.tools.length,1);
});
test("negated calls or REA execution never authorize a tool proposal in code explanations",()=>{
 const route={tools:[tool],routes:[{name:"fi_graph_analyze"}],strategy:"bounded-tool-discovery-v1"};
 for(const query of [
   "Review the source code. Do not call tools or modify files.",
   "Explain selectCapabilities function but never use REA tools.",
   "Explain this function without running tools.",
   "Explain the source function. No tool execution.",
   "Use REA tool rea__inspect_rust_binary to inspect source code but do not execute tools."
 ]){
   const result=constrainForReadOnlyCodeAnswer(query,route,context);
   assert.equal(result.tools.length,0,query);
   assert.equal(result.strategy,"read-only-code-analysis-v1",query);
 }
});
test("affirmative explicit tool operation remains available for operator approval",()=>{
 const route=selectCapabilities("Use REA tool rea__inspect_rust_binary to inspect rust binary",[],[rea]);
 const result=constrainForReadOnlyCodeAnswer("Use REA tool rea__inspect_rust_binary to inspect rust binary",route,context);
 assert.deepEqual(result.tools,route.tools);
 assert.equal(result.strategy,route.strategy);
});
