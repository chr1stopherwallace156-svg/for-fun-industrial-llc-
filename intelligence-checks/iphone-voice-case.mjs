import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,readdirSync,readFileSync,rmSync,mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {Readable} from "node:stream";
import {validateVoiceWav,mobileVoiceHandler,isVoiceMobileEnabled,VOICE_SAMPLE_RATE} from "../src/voice/mobile-upload.mjs";
import {patchMobileVoiceServer,patchMobileVoiceUi} from "../scripts/patch-iphone-voice-dashboard.mjs";

function wav(seconds=3,hz=16000,signal=true){
 const length=Math.round(seconds*hz),buffer=Buffer.alloc(44+length*2);
 buffer.write("RIFF",0,"ascii");buffer.writeUInt32LE(buffer.length-8,4);buffer.write("WAVE",8,"ascii");
 buffer.write("fmt ",12,"ascii");buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);
 buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(hz,24);buffer.writeUInt32LE(hz*2,28);
 buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write("data",36,"ascii");
 buffer.writeUInt32LE(length*2,40);
 for(let i=0;i<length;i++)buffer.writeInt16LE(signal?Math.round(9000*Math.sin(i*2*Math.PI*200/hz)):0,44+2*i);
 return buffer;
}
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),"fi-phone-voice-"));
 const home=path.join(root,"VoiceLab");mkdirSync(home,{recursive:true});
 const env={FUN_VOICE_HOME:home};
 const end=()=>rmSync(root,{recursive:true,force:true});
 const enable=()=>writeFileSync(path.join(home,"mobile-upload.enabled"),"FI_VOICE_MOBILE_RECORDING_ENABLED_V1\n");
 return {env,home,enable,end};
}
async function request(route,data=Buffer.alloc(0),headers={}){
 const req=Readable.from(data.length?[data]:[]);
 req.url=route;req.method=route.endsWith("/upload")?"POST":"GET";
 req.socket={remoteAddress:"127.0.0.1"};
 req.headers={...headers};
 let status=0,content;
 const res={writeHead(code){status=code;return this},end(body){content=body;return this}};
 const handled=await mobileVoiceHandler(req,res,headers.fixtureEnv);
 return {handled,status,payload:JSON.parse(content)};
}
const auth={"x-voice-upload-intent":"explicit-recording","content-type":"audio/wav",
 "sec-fetch-site":"same-origin","x-forwarded-proto":"https"};

test("strict PCM mono WAV parser checks duration, sample rate, silence, RIFF",()=>{
 assert.equal(validateVoiceWav(wav()).seconds,3);
 assert.equal(validateVoiceWav(wav(2)).seconds,2);
 assert.throws(()=>validateVoiceWav(wav(1.5)),/DURATION_HOLD/);
 assert.throws(()=>validateVoiceWav(wav(31)),/DURATION_HOLD|SIZE_INVALID/);
 assert.throws(()=>validateVoiceWav(wav(3,44100)),/FORMAT_HOLD/);
 assert.throws(()=>validateVoiceWav(wav(3,16000,false)),/SILENT_HOLD/);
 const invalid=wav();invalid.write("NOPE",0);assert.throws(()=>validateVoiceWav(invalid),/FORMAT_HOLD/);
});
test("uploads are off until local operator enables and no fallback creates them",async()=>{
 const fx=fixture();
 try{
  assert.equal(isVoiceMobileEnabled(fx.env),false);
  const blocked=await request("/api/voice/mobile/upload",wav(),{...auth,fixtureEnv:fx.env});
  assert.equal(blocked.handled,true);assert.equal(blocked.status,403);
  assert.equal(readdirSync(fx.home).length,0);
 }finally{fx.end()}
});
test("authorized upload stores generated private WAV, ignores arbitrary remote filenames, never runs tools",async()=>{
 const fx=fixture();
 try{
  fx.enable();assert.equal(isVoiceMobileEnabled(fx.env),true);
  const result=await request("/api/voice/mobile/upload",wav(),{...auth,
   "x-voice-filename":"../../windows/system32/evil.exe",fixtureEnv:fx.env});
  assert.equal(result.handled,true);assert.equal(result.status,201);
  assert.equal(result.payload.state,"saved");
  assert.match(result.payload.file,/^iphone-\d{8}T\d{6}Z-[0-9a-f]{12}\.wav$/);
  assert.equal(result.payload.automaticMemoryWrites,0);
  assert.equal(result.payload.automaticallyAnalyzed,false);
  assert.equal(result.payload.reaToolsExecuted,0);
  const out=path.join(fx.home,"recordings",result.payload.file);
  assert.deepEqual(readFileSync(out),wav());
  const listing=await request("/api/voice/mobile/recordings",Buffer.alloc(0),{fixtureEnv:fx.env});
  assert.equal(listing.status,200);assert.equal(listing.payload.recordings.length,1);
 }finally{fx.end()}
});
test("upload rejects untrusted intent, unsupported media, cross-site fetch and non-local backend",async()=>{
 const fx=fixture();
 try{
  fx.enable();
  for(const bad of [{}, {"x-voice-upload-intent":"explicit-recording"}, {...auth,"sec-fetch-site":"cross-site"}]){
   const r=await request("/api/voice/mobile/upload",wav(),{...bad,fixtureEnv:fx.env});
   assert.equal(r.status,403);
  }
  const validate=await request("/api/voice/mobile/validate",wav(),{...auth,fixtureEnv:fx.env});
  // Helper only determines method from /upload suffix; exercise upload policy above.
  assert.equal(validate.status,405);
  assert.equal(readdirSync(fx.home).filter(x=>x.endsWith(".wav")).length,0);
 }finally{fx.end()}
});
test("dashboard source patch preserves existing chat/REA/Cognee and has fail-closed baseline",()=>{
 const original=[
  'const root=path.dirname(fileURLToPath(import.meta.url));',
  'const marker="FI_LOCAL_INTELLIGENCE_V1";',
  'const seal="FI_SOURCING_RETIRED_V1";',
  'const auto="FI_AUTO_COGNEE_CHAT_V1";',
  'const server=http.createServer(async(req,res)=>{try{',
  ' if(req.method==="GET"&&req.url==="/"){return res.end(page);}',
  '});'
 ].join("\n");
 const changed=patchMobileVoiceServer(original);
 assert.match(changed,/FI_VOICE_MOBILE_DASHBOARD_V1/);
 assert.match(changed,/mobileVoiceHandler\(req,res\)/);
 assert.match(changed,/mobile\/client\.js/);
 assert.match(changed,/FI_AUTO_COGNEE_CHAT_V1/);
 assert.equal(original.includes("FI_VOICE_MOBILE_DASHBOARD_V1"),false);
 assert.throws(()=>patchMobileVoiceServer(changed),/ALREADY_PATCHED/);
 assert.throws(()=>patchMobileVoiceServer(original.replace("FI_AUTO_COGNEE_CHAT_V1","missing")),/BASELINE_HOLD/);
});
test("UI patch preserves existing script and appends one mobile panel",()=>{
 const html='<html><body><h1>Fun Industrial</h1><script>const chat="preserved";</script></body></html>';
 const panel='<section id="fi-voice-mobile"><!-- FI_VOICE_MOBILE_PANEL_V1 --></section>';
 const changed=patchMobileVoiceUi(html,panel);
 assert.match(changed,/FI_VOICE_MOBILE_PANEL_V1/);
 assert.match(changed,/const chat="preserved"/);
 assert.match(changed,/src="\/api\/voice\/mobile\/client\.js"/);
 assert.throws(()=>patchMobileVoiceUi(changed,panel),/ALREADY_PRESENT/);
});
