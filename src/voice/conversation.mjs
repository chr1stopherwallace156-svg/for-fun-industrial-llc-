// FI_VOICE_CONVERSATION_V1: explicit operator request from saved iPhone WAV.
// STT is offline CPU faster-whisper; response uses existing local llama.cpp via
// compute API. No REA calls, tool execution, Cognee writes, or cloud STT.
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {existsSync,lstatSync} from "node:fs";
import {readFile} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {validateVoiceWav,mobileVoicePaths,isVoiceMobileEnabled} from "./mobile-upload.mjs";

const run=promisify(execFile);
const FILE_RE=/^iphone-\d{8}T\d{6}Z-[0-9a-f]{12}\.wav$/;
const MARKER="FI_FUN_VOICE_CONVERSATION_ENABLED_V1\n";
const MAX_BODY=12000;
let busy=false;
export function conversationPaths(env=process.env){
 const home=path.resolve(env.FI_VOICE_CONVERSATION_HOME||path.join(env.LOCALAPPDATA||
   path.join(os.homedir(),"AppData","Local"),"FunIndustrial","VoiceConversation"));
 return {home,python:path.join(home,"venv","Scripts","python.exe"),
  marker:path.join(home,"conversation.enabled"),
  modelDir:path.join(home,"models"),
  transcriber:path.join(home,"transcribe.py")};
}
function enabled(env=process.env){
 try{
  const p=conversationPaths(env);
  return existsSync(p.marker)&&!lstatSync(p.marker).isSymbolicLink();
 }catch{return false}
}
async function actuallyEnabled(env=process.env){
 if(!enabled(env)||!isVoiceMobileEnabled(env))return false;
 try{
  const p=conversationPaths(env);
  return (await readFile(p.marker,"utf8"))===MARKER&&
   [p.python,p.transcriber,p.modelDir].every(f=>existsSync(f)&&!lstatSync(f).isSymbolicLink());
 }catch{return false}
}
function json(res,code,payload){
 res.writeHead(code,{"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store","x-content-type-options":"nosniff"});
 res.end(JSON.stringify(payload));return true;
}
function hold(res,code,value){return json(res,code,{error:value});}
function assertSavedName(name){
 return typeof name==="string"&&FILE_RE.test(name)&&name.length<100;
}
function sanitizeHistory(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>8)throw Error("VOICE_HISTORY_FORMAT_HOLD");
 const result=[];
 for(const turn of value){
  if(!turn||typeof turn!=="object"||Array.isArray(turn)||
   !["user","assistant"].includes(turn.role)||typeof turn.content!=="string"||
   !turn.content.trim()||turn.content.length>1500)
   throw Error("VOICE_HISTORY_FORMAT_HOLD");
  result.push({role:turn.role,content:turn.content});
 }
 return result;
}
async function readJson(req){
 let length=0;const chunks=[];
 for await(const chunk of req){
  length+=chunk.length;if(length>MAX_BODY)throw Error("VOICE_REQUEST_TOO_LARGE");
  chunks.push(chunk);
 }
 const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
 if(!body||typeof body!=="object"||Array.isArray(body))throw Error("VOICE_REQUEST_BAD_JSON");
 return body;
}
export async function conversationHandler(req,res,env=process.env,{
 stt=async(python,script,wav,modelDir)=>{
  const {stdout}=await run(python,[script,"transcribe",wav,modelDir],{
   cwd:path.dirname(script),windowsHide:true,timeout:85000,maxBuffer:120000,
   env:{...process.env,HF_HUB_OFFLINE:"1",HF_HUB_DISABLE_TELEMETRY:"1",HF_HUB_DISABLE_PROGRESS_BARS:"1"}});
  const data=JSON.parse(stdout);
  if(data.schema!=="fun.voice.transcription.v1"||typeof data.text!=="string")throw Error("VOICE_STT_RESPONSE_INVALID");
  return data.text;
 },
 chat=async(messages)=>{
  const result=await fetch("http://127.0.0.1:8791/ai/chat",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({messages,max_tokens:256,temperature:0.3,tools:[]}),
   signal:AbortSignal.timeout(85000)
  });
  if(!result.ok)throw Error("VOICE_LOCAL_AI_HTTP_"+result.status);
  const data=await result.json();
  if(typeof data.reply!=="string"||!data.reply.trim()||data.reply.length>10000)
   throw Error("VOICE_LOCAL_AI_REPLY_INVALID");
  if(Array.isArray(data.tool_calls)&&data.tool_calls.length)
   throw Error("VOICE_LOCAL_AI_TOOL_PROPOSAL_REJECTED");
  return data.reply.slice(0,2400);
 }}={}){
 const pathname=String(req.url||"").split("?")[0];
 if(!pathname.startsWith("/api/voice/conversation/"))return false;
 if(pathname==="/api/voice/conversation/status"&&req.method==="GET"){
  return json(res,200,{schema:"fun.voice.conversation.v1",
   enabled:await actuallyEnabled(env),stt:"faster-whisper-tiny.en-cpu-offline",
   ai:"existing-local-llama.cpp",toolsEnabled:false,reaCalls:0,
   memoryWrites:false,automaticTranscription:false,automaticSpeech:false,
   busy});
 }
 if(pathname!=="/api/voice/conversation/ask"||req.method!=="POST")
  return hold(res,405,"VOICE_CONVERSATION_METHOD_NOT_ALLOWED");
 if(!await actuallyEnabled(env))return hold(res,403,"VOICE_CONVERSATION_NOT_ENABLED");
 if(req.headers["x-voice-conversation-intent"]!=="manual-ask"||
  req.headers["content-type"]!=="application/json"||
  req.headers["sec-fetch-site"]==="cross-site"||
  !["127.0.0.1","::1"].includes(String(req.socket.remoteAddress||"").replace(/^::ffff:/,"")))
  return hold(res,403,"VOICE_CONVERSATION_OPERATOR_INTENT_REQUIRED");
 if(busy)return hold(res,429,"VOICE_CONVERSATION_BUSY");
 let body,history;
 try{
  body=await readJson(req);
  if(!assertSavedName(body.filename))throw Error("VOICE_FILENAME_REJECTED");
  history=sanitizeHistory(body.history);
 }catch(e){return hold(res,400,e.message==="VOICE_FILENAME_REJECTED"||
  e.message==="VOICE_HISTORY_FORMAT_HOLD"||e.message==="VOICE_REQUEST_TOO_LARGE"?
  e.message:"VOICE_REQUEST_BAD_JSON")}
 busy=true;
 try{
  const source=mobileVoicePaths(env).recordings;
  if(!existsSync(source)||lstatSync(source).isSymbolicLink())
   return hold(res,400,"VOICE_RECORDING_DIRECTORY_UNAVAILABLE");
  const audioFile=path.join(source,body.filename);
  if(!existsSync(audioFile)||lstatSync(audioFile).isSymbolicLink()||
    !lstatSync(audioFile).isFile())return hold(res,404,"VOICE_RECORDING_NOT_FOUND");
  const wav=await readFile(audioFile);
  validateVoiceWav(wav);
  const p=conversationPaths(env);
  const transcript=String(await stt(p.python,p.transcriber,audioFile,p.modelDir)).trim();
  if(transcript.length<2||transcript.length>1800)
   return hold(res,422,"VOICE_TRANSCRIPT_EMPTY_OR_OVERSIZED");
  // Whisper transcripts are not commands. Constrain history and do not supply
  // tool definitions, write access, or memory to the local AI.
  const messages=[...history,{role:"user",content:transcript}];
  const reply=await chat(messages);
  return json(res,200,{schema:"fun.voice.conversation.v1",
   transcript,reply,file:body.filename,model:"local-llama.cpp",
   transcription:"offline-faster-whisper-tiny.en",
   toolsExecuted:0,reaCalls:0,memoryWrites:0,automaticallySpoken:false});
 }catch(e){
  const message=String(e?.message||"UNKNOWN").slice(0,120);
  const code=message.startsWith("VOICE_UPLOAD_")?422:503;
  return hold(res,code,message.startsWith("VOICE_")?message:"VOICE_CONVERSATION_LOCAL_PIPELINE_FAILED");
 }finally{busy=false}
}
