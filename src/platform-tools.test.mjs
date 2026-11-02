import test from "node:test";
import assert from "node:assert/strict";
import {platformTools,openAiToolDefinitions,getPlatformTool} from "./platform-tools.mjs";
test("platform tool registry has unique fixed tool names",()=>{
 const names=platformTools.map(x=>x.name);
 assert.equal(new Set(names).size,names.length);
 assert.ok(names.includes("fi_hopfield_recall"));
 assert.ok(names.includes("fi_universe_neural_train"));
 assert.ok(names.includes("fi_tensor_contract"));
});
test("AI tool definitions include local functions and only supplied REA allowlist",()=>{
 const tools=openAiToolDefinitions([{name:"read_only_fixture",description:"read",inputSchema:{type:"object",properties:{}}}]);
 const names=tools.map(x=>x.function.name);
 assert.ok(names.includes("fi_graph_analyze"));
 assert.ok(names.includes("fi_universe_transfer_memory"));
 assert.ok(names.includes("rea__read_only_fixture"));
 assert.equal(names.some(x=>x==="rea__unapproved"),false);
 assert.ok(tools.length<=32);
});
test("platform tool lookup refuses unregistered functions",()=>{
 assert.equal(getPlatformTool("fi_graph_analyze").path,"/graph/analyze");
 assert.equal(getPlatformTool("shell_execute"),null);
});
