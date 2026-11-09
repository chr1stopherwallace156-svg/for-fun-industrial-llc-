import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

function uiElement(id){
 const handlers={};
 return {id,handlers,disabled:false,value:"",textContent:"",style:{},
  addEventListener(name,fn){handlers[name]=fn},
  removeAttribute(){},load(){},src:"",
  files:[],};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test("Safari simulation captures PCM microphone frames, resamples to canonical WAV and uploads only after approval",async()=>{
 const source=readFileSync(new URL("../src/voice/mobile-client.js",import.meta.url),"utf8");
 assert.match(source,/FI_VOICE_MOBILE_CLIENT_V3_PCM_PLAYBACK/);
 const elements=new Map();
 const get=id=>elements.get(id)||elements.set(id,uiElement(id)).get(id);
 const root=get("fi-voice-mobile");
 let playButton=null;root.appendChild=element=>{playButton=element};
 const windowEvents={};
 let audioContext,now=10000,uploaded=null,uploadCalls=0,closed=0,mediaRecorderUsed=0;
 class FakeAudioContext{
  constructor(){this.sampleRate=48000;this.state="running";this.destination={};audioContext=this}
  createMediaStreamSource(stream){
   assert.equal(stream.name,"iPhone microphone");return {connect(){},disconnect(){}};
  }
  createScriptProcessor(size,inputs,outputs){
   assert.equal(size,4096);
   assert.equal(inputs,1);
   assert.equal(outputs,1);
   this.processor={connect(){},disconnect(){},onaudioprocess:null};
   return this.processor;
  }
  createBuffer(channels,frames,rate){assert.equal(channels,1);assert.equal(rate,16000);const data=new Float32Array(frames);return {getChannelData(){return data}}}
  createBufferSource(){const src={buffer:null,onended:null,connect(){},start(){src.started=true},stop(){if(src.onended)src.onended()}};this.previewSource=src;return src}
  async close(){closed++}
 }
 const stream={name:"iPhone microphone",getTracks(){return [{stop(){}}]}};
 const navigator={mediaDevices:{async getUserMedia(options){
  assert.equal(options.video,false);return stream;
 }}};
 const window={AudioContext:FakeAudioContext,isSecureContext:true,
  addEventListener(name,fn){windowEvents[name]=fn},
  MediaRecorder:class{constructor(){mediaRecorderUsed++}}};
 const document={getElementById:get,createElement(tag){assert.equal(tag,"button");return uiElement("play-wav")}};
 const location={protocol:"https:"};
 const url={createObjectURL:()=> "blob:demo",revokeObjectURL(){}};
 const fetch=async (route,options={})=>{
  if(route==="/api/voice/mobile/status")return {ok:true,status:200,async json(){return {enabled:true,code:"FI_VOICE_MOBILE_UPLOAD_V1"}}};
  if(route==="/api/voice/mobile/recordings")return {ok:true,status:200,async json(){return {recordings:[]}}};
  if(route==="/api/voice/mobile/upload"){
   uploaded=options.body;uploadCalls++;
   assert.equal(options.method,"POST");
   assert.equal(options.headers["x-voice-upload-intent"],"explicit-recording");
   assert.equal(options.headers["content-type"],"audio/wav");
   return {ok:true,status:201,async json(){return {file:"iphone-20261109T000000Z-001122334455.wav",
    windowsPath:"C:\\Users\\alxar\\AppData\\Local\\FunIndustrial\\VoiceLab\\recordings\\iphone-20261109T000000Z-001122334455.wav"}}};
  }
  throw Error("UNEXPECTED_NETWORK_REQUEST "+route);
 };
 const sandbox={document,window,navigator,location,URL:url,fetch,Blob,Float32Array,ArrayBuffer,DataView,
  Date:{now:()=>now},setTimeout:()=>50,clearTimeout(){},console};
 vm.runInNewContext(source,sandbox,{filename:"mobile-client.js",timeout:3000});
 for(let i=0;i<4;i++)await tick();
 assert.equal(get("fi-voice-record").disabled,false,"record enabled on trusted origin");
 await get("fi-voice-record").handlers.click();
 assert.ok(audioContext,"direct PCM AudioContext created");
 assert.equal(mediaRecorderUsed,0,"MediaRecorder not used when PCM is available");
 assert.equal(uploadCalls,0,"no automatic upload");
 const processor=audioContext.processor;
 assert.equal(typeof processor.onaudioprocess,"function");
 for(let j=0;j<42;j++){
  processor.onaudioprocess({
   inputBuffer:{getChannelData(){const data=new Float32Array(4096);
    for(let n=0;n<data.length;n++)data[n]=Math.sin((j*4096+n)*2*Math.PI*175/48000)*0.38;
    return data;}},
   outputBuffer:{numberOfChannels:1,getChannelData(){return new Float32Array(4096)}}
  });
 }
 now+=4000;
 get("fi-voice-stop").handlers.click();
 for(let i=0;i<8;i++)await tick();
 assert.match(get("fi-voice-action-status").textContent,/Ready \(direct PCM\)/);
 assert.equal(get("fi-voice-upload").disabled,false);
 assert.equal(get("fi-voice-preview").style.display,"none");
 assert.equal(playButton.textContent,"Play recorded speech");
 assert.equal(playButton.disabled,false);
 playButton.handlers.click();
 for(let i=0;i<8;i++)await tick();
 assert.equal(audioContext.previewSource?.started,true,"Web Audio playback started on gesture");
 assert.match(get("fi-voice-action-status").textContent,/Playing locally using Web Audio/);
 audioContext.previewSource.onended();
 assert.ok(closed>=1,"audio context closed");
 assert.equal(uploadCalls,0,"uploads still require explicit click");
 await get("fi-voice-upload").handlers.click();
 assert.equal(uploadCalls,1);
 const buf=Buffer.from(await uploaded.arrayBuffer());
 assert.equal(buf.toString("ascii",0,4),"RIFF");
 assert.equal(buf.toString("ascii",8,12),"WAVE");
 assert.equal(buf.readUInt32LE(4),buf.length-8);
 assert.equal(buf.readUInt16LE(22),1);
 assert.equal(buf.readUInt32LE(24),16000);
 assert.equal(buf.readUInt16LE(34),16);
 assert.equal(buf.readUInt32LE(40),buf.length-44);
 assert.ok(buf.length>2*16000*3);
 assert.ok(buf.length<960044);
 assert.match(get("fi-voice-action-status").textContent,/Saved on Windows/);
 assert.match(get("fi-voice-upload-result").textContent,/python\.exe/);
});
