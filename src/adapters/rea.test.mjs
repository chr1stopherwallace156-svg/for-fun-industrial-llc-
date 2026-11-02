import test from "node:test";
import assert from "node:assert/strict";
import {createReaAdapter} from "./rea.mjs";
const fixture = String.raw`const readline=require("node:readline");const rl=readline.createInterface({input:process.stdin});rl.on("line",line=>{let m;try{m=JSON.parse(line)}catch{return}let result;if(m.method==="initialize")result={protocolVersion:"2025-11-25",capabilities:{tools:{}},serverInfo:{name:"rea-fixture",version:"1.0"}};else if(m.method==="tools/list")result=m.params&&m.params.cursor?{tools:[{name:"inspect_fixture_2",description:"Second page fixture",inputSchema:{type:"object",properties:{}}}]}:{tools:[{name:"inspect_fixture",description:"Read-only fixture",inputSchema:{type:"object",properties:{path:{type:"string"}}}}],nextCursor:"fixture-page-2"};else if(m.method==="tools/call")result={content:[{type:"text",text:"fixture inspected"}],isError:false};if(m.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result})+String.fromCharCode(10))})`;
test("REA adapter performs MCP initialize, tools/list and approved tools/call",async()=>{
 const adapter=createReaAdapter({enabled:true,command:process.execPath,args:["-e",fixture]});
 const started=await adapter.start();
 assert.equal(started.state,"ready");
 assert.equal(started.tool_count,2);
 assert.equal((await adapter.health()).state,"ready");
 assert.deepEqual(adapter.tools().map(tool=>tool.name),["inspect_fixture","inspect_fixture_2"]);
 const result=await adapter.callTool("inspect_fixture",{path:"synthetic.bin"});
 assert.equal(result.result.content[0].text,"fixture inspected");
 await adapter.stop();
 assert.equal((await adapter.health()).state,"stopped");
});
