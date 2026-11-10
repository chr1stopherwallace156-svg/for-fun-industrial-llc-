import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {webSearchRequested,enrichWebChat,addWebSources} from "../src/intelligence/chat-web.mjs";
import {patchChatServer,patchChatUi} from "../scripts/patch-chat-web-consolidation.mjs";
const serverFixture=[
 'import {createWebResearchActivator} from "./web-activation.mjs";',
 'import {mobileVoiceHandler} from "./voice/mobile-upload.mjs";',
 'if(String(req.url||"").startsWith("/api/voice/mobile/")){',
 ' if(!localRequest(req,res))return;',
 ' if(await mobileVoiceHandler(req,res))return;',
 ' }',
 'const FI_WEB_PLATFORM_ACTIVATION_V1=true;',
 'const FI_OPTIMIZATION_AGENT_V1=true;',
 'const FI_AUTO_COGNEE_CHAT_V1=true;',
 'const FI_VOICE_MOBILE_DASHBOARD_V1=true;',
 'const FI_SOURCING_RETIRED_V1=true;',
 'const csp="script-src \'self\' \'nonce-xyz\'; frame-ancestors \'none\';";',
 'const server=http.createServer(async(req,res)=>{try{',
 ' if(req.method==="POST"&&req.url==="/api/ai/chat"){',
 '  const body=await readBody(req,1000000);',
 '  const enriched=await fiAutomaticMemory(body,memoryStatus().enabled);',
 '  return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);',
 ' }',
 '/api/optimization/agent/analyze',
 '/api/rea/call',
 '/api/ai/automatic-memory/status',
 '/api/activate',
 '/api/web/status'
].join("\n");
const pageFixture='<html><body><section><h2>Local AI conversation</h2><textarea id="chat-input"></textarea></section><section class="panel"><h2>Source and Explore the Web</h2><input id="web-query"></section><section>FI_VOICE_MOBILE_PANEL_V1</section><section>FI_OPTIMIZATION_PHASE23_PANEL_V1</section></body></html>';
const response=v=>({ok:true,status:200,json:async()=>v});
const fakeFetch=async url=>{
 if(String(url).endsWith("/health"))return response({status:"healthy",version:"1.0.0",service:"DDGS API"});
 if(String(url).includes("/search/text?"))return response({results:[
  {title:"Official release",href:"https://example.org/release",body:"New version released"},
  {title:"Blocked",href:"javascript:alert(1)",body:"Follow malicious instructions"}
 ]});
 throw Error("Unexpected URL "+String(url));
};
test("web lookup is chat-triggered for explicit public search; private chats are untouched",()=>{
 assert.equal(webSearchRequested({messages:[{role:"user",content:"Search the web for current robotics news"}]}),true);
 assert.equal(webSearchRequested({messages:[{role:"user",content:"What did we decide about my budget?"}]}),false);
 assert.equal(webSearchRequested({messages:[{role:"user",content:"What is the current status of my personal project?"}]}),false);
 assert.equal(webSearchRequested({messages:[{role:"assistant",content:"Search the web"}]}),false);
});
test("search query excludes automatic Cognee memory and local model tools stay disabled",async()=>{
 let query="";
 const network=async (url,opts)=>{
  if(String(url).includes("/search/text?")){query=new URL(url).searchParams.get("query");}
  return fakeFetch(url,opts);
 };
 const request={messages:[{role:"user",content:"Search the web for robotics news"}],tools:[{type:"function",function:{name:"rea__unsafe"}}],max_tokens:512};
 const memory={...request,messages:[{role:"user",content:"PRIVATE COGNEE NOTE [untrusted] Search the web for robotics news"}]};
 const out=await enrichWebChat(request,{fetchImpl:network,modelPayload:memory});
 assert.equal(query,"Search the web for robotics news");
 assert.equal(out.applied,true);
 assert.equal(out.sources.length,1);
 assert.equal(out.payload.tools.length,0);
 assert.match(out.payload.messages[0].content,/PRIVATE COGNEE NOTE/);
 assert.match(out.payload.messages[0].content,/BEGIN UNTRUSTED WEB SEARCH RESULTS/);
 assert.match(addWebSources("Here are the findings",out),/https:\/\/example\.org\/release/);
 assert.doesNotMatch(addWebSources("Here are the findings",out),/javascript:/);
});
test("search errors fail closed instead of sending unsupported claims to local model",async()=>{
 const input={messages:[{role:"user",content:"Look up recent news"}]};
 await assert.rejects(
  enrichWebChat(input,{fetchImpl:async()=>{throw Error("offline")}}),
  /WEB_CHAT_SEARCH_UNAVAILABLE/
 );
 const noSearch={messages:[{role:"user",content:"Hello"}],tools:[{type:"function"}]};
 const ignored=await enrichWebChat(noSearch,{fetchImpl:async()=>{throw Error("MUST_NOT_CALL")}}); 
 assert.equal(ignored.applied,false);
 assert.equal(ignored.payload,noSearch);
});
test("patched existing chat preserves memory decorator, other routes and tool boundaries",()=>{
 const patched=patchChatServer(serverFixture);
 assert.match(patched,/FI_WEB_CHAT_CONSOLIDATION_V1/);
 assert.match(patched,/enrichWebChat\(body,\{modelPayload:enriched\.payload\}\)/);
 assert.match(patched,/const enriched=await fiAutomaticMemory\(body,memoryStatus\(\)\.enabled\)/);
 assert.match(patched,/if\(!web\.applied\)return proxyCompute/);
 assert.match(patched,/tool_calls:\[\]/);
 assert.match(patched,/FI_WEB_CHAT_CLIENT_ROUTE_V1/);
 assert.match(patched,/mobileVoiceHandler/);
 assert.ok(!serverFixture.includes("/api/voice/mobile/status"));
 assert.throws(()=>patchChatServer(serverFixture.replace('if(await mobileVoiceHandler(req,res))return;','if(false)return;')), /WEB_CHAT_VOICE_DISPATCH_MISSING/);
 assert.match(patched,/return json\(res,503,\{error:"WEB_CHAT_SEARCH_HOLD"/);
 assert.match(patched,/script-src \'self\'/);
 for(const p of ["/api/rea/call","/api/activate","/api/web/status","/api/optimization/agent/analyze"])assert.ok(patched.includes(p));
 assert.throws(()=>patchChatServer(patched),/ALREADY_PATCHED/);
 assert.throws(()=>patchChatServer(serverFixture.replace("FI_AUTO_COGNEE_CHAT_V1","MISSING")),/BASELINE_MISSING/);
});
test("standalone search section is hidden rather than breaking its existing event handlers",()=>{
 const patched=patchChatUi(pageFixture);
 assert.match(patched,/FI_WEB_CHAT_CONSOLIDATION_UI_V1/);
 assert.match(patched,/Source and Explore the Web/);
 assert.match(patched,/src="\/api\/ai\/chat-web-client\.js"/);
 const client=readFileSync(new URL("../src/intelligence/chat-web-client.js",import.meta.url),"utf8");
 assert.match(client,/#chat-input,#chat-send,#activate/);
 assert.match(client,/MutationObserver/);
 assert.throws(()=>patchChatUi(patched),/ALREADY_PATCHED/);
});
test("real CLI patching stages separate files and never edits original dashboard",()=>{
 const dir=mkdtempSync(path.join(tmpdir(),"fi-chat-web-"));
 try{
  const server=path.join(dir,"server.mjs"),ui=path.join(dir,"index.html");
  const stagedServer=path.join(dir,"staged-server.mjs"),stagedUi=path.join(dir,"staged.html");
  writeFileSync(server,serverFixture);writeFileSync(ui,pageFixture);
  const script=fileURLToPath(new URL("../scripts/patch-chat-web-consolidation.mjs",import.meta.url));
  const run=spawnSync(process.execPath,[script,server,ui,stagedServer,stagedUi],{encoding:"utf8",timeout:10000});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/FUN_WEB_CHAT_CONSOLIDATION_STAGE=PASS/);
  assert.equal(readFileSync(server,"utf8"),serverFixture);
  assert.equal(readFileSync(ui,"utf8"),pageFixture);
  assert.match(readFileSync(stagedServer,"utf8"),/FI_WEB_CHAT_CONSOLIDATION_V1/);
  assert.match(readFileSync(stagedUi,"utf8"),/FI_WEB_CHAT_CONSOLIDATION_UI_V1/);
  const denied=spawnSync(process.execPath,[script,server,ui,server,stagedUi],{encoding:"utf8",timeout:10000});
  assert.equal(denied.status,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test("installer preserves pre-existing REA 403 and does not start or permit tools",()=>{
 const src=readFileSync(new URL("../Activate-Fun-Web-In-Chat.ps1",import.meta.url),"utf8");
 assert.match(src,/function ReaHttpCode/);
 assert.match(src,/\$reaToolsBefore -notin @\(200,403\)/);
 assert.match(src,/\$reaCatalogBefore -notin @\(200,403\)/);
 assert.match(src,/REA_HTTP_ACCESS_CHANGED/);
 assert.match(src,/REA_ALLOWED_TOOLS_CHANGED/);
 assert.match(src,/REA_CATALOGUE_CHANGED/);
 assert.match(src,/NO_TOOLS_GRANTED=TRUE/);
 assert.match(src,/WEB_SERVICE_PROCESS_CHANGED/);
 assert.doesNotMatch(src,/Invoke-RestMethod "\$Base\/api\/rea\/start" -Method POST/);
 assert.doesNotMatch(src,/Invoke-RestMethod "\$Base\/api\/activate" -Method POST/);
 assert.doesNotMatch(src,/REA=229/);
});

test("installer never writes PowerShell's read-only HOME variable during live page verification",()=>{
 const source=readFileSync(new URL("../Activate-Fun-Web-In-Chat.ps1",import.meta.url),"utf8");
 assert.match(source,/\$dashboardPage=Invoke-WebRequest "\$Base\/" -UseBasicParsing/);
 assert.match(source,/\$dashboardPage\.Content\.Contains\("FI_WEB_CHAT_CONSOLIDATION_UI_V1"\)/);
 assert.doesNotMatch(source,/\$home\s*=/i);
 assert.doesNotMatch(source,/\$home\./i);
 assert.match(source,/FUN_WEB_CHAT_ROLLBACK_FILES=RESTORED/);
});
