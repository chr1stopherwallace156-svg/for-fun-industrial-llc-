import test from "node:test";
import assert from "node:assert/strict";
import {selectCapabilities} from "../src/unified-agent.mjs";

const schema=(name,description,parameters={type:"object",properties:{},additionalProperties:false})=>({type:"function",function:{name,description,parameters}});
const web=schema("fi_web_search","Search public websites and return source snippets",{type:"object",properties:{query:{type:"string"}},required:["query"],additionalProperties:false});
const graph=schema("fi_graph_analyze","Analyze a connected graph and degree centrality");
const tensor=schema("fi_tensor_contract","Contract a tensor network matrix");
const rea=[{name:"inspect_rust_binary",description:"Inspect Rust binary dependency metadata in an approved local file",inputSchema:{type:"object",properties:{path:{type:"string"}},required:["path"],additionalProperties:false}},{name:"analyze_python_code",description:"Analyze Python source code",inputSchema:{type:"object",properties:{}}}];

test("normal conversation carries no tool definitions",()=>{
 const selected=selectCapabilities("Hello, how are you?",[web,graph,tensor],rea);
 assert.equal(selected.tools.length,0);
 assert.equal(selected.approval_required,true);
});
test("explicit internet research selects web search without all 229 tools",()=>{
 const selected=selectCapabilities("Search the web for electric truck news",[web,graph,tensor],rea);
 assert.equal(selected.tools[0].function.name,"fi_web_search");
 assert.ok(selected.tools.length<=2);
});
test("inspection selects relevant REA candidate without granting execution",()=>{
 const selected=selectCapabilities("Inspect rust binary dependency metadata",[web,graph,tensor],rea);
 assert.ok(selected.tools.some(t=>t.function.name==="rea__inspect_rust_binary"));
 assert.equal(selected.execution,undefined);
});
test("graph operations select a graph tool",()=>{
 const selected=selectCapabilities("Analyze graph connected components",[web,graph,tensor],rea);
 assert.ok(selected.tools.some(t=>t.function.name==="fi_graph_analyze"));
});
test("tool definitions are explicitly bounded to at most two",()=>{
 const list=Array.from({length:229},(_,i)=>({name:"inspect_python_"+i,description:"Inspect Python source code",inputSchema:{type:"object",properties:{}}}));
 const selected=selectCapabilities("Inspect Python source code",[web,graph,tensor],list);
 assert.ok(selected.tools.length<=2);
});
test("oversized tool JSON schemas are excluded from model context",()=>{
 const huge={name:"inspect_rust_binary",description:"Inspect rust binary",inputSchema:{type:"object",properties:{notes:{type:"string",description:"x".repeat(5000)}}}};
 const selected=selectCapabilities("Inspect rust binary",[web], [huge]);
 assert.equal(selected.tools.length,0);
});
test("invalid messages are rejected without calling tools",()=>{
 assert.throws(()=>selectCapabilities("x".repeat(3001),[web],rea),/invalid user query/);
});
test("router exposes selected tool name and stable discovery metadata",()=>{
 const result=selectCapabilities("Search online",[web],rea);
 assert.equal(result.strategy,"bounded-tool-discovery-v1");
 assert.equal(result.available.rea,2);
 assert.equal(result.available.local,1);
 assert.equal(result.routes[0].name,"fi_web_search");
});
