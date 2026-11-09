/* FI_VOICE_CONVERSATION_CLIENT_V1 — manual offline STT + existing local llama.cpp.
 * Existing Safari recording, playback and upload panel is left untouched.
 * Speech output is optional device-native TTS, never cloned voice.
 */
(()=>{
 "use strict";
 const parent=document.getElementById("fi-voice-mobile");
 if(!parent)return;
 const section=document.createElement("section");
 section.id="fi-voice-conversation";
 section.className="panel";
 section.innerHTML='<h2>Talk to Fun Industrial — local AI</h2>'+
  '<p class="muted">First record and upload a clip above. Then refresh this list and explicitly ask the local AI. Transcription stays on Windows; no REA calls or Cognee writes.</p>'+
  '<p id="fi-talk-status" class="muted small" aria-live="polite">Checking offline transcription…</p>'+
  '<label for="fi-talk-select">Saved iPhone recording</label>'+
  '<select id="fi-talk-select" style="display:block;width:100%;max-width:550px;margin:8px 0 12px;padding:10px;background:#0d1722;color:#eaf1f8;border:1px solid #40566c;border-radius:8px"></select>'+
  '<div class="actions"><button id="fi-talk-refresh" type="button" class="secondary">Refresh recordings</button>'+
  '<button id="fi-talk-ask" type="button" disabled>Ask Fun Industrial from recording</button>'+
  '<button id="fi-talk-speak" type="button" class="secondary" disabled>Speak AI answer</button>'+
  '<button id="fi-talk-clear" type="button" class="secondary">Clear conversation</button></div>'+
  '<h3>What you said</h3><pre id="fi-talk-transcript">Not transcribed yet.</pre>'+
  '<h3>Fun Industrial local AI reply</h3><pre id="fi-talk-reply">No reply yet.</pre>'+
  '<p class="muted small">English CPU transcription (tiny.en) is local and may mishear speech. Spoken replies use your iPhone operating system voice if available, not a copy of your voice. Always verify answers. The chat history in this panel stays in the open browser tab.</p>';
 parent.insertAdjacentElement("afterend",section);
 const el=id=>document.getElementById("fi-talk-"+id);
 const ui={status:el("status"),select:el("select"),refresh:el("refresh"),ask:el("ask"),
  speak:el("speak"),clear:el("clear"),transcript:el("transcript"),reply:el("reply")};
 let available=false,busy=false,history=[],latestReply="";
 const say=text=>{ui.status.textContent=String(text)};
 function control(){
  ui.ask.disabled=!available||busy||!ui.select.value;
  ui.refresh.disabled=busy;ui.select.disabled=busy;
  ui.speak.disabled=busy||!latestReply||!window.speechSynthesis;
 }
 async function getJson(url,options={}){
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});
  const raw=await response.text();let data={};
  try{data=JSON.parse(raw)}catch{}
  if(!response.ok)throw Error(data.error||"HTTP "+response.status);
  return data;
 }
 async function refresh(){
  if(busy)return;
  try{
   const status=await getJson("/api/voice/conversation/status");
   available=status.enabled===true;
   if(!available){say("Offline conversation is not activated on Windows.");control();return}
   const data=await getJson("/api/voice/mobile/recordings");
   const old=ui.select.value,items=Array.isArray(data.recordings)?data.recordings:[];
   ui.select.replaceChildren();
   for(const item of items){
    if(!/^iphone-\d{8}T\d{6}Z-[0-9a-f]{12}\.wav$/.test(item.filename))continue;
    const option=document.createElement("option");
    option.value=item.filename;option.textContent=item.filename;
    ui.select.appendChild(option);
   }
   if(old&&items.some(x=>x.filename===old))ui.select.value=old;
   say(items.length?"Offline English STT and llama.cpp ready. Choose a saved recording and tap Ask.":"Ready. Record and upload a clip above, then refresh.");
  }catch(e){available=false;say("VOICE_CONVERSATION_STATUS_HOLD: "+e.message)}
  control();
 }
 ui.ask.addEventListener("click",async()=>{
  if(!available||busy||!ui.select.value)return;
  busy=true;control();say("Transcribing on Windows, then asking the local llama.cpp model…");
  const selected=ui.select.value;
  try{
   const data=await getJson("/api/voice/conversation/ask",{
    method:"POST",headers:{"content-type":"application/json",
     "x-voice-conversation-intent":"manual-ask"},
    body:JSON.stringify({filename:selected,history:history.slice(-8)})});
   if(typeof data.transcript!=="string"||typeof data.reply!=="string")throw Error("Invalid local AI response");
   ui.transcript.textContent=data.transcript;
   ui.reply.textContent=data.reply;
   latestReply=data.reply;
   history.push({role:"user",content:data.transcript.slice(0,1500)},
    {role:"assistant",content:data.reply.slice(0,1500)});
   history=history.slice(-8);
   say("Local conversation complete · no tools executed · no memory writes · no automatic speech.");
  }catch(e){say("VOICE_CONVERSATION_HOLD: "+e.message)}
  finally{busy=false;control()}
 });
 ui.refresh.addEventListener("click",refresh);
 ui.select.addEventListener("change",control);
 ui.speak.addEventListener("click",()=>{
  if(!latestReply||!window.speechSynthesis||busy)return;
  const speech=window.speechSynthesis;
  speech.cancel();
  const text=latestReply.slice(0,1400);
  if(!window.SpeechSynthesisUtterance){say("iPhone spoken replies unavailable; read the text reply.");return}
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang="en-US";utterance.rate=1;
  speech.speak(utterance);
  say("Playing the AI response with iPhone speech synthesis. No voice cloning.");
 });
 ui.clear.addEventListener("click",()=>{
  history=[];latestReply="";ui.transcript.textContent="Not transcribed yet.";
  ui.reply.textContent="No reply yet.";
  if(window.speechSynthesis)window.speechSynthesis.cancel();
  say("Conversation cleared from this browser tab.");
  control();
 });
 refresh();
})();
