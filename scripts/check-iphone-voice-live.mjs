// Read-only / validate-only live probe. Never stores an audio recording.
// Uses a generated three-second synthetic tone, not a person's voice.
const base="http://127.0.0.1:8789";
async function check(){
 const statusRes=await fetch(base+"/api/voice/mobile/status",{signal:AbortSignal.timeout(12000)});
 const status=await statusRes.json();
 if(statusRes.status!==200||status.enabled!==true||status.automaticAnalysis!==false)
  throw Error("FI_VOICE_MOBILE_STATUS_HOLD HTTP="+statusRes.status);
 const n=16000*3, b=Buffer.alloc(44+n*2);
 b.write("RIFF",0);b.writeUInt32LE(b.length-8,4);b.write("WAVE",8);
 b.write("fmt ",12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);
 b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
 b.write("data",36);b.writeUInt32LE(2*n,40);
 for(let i=0;i<n;i++)b.writeInt16LE(Math.round(6500*Math.sin(2*Math.PI*185*i/16000)),44+2*i);
 const r=await fetch(base+"/api/voice/mobile/validate",{
  method:"POST",headers:{"content-type":"audio/wav","x-voice-upload-intent":"explicit-recording",
  "origin":base,"sec-fetch-site":"same-origin"},
  body:b,signal:AbortSignal.timeout(12000)
 });
 const data=await r.json();
 if(r.status!==200||data.state!=="validated_only"||data.writes!==0||data.reaToolsExecuted!==0)
  throw Error("FI_VOICE_MOBILE_WAV_VALIDATION_HOLD HTTP="+r.status+" RESPONSE="+JSON.stringify(data));
 const ui=await fetch(base+"/",{signal:AbortSignal.timeout(12000)}),text=await ui.text();
 if(ui.status!==200||!text.includes("FI_VOICE_MOBILE_PANEL_V1")||!text.includes("fi-voice-record"))
  throw Error("FI_VOICE_MOBILE_UI_HOLD");
 const client=await fetch(base+"/api/voice/mobile/client.js",{signal:AbortSignal.timeout(12000)});
 if(client.status!==200||!(await client.text()).includes("FI_VOICE_MOBILE_CLIENT_V1"))
  throw Error("FI_VOICE_MOBILE_CLIENT_HOLD");
 console.log("FI_VOICE_MOBILE_HTTP=PASS DASHBOARD=8789 WAV_VALIDATION=PASS WRITES=0 REA_TOOLS_EXECUTED=0");
 console.log("FI_VOICE_MOBILE_BROWSER=HTTPS_GATEWAY_REQUIRED_FOR_IPHONE MICROPHONE_ACTIVATION_NOT_TESTED");
}
try{await check()}catch(error){console.error("FI_VOICE_MOBILE_LIVE_HOLD="+String(error.message||error));process.exitCode=1}
