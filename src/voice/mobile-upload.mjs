// Fun Industrial iPhone → Windows VoiceLab upload bridge.
// No external listener, no model, no transcription, no Cognee writes, no REA.
// The Node control plane is accessible remotely ONLY via its existing authenticated
// HTTPS/NetBird gateway, which rewrites Host and validates Origin before proxying.
import {randomBytes} from "node:crypto";
import {existsSync,lstatSync} from "node:fs";
import {mkdir,readdir,readFile,writeFile,stat} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const VOICE_MOBILE_VERSION="fun.voice.mobile.v1";
export const VOICE_SAMPLE_RATE=16000;
export const VOICE_MAX_SECONDS=30;
export const VOICE_MIN_SECONDS=2;
export const VOICE_MAX_BYTES=1_100_000;
const ENABLED_MARKER="FI_VOICE_MOBILE_RECORDING_ENABLED_V1\n";
const NAME_RE=/^iphone-\d{8}T\d{6}Z-[0-9a-f]{12}\.wav$/;

export function mobileVoiceHome(env=process.env){
 const root=env.FUN_VOICE_HOME||path.join(env.LOCALAPPDATA||path.join(os.homedir(),"AppData","Local"),"FunIndustrial","VoiceLab");
 return path.resolve(root);
}
export function mobileVoicePaths(env=process.env){
 const home=mobileVoiceHome(env);
 return {home,recordings:path.join(home,"recordings"),flag:path.join(home,"mobile-upload.enabled")};
}
export function isVoiceMobileEnabled(env=process.env){
 const {flag,home,recordings}=mobileVoicePaths(env);
 try{
  for(const d of [home,recordings])if(existsSync(d)&&lstatSync(d).isSymbolicLink())return false;
  if(lstatSync(flag).isSymbolicLink())return false;
  return requireMarker(flag);
 }catch{return false;}
}
function requireMarker(flag){
 // Only an explicit local operator deployment enables mobile upload.
 const data=requireMarker.read?requireMarker.read(flag):null;
 return data===ENABLED_MARKER;
}
// Synchronous read is isolated in this configurable getter for deterministic tests.
import {readFileSync} from "node:fs";
requireMarker.read=flag=>readFileSync(flag,"utf8");

function json(res,code,payload){
 res.writeHead(code,{"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store","x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"});
 res.end(JSON.stringify(payload));
}
function error(res,code,value){json(res,code,{error:value})}
export function validateVoiceWav(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length<44||buffer.length>VOICE_MAX_BYTES)
  throw Error("VOICE_UPLOAD_SIZE_INVALID");
 if(buffer.toString("ascii",0,4)!=="RIFF"||
    buffer.toString("ascii",8,12)!=="WAVE"||
    buffer.readUInt32LE(4)!==buffer.length-8||
    buffer.toString("ascii",12,16)!=="fmt "||
    buffer.readUInt32LE(16)!==16||
    buffer.readUInt16LE(20)!==1||
    buffer.readUInt16LE(22)!==1||
    buffer.readUInt32LE(24)!==VOICE_SAMPLE_RATE||
    buffer.readUInt32LE(28)!==VOICE_SAMPLE_RATE*2||
    buffer.readUInt16LE(32)!==2||
    buffer.readUInt16LE(34)!==16||
    buffer.toString("ascii",36,40)!=="data"||
    buffer.readUInt32LE(40)!==buffer.length-44)
  throw Error("VOICE_UPLOAD_FORMAT_HOLD_PCM16_MONO_16000_WAV_ONLY");
 const samples=(buffer.length-44)/2;
 if(samples<VOICE_SAMPLE_RATE*VOICE_MIN_SECONDS||samples>VOICE_SAMPLE_RATE*VOICE_MAX_SECONDS)
  throw Error("VOICE_UPLOAD_DURATION_HOLD");
 // Basic silence rejection; no identity or speech recognition inference.
 let nonzero=0;
 for(let i=44;i<buffer.length;i+=2)if(Math.abs(buffer.readInt16LE(i))>75)nonzero++;
 if(nonzero<samples*0.002)throw Error("VOICE_UPLOAD_SILENT_HOLD");
 return {seconds:Number((samples/VOICE_SAMPLE_RATE).toFixed(3)),sampleCount:samples,bytes:buffer.length};
}
async function readLimited(req,maximum=VOICE_MAX_BYTES){
 const length=Number(req.headers["content-length"]);
 if(req.headers["content-length"]!==undefined&&(!Number.isSafeInteger(length)||length<44||length>maximum))
  throw Error("VOICE_UPLOAD_SIZE_INVALID");
 let total=0;
 const chunks=[];
 for await(const part of req){
  total+=part.length;
  if(total>maximum)throw Error("VOICE_UPLOAD_TOO_LARGE");
  chunks.push(part);
 }
 return Buffer.concat(chunks,total);
}
function allowedIntent(req){
 const intent=req.headers["x-voice-upload-intent"];
 const site=req.headers["sec-fetch-site"];
 if(intent!=="explicit-recording"||site==="cross-site")return false;
 if(req.headers["content-type"]!=="audio/wav")return false;
 // Only a loopback backend connection (local operator or authenticated HTTPS gateway).
 const ip=String(req.socket.remoteAddress||"").replace(/^::ffff:/,"");
 if(!["127.0.0.1","::1"].includes(ip))return false;
 return true;
}
const counts=new Map();
function rateLimit(key,now=Date.now()){
 let slot=counts.get(key);
 if(!slot||now-slot.start>60000)slot={start:now,count:0};
 slot.count++;counts.set(key,slot);
 // Cleanup bounded map; only one local/gateway source IP normally.
 if(counts.size>100){counts.clear();counts.set(key,slot)}
 return slot.count<=12;
}
function safeFilename(date=new Date()){
 const stamp=date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
 return "iphone-"+stamp+"-"+randomBytes(6).toString("hex")+".wav";
}
async function listSaved(env=process.env){
 const dir=mobileVoicePaths(env).recordings;
 if(!existsSync(dir)||lstatSync(dir).isSymbolicLink())return [];
 const names=(await readdir(dir)).filter(name=>NAME_RE.test(name)).sort().reverse().slice(0,15);
 const output=[];
 for(const name of names){
  try{
   const info=await stat(path.join(dir,name));
   if(info.isFile())output.push({filename:name,bytes:info.size});
  }catch{}
 }
 return output;
}
export async function mobileVoiceHandler(req,res,env=process.env){
 const pathname=String(req.url||"").split("?")[0];
 if(!pathname.startsWith("/api/voice/mobile/"))return false;
 const enabled=isVoiceMobileEnabled(env);
 if(pathname==="/api/voice/mobile/status"&&req.method==="GET"){
  const opts=mobileVoicePaths(env);
  return json(res,200,{schema:VOICE_MOBILE_VERSION,enabled,
   sampleRate:VOICE_SAMPLE_RATE,minSeconds:VOICE_MIN_SECONDS,maxSeconds:VOICE_MAX_SECONDS,
   maxBytes:VOICE_MAX_BYTES,savedDirectory:enabled?opts.recordings:null,
   microphoneRequiresTrustedHttps:true,
   gatewayHttpsRequest:req.headers["x-forwarded-proto"]==="https",
   automaticAnalysis:false,automaticMemoryWrites:false,reaToolsExecuted:0,
   code:"FI_VOICE_MOBILE_UPLOAD_V1"});
 }
 if(!enabled){error(res,403,"VOICE_MOBILE_UPLOAD_DISABLED");return true;}
 if(pathname==="/api/voice/mobile/recordings"&&req.method==="GET"){
  return json(res,200,{schema:VOICE_MOBILE_VERSION,recordings:await listSaved(env)});
 }
 if((pathname==="/api/voice/mobile/upload"||pathname==="/api/voice/mobile/validate")&&req.method==="POST"){
  if(!allowedIntent(req)){error(res,403,"VOICE_UPLOAD_ORIGIN_OR_MEDIA_POLICY_HOLD");return true;}
  if(!rateLimit(String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"local"))){
   error(res,429,"VOICE_UPLOAD_RATE_LIMIT");return true;
  }
  let wav,info;
  try{wav=await readLimited(req);info=validateVoiceWav(wav)}
  catch(e){error(res,400,String(e?.message||"VOICE_UPLOAD_INVALID"));return true;}
  if(pathname.endsWith("/validate")){
   return json(res,200,{state:"validated_only",...info,writes:0,reaToolsExecuted:0});
  }
  const opts=mobileVoicePaths(env);
  try{
   await mkdir(opts.recordings,{recursive:true});
   if(lstatSync(opts.recordings).isSymbolicLink())throw Error("VOICE_RECORDINGS_SYMLINK_DENIED");
   const name=safeFilename();
   const target=path.join(opts.recordings,name);
   // Never accept a user-supplied filename, directory, speaker identity or command.
   await writeFile(target,wav,{flag:"wx",mode:0o600});
   return json(res,201,{state:"saved",file:name,windowsPath:target,
    ...info,speechRecognized:false,synthesisAuthorized:false,
    automaticallyAnalyzed:false,automaticMemoryWrites:0,reaToolsExecuted:0});
  }catch(e){error(res,503,"VOICE_STORAGE_UNAVAILABLE");return true;}
 }
 error(res,405,"VOICE_MOBILE_METHOD_NOT_ALLOWED");
 return true;
}
