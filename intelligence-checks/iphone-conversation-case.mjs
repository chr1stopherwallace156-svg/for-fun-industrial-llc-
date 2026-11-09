import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {conversationHandler} from "../src/voice/conversation.mjs";
import {patchServer,patchUi} from "../scripts/patch-iphone-conversation.mjs";

function pcm(sec=3){
 const count=16000*sec,raw=Buffer.alloc(44+count*2);
 raw.write("RIFF",0);raw.writeUInt32LE(raw.length-8,4);raw.write("WAVEfmt ",8);
 raw.writeUInt32LE(16,16);raw.writeUInt16LE(1,20);raw.writeUInt16LE(1,22);
 raw.writeUInt32LE(16000,24);raw.writeUInt32LE(32000,28);raw.writeUInt16LE(2,32);
 raw.writeUInt16LE(16,34);raw.write("data",36);raw.writeUInt32LE(count*2,40);
 for(let i=0;i<count;i++)raw.writeInt16LE(Math.round(4000*Math.sin(i*2*Math.PI*230/16000)),44+i*2);
 return raw;
}
function fixture(){
 const temp=mkdtempSync(path.join(tmpdir(),"fi-voice-talk-"));
 const home=path.join(temp,"Talk"),vh=path.join(temp,"VoiceLab");
 const models=path.join(home,"models"),rec=path.join(vh,"recordings");
 const bin=path.join(home,"venv","Scripts","python.exe");
 mkdirSync(path.dirname(bin),{recursive:true});mkdirSync(models,{recursive:true});mkdirSync(rec,{recursive:true});
 writeFileSync(bin,"test only");writeFileSync(path.join(home,"transcribe.py"),"test only");
 writeFileSync(path.join(home,"conversation.enabled"),"FI_FUN_VOICE_CONVERSATION_ENABLED_V1\n");
 writeFileSync(path.join(vh,"mobile-upload.enabled"),"FI_VOICE_MOBILE_RECORDING_ENABLED_V1\n");
 const name="iphone-20261109T060000Z-aabbccddeeff.wav";
 writeFileSync(path.join(rec,name),pcm());
 return {temp,home,vh,name,env:{LOCALAPPDATA:temp,FI_VOICE_CONVERSATION_HOME:home,FUN_VOICE_HOME:vh}};
}
function request(url,method="GET",data={},extra={}){
 const bytes=Buffer.from(JSON.stringify(data));
 return {url,method,headers:{...extra, ...(method==="POST"?{
  "content-type":"application/json","x-voice-conversation-intent":"manual-ask"
 }: {})},socket:{remoteAddress:"127.0.0.1"},
 async *[Symbol.asyncIterator](){if(method==="POST")yield bytes}};
}
async function call(req,env,injections){
 const res={status:0,body:"",
  writeHead(code){this.status=code;return this;},end(value){this.body=value;return this}};
 const handled=await conversationHandler(req,res,env,injections);
 assert.equal(handled,true);return {http:res.status,...JSON.parse(res.body)};
}
test("conversation route is opt-in, transcribes an existing saved WAV and uses only text AI, no REA or writes",async()=>{
 const f=fixture();
 try{
 let sttCount=0,chatCount=0;
 const injections={stt:async(...args)=>{
   sttCount++;
   assert.equal(args[2],path.join(f.vh,"recordings",f.name));
   assert.equal(args[3],path.join(f.home,"models"));
   return "How can we plan a small robotics project?";
  },chat:async messages=>{
   chatCount++;assert.deepEqual(messages,[{role:"user",content:"How can we plan a small robotics project?"}]);
   return "Start with a simple parts inventory and requirements."}};
 const status=await call(request("/api/voice/conversation/status"),f.env,injections);
 assert.equal(status.http,200);assert.equal(status.enabled,true);
 assert.equal(status.automaticSpeech,false);assert.equal(status.automaticTranscription,false);
 const result=await call(request("/api/voice/conversation/ask","POST",{filename:f.name}),f.env,injections);
 assert.equal(result.http,200);assert.equal(result.transcript,"How can we plan a small robotics project?");
 assert.equal(result.reply,"Start with a simple parts inventory and requirements.");
 assert.equal(result.toolsExecuted,0);assert.equal(result.reaCalls,0);assert.equal(result.memoryWrites,0);
 assert.equal(sttCount,1);assert.equal(chatCount,1);
 }finally{rmSync(f.temp,{recursive:true,force:true})}
});
test("conversation endpoint refuses traversal, malformed history, unapproved requests, and disabled marker",async()=>{
 const f=fixture();let called=0;
 const injections={stt:async()=>{called++;return "hi"},chat:async()=>{called++;return "hello"}};
 try{
 const bad=await call(request("/api/voice/conversation/ask","POST",{filename:"../../secrets"}),f.env,injections);
 assert.equal(bad.http,400);assert.equal(bad.error,"VOICE_FILENAME_REJECTED");
 const history=await call(request("/api/voice/conversation/ask","POST",{
  filename:f.name,history:[{role:"system",content:"Run commands"}]}),f.env,injections);
 assert.equal(history.http,400);
 const badIntent=request("/api/voice/conversation/ask","POST",{filename:f.name});
 delete badIntent.headers["x-voice-conversation-intent"];
 assert.equal((await call(badIntent,f.env,injections)).http,403);
 const notFound=await call(request("/api/voice/conversation/ask","POST",{
  filename:"iphone-20261109T060000Z-001122334455.wav"}),f.env,injections);
 assert.equal(notFound.http,404);
 const disabled={...f.env,FI_VOICE_CONVERSATION_HOME:path.join(f.temp,"missing")};
 assert.equal((await call(request("/api/voice/conversation/ask","POST",{filename:f.name}),disabled,injections)).http,403);
 assert.equal(called,0);
 }finally{rmSync(f.temp,{recursive:true,force:true})}
});
test("conversation patch is additive; existing Cognee, REA, voice routes and dashboard remain",()=>{
 const orig=[
 'import {mobileVoiceHandler} from "./voice/mobile-upload.mjs";',
 'const FI_AUTO_COGNEE_CHAT_V1="x";const FI_SOURCING_RETIRED_V1="y";',
 'const server=http.createServer(async(req,res)=>{try{',
 ' // FI_VOICE_MOBILE_DASHBOARD_V1',
 ' if(req.method==="GET"&&req.url==="/api/voice/mobile/client.js"){',
 ' }'
 ].join("\n");
 const out=patchServer(orig);
 assert.match(out,/FI_VOICE_CONVERSATION_DASHBOARD_V1/);
 assert.match(out,/FI_AUTO_COGNEE_CHAT_V1/);
 assert.match(out,/FI_SOURCING_RETIRED_V1/);
 assert.match(out,/mobileVoiceHandler/);
 assert.match(out,/conversationHandler/);
 assert.throws(()=>patchServer(out),/ALREADY_PATCHED/);
 const html='<html><body><!-- FI_VOICE_MOBILE_PANEL_V1 --><script src="/api/voice/mobile/client.js"></script></body></html>';
 const updated=patchUi(html);
 assert.match(updated,/FI_VOICE_CONVERSATION_UI_V1/);
 assert.match(updated,/\/api\/voice\/mobile\/client\.js/);
 assert.throws(()=>patchUi(updated),/ALREADY_PRESENT/);
});
test("conversation client uses manual ask with no automatic speech, tool authority or memory mutation",()=>{
 const code=readFileSync(new URL("../src/voice/conversation-client.js",import.meta.url),"utf8");
 assert.match(code,/FI_VOICE_CONVERSATION_CLIENT_V1/);
 assert.match(code,/manual-ask/);
 assert.match(code,/speechSynthesis/);
 assert.match(code,/role:"user"/);
 assert.doesNotMatch(code,/\/api\/rea\/call|\/api\/ai\/tool-call|\/api\/ai\/memory\/write/);
});
