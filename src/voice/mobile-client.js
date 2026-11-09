/* FI_VOICE_MOBILE_CLIENT_V2_PCM_SAFARI — plain Web APIs, no external dependencies.
 * iOS Safari: getUserMedia -> MediaRecorder -> Web Audio decode/resample -> WAV.
 * Remote HTTPS access must pass the existing NetBird/TLS/authenticated gateway.
 */
(()=>{
 "use strict";
 const root=document.getElementById("fi-voice-mobile");
 if(!root)return;
 const el=id=>document.getElementById("fi-voice-"+id);
 const ui={state:el("mobile-status"),action:el("action-status"),record:el("record"),
  stop:el("stop"),upload:el("upload"),refresh:el("refresh"),
  file:el("file"),preview:el("preview"),result:el("upload-result"),
  recordings:el("saved-recordings")};
 const URI="/api/voice/mobile/";
 let stream=null,recorder=null,pieces=[],timer=null,objectUrl=null;
 let pcmSession=null;
 let readyWav=null,working=false,enabled=false;
 let elapsedAt=0;
 function report(msg){ui.action.textContent=String(msg)}
 function setButtons(){
  const recording=!!recorder||!!pcmSession;
  ui.record.disabled=working||!enabled||recording||!navigator.mediaDevices?.getUserMedia||!window.isSecureContext;
  ui.stop.disabled=working||!recording;
  ui.upload.disabled=working||!enabled||!readyWav||recording;
  ui.file.disabled=working||!enabled||recording;
 }
 function cleanupMic(){
  if(timer){clearTimeout(timer);timer=null}
  if(stream){for(const track of stream.getTracks())track.stop();stream=null}
  recorder=null;setButtons();
 }
 function resetAudio(){
  readyWav=null;
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null}
  ui.preview.style.display="none";ui.preview.removeAttribute("src");ui.preview.load();
  setButtons();
 }
 function showPreview(blob){
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(blob);
  ui.preview.src=objectUrl;ui.preview.style.display="block";
 }
 function writeAscii(view,offset,value){
  for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));
 }
 function encodePcm16(samples,sampleRate=16000){
  if(sampleRate!==16000)throw Error("Expected 16-kHz sample rate");
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  writeAscii(view,0,"RIFF");view.setUint32(4,buffer.byteLength-8,true);
  writeAscii(view,8,"WAVE");writeAscii(view,12,"fmt ");
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  writeAscii(view,36,"data");view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){
   const value=Math.max(-1,Math.min(1,samples[i]));
   view.setInt16(44+2*i,value<0?Math.round(value*32768):Math.round(value*32767),true);
  }
  return buffer;
 }
 // Capture directly from iPhone microphone samples, bypassing MediaRecorder
 // fragmented MP4, short timeslices and Safari decodeAudioData failures.
 function pcmToMono16(chunks,rate,maxSec=30){
  const frames=chunks.reduce((n,c)=>n+c.length,0);
  if(!Number.isFinite(rate)||rate<8000||rate>192000)throw Error("Unsupported microphone sample rate: "+rate);
  const seconds=frames/rate;
  if(seconds<2)throw Error("Audio capture was too short ("+seconds.toFixed(2)+"s); record at least 3 seconds.");
  const limit=Math.min(frames,Math.floor(maxSec*rate));
  const input=new Float32Array(limit);let pos=0;
  for(const chunk of chunks){
   if(pos>=limit)break;
   const count=Math.min(limit-pos,chunk.length);
   input.set(chunk.subarray(0,count),pos);pos+=count;
  }
  // Weighted interval averaging for common 44.1/48-kHz microphone rates.
  const destRate=16000,outputFrames=Math.floor(limit*destRate/rate);
  if(outputFrames<32000||outputFrames>480000)throw Error("PCM recording duration outside 2–30 seconds");
  const result=new Float32Array(outputFrames);
  for(let j=0;j<outputFrames;j++){
   const start=j*rate/destRate,end=(j+1)*rate/destRate;
   const left=Math.floor(start),right=Math.min(limit,Math.ceil(end));
   let sum=0,weights=0;
   for(let k=left;k<right;k++){
    const w=Math.min(end,k+1)-Math.max(start,k);
    if(w>0){sum+=input[k]*w;weights+=w}
   }
   result[j]=weights>0?sum/weights:0;
  }
  return new Blob([encodePcm16(result)],{type:"audio/wav"});
 }
 async function acceptPreparedWav(wav,method){
  working=true;setButtons();
  try{
   if(wav.size<64044||wav.size>960044)throw Error("Prepared WAV duration out of range");
   readyWav=wav;showPreview(wav);
   report("Ready ("+method+"): "+((wav.size-44)/32000).toFixed(1)+" seconds. Tap Upload prepared audio.");
  }catch(e){
   resetAudio();report("PCM preparation failed: "+(e?.name||"Error")+": "+(e?.message||e));
  }finally{working=false;setButtons()}
 }
 async function stopPcmCapture(){
  const session=pcmSession;
  if(!session)return;
  pcmSession=null;
  working=true;
  if(timer){clearTimeout(timer);timer=null}
  try{
   if(session.processor){session.processor.onaudioprocess=null;session.processor.disconnect()}
   if(session.source)session.source.disconnect();
   if(stream){for(const track of stream.getTracks())track.stop();stream=null}
   const wav=pcmToMono16(session.chunks,session.sampleRate);
   if(session.context)try{await session.context.close()}catch{}
   await acceptPreparedWav(wav,"direct PCM");
  }catch(e){
   if(session.context)try{await session.context.close()}catch{}
   resetAudio();
   report("VOICE_PCM_CAPTURE_HOLD: "+(e?.name||"Error")+": "+(e?.message||e));
  }finally{working=false;setButtons()}
 }
 async function startPcmCapture(){
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return false;
  const ctx=new Audio();
  if(typeof ctx.createScriptProcessor!=="function"){
   try{await ctx.close()}catch{}
   return false;
  }
  try{
   if(ctx.state==="suspended"&&ctx.resume)await ctx.resume();
   const source=ctx.createMediaStreamSource(stream);
   const processor=ctx.createScriptProcessor(4096,1,1);
   const chunks=[];
   const session={context:ctx,source,processor,chunks,sampleRate:ctx.sampleRate,frames:0};
   processor.onaudioprocess=e=>{
    if(pcmSession!==session)return;
    const data=e.inputBuffer.getChannelData(0);
    if(session.frames<session.sampleRate*30){
     const remaining=Math.ceil(session.sampleRate*30-session.frames);
     const chunk=new Float32Array(data.subarray(0,remaining));
     chunks.push(chunk);session.frames+=chunk.length;
    }
    // Connected output stays silent: no microphone feedback or playback.
    if(e.outputBuffer){for(let c=0;c<e.outputBuffer.numberOfChannels;c++)
     e.outputBuffer.getChannelData(c).fill(0)}
   };
   pcmSession=session;source.connect(processor);processor.connect(ctx.destination);
   elapsedAt=Date.now();
   timer=setTimeout(()=>{if(pcmSession===session)void stopPcmCapture()},30000);
   report("Recording iPhone microphone (direct PCM). Speak for 3–30 seconds, then tap Stop.");
   setButtons();return true;
  }catch(e){
   if(pcmSession?.context===ctx)pcmSession=null;
   try{await ctx.close()}catch{}
   throw e;
  }
 }

 async function makeWav(file){
  if(!file||file.size===0||file.size>25*1024*1024)throw Error("Audio file must be between 1 byte and 25 MiB");
  const ac=window.AudioContext||window.webkitAudioContext;
  const oc=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!ac||!oc)throw Error("Safari Web Audio decoding is unavailable");
  let context;
  try{
   context=new ac();
   const data=await file.arrayBuffer();
   // decodeAudioData accepts compressed AAC/M4A and WAV as supported by this browser.
   const decoded=await context.decodeAudioData(data);
   if(decoded.duration<2||decoded.duration>30)throw Error("Record between 2 and 30 seconds.");
   const sampleCount=Math.round(decoded.duration*16000);
   if(sampleCount<32000||sampleCount>480000)throw Error("Recording duration outside 2–30 second range");
   const render=new oc(1,sampleCount,16000);
   const source=render.createBufferSource();source.buffer=decoded;
   source.connect(render.destination);source.start(0);
   const output=await render.startRendering();
   return new Blob([encodePcm16(output.getChannelData(0))],{type:"audio/wav"});
  }finally{if(context)try{await context.close()}catch{}}
 }
 async function acceptAudio(blob,label){
  working=true;setButtons();report("Preparing local 16-kHz WAV: "+label+"…");
  try{
   const wav=await makeWav(blob);
   readyWav=wav;showPreview(wav);
   report("Ready: "+Math.round((wav.size-44)/32000*10)/10+" seconds. Tap Upload prepared audio to transfer to Windows.");
  }catch(e){resetAudio();report("Audio preparation failed: "+(e?.message||e))}
  finally{working=false;setButtons()}
 }
 async function getJson(url,options={}){
  const r=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||("HTTP "+r.status));
  return data;
 }
 async function reloadList(){
  try{
   const data=await getJson(URI+"recordings");
   const rows=data.recordings||[];
   ui.recordings.textContent=rows.length
    ?rows.map(x=>x.filename+" · "+Math.round(x.bytes/1024)+" KiB").join("\n")
    :"No iPhone recordings on this PC yet.";
   ui.recordings.style.whiteSpace="pre-wrap";
  }catch(e){ui.recordings.textContent="Recordings unavailable: "+e.message}
 }
 async function refresh(){
  try{
   const data=await getJson(URI+"status");
   enabled=data.enabled===true;
   if(!enabled)ui.state.textContent="Mobile voice upload is disabled on Windows. An operator must enable it locally.";
   else if(!window.isSecureContext)ui.state.textContent="Secure HTTPS is required for Safari microphone access. Open this dashboard through the authenticated NetBird HTTPS gateway.";
   else ui.state.textContent="Private voice upload enabled · 2–30 seconds · "+(location.protocol==="https:"?"HTTPS":"Local trusted context")+" · no automatic analysis.";
   if(enabled)await reloadList();else ui.recordings.textContent="Mobile upload disabled.";
  }catch(e){
   enabled=false;ui.state.textContent="Voice endpoint unavailable: "+e.message;
  }finally{setButtons()}
 }
 ui.record.addEventListener("click",async()=>{
  if(!enabled||working||recorder||pcmSession)return;
  resetAudio();
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   // First choice: Web Audio direct PCM, no Safari MP4 encode/decode roundtrip.
   if(await startPcmCapture())return;
   pieces=[];
   const formats=["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"];
   const chosen=formats.find(t=>window.MediaRecorder?.isTypeSupported?.(t));
   if(!window.MediaRecorder)throw Error("MediaRecorder is not supported by this Safari version.");
   recorder=new MediaRecorder(stream,chosen?{mimeType:chosen}:{});
   elapsedAt=Date.now();
   recorder.addEventListener("dataavailable",e=>{if(e.data?.size)pieces.push(e.data)});
   recorder.addEventListener("error",e=>{report("VOICE_MEDIARECORDER_HOLD: "+(e?.error?.name||e?.error?.message||"Unknown recording error")+". Try choosing a file instead.");cleanupMic()});
   recorder.addEventListener("stop",async()=>{
    const result=new Blob(pieces,{type:recorder?.mimeType||chosen||"audio/mp4"});
    cleanupMic();
    if(result.size>0)await acceptAudio(result,"microphone recording");
    else report("Recording contained no usable audio.");
   },{once:true});
   // One complete Blob on stop avoids Safari short-timeslice errors.
   recorder.start();
   timer=setTimeout(()=>{if(recorder?.state==="recording")recorder.stop()},30000);
   report("Recording with iPhone microphone. Speak for 2–30 seconds, then tap Stop recording.");
  }catch(e){
   cleanupMic();report("Microphone unavailable: "+(e?.message||e)+". Check Safari permissions and HTTPS.");
  }
  setButtons();
 });
 ui.stop.addEventListener("click",()=>{
  if(pcmSession){
   if(Date.now()-elapsedAt<2000){report("Record at least 3 seconds before stopping.");return}
   ui.stop.disabled=true;report("Preparing direct PCM audio…");
   void stopPcmCapture();return;
  }
  if(!recorder||recorder.state!=="recording")return;
  if(Date.now()-elapsedAt<2000){report("Record for at least 3 seconds before stopping.");return}
  ui.stop.disabled=true;recorder.stop();report("Processing MediaRecorder fallback…");
 });
 ui.file.addEventListener("change",async()=>{
  const chosen=ui.file.files?.[0];
  if(!chosen)return;
  resetAudio();await acceptAudio(chosen,chosen.name||"selected audio");
 });
 ui.upload.addEventListener("click",async()=>{
  if(!readyWav||!enabled||working)return;
  working=true;setButtons();report("Uploading the prepared WAV to your Windows Voice Lab…");
  try{
   const data=await getJson(URI+"upload",{
    method:"POST",headers:{"content-type":"audio/wav","x-voice-upload-intent":"explicit-recording"},
    body:readyWav
   });
   report("Saved on Windows: "+data.file+". No analysis or model operation was started.");
   const command='$vp=Join-Path $env:LOCALAPPDATA \'FunIndustrial\\VoiceLab\\venv\\Scripts\\python.exe\';$src=Join-Path $env:USERPROFILE \'FunIndustrial-VoiceLab-Source\';Push-Location $src;try{& $vp -m voice_lab analyze "'+data.windowsPath+'"}finally{Pop-Location}';
   ui.result.textContent="Voice file: "+data.windowsPath+"\nWindows PowerShell analysis command:\n"+command;
   await reloadList();
  }catch(e){report("Upload failed: "+(e?.message||e))}
  finally{working=false;setButtons()}
 });
 ui.refresh.addEventListener("click",refresh);
 window.addEventListener("pagehide",()=>{
  if(pcmSession){
   const active=pcmSession;pcmSession=null;
   try{active.processor.onaudioprocess=null;active.processor.disconnect();active.source.disconnect();active.context.close()}catch{}
  }
  if(recorder&&recorder.state==="recording")recorder.stop();
  cleanupMic();if(objectUrl)URL.revokeObjectURL(objectUrl);
 },{once:true});
 refresh();
})();
