// Default: HTTP health + intentionally invalid memory request; never starts Python or stores data.
// --recall-original-note: opt-in read of Cognee memory (starts Python and may download local models).
// Uses only the existing loopback service. Designed for Node 22+ on Windows.
const base="http://127.0.0.1:8789";
async function request(path,options={}){
 const res=await fetch(base+path,{...options,signal:AbortSignal.timeout(15000)});
 const body=await res.text();
 let parsed;try{parsed=JSON.parse(body)}catch{parsed=null}
 return {status:res.status,body:body.slice(0,900),parsed};
}
const health=await request("/api/intelligence/status");
console.log("INTELLIGENCE_HTTP="+health.status);
if(health.parsed?.memory){
 const m=health.parsed.memory;
 console.log("MEMORY_AVAILABLE="+m.available+" ENABLED="+m.enabled+" WRITES_ENABLED="+m.writesEnabled+" AUTOMATIC_INGESTION="+m.automaticIngestion);
}
if(health.status!==200){console.log("INTELLIGENCE_STATUS_BODY="+health.body);process.exitCode=2}
const invalid=await request("/api/intelligence/memory/remember",{
 method:"POST",headers:{"content-type":"application/json"},
 body:JSON.stringify({diagnostic_only:true})
});
console.log("INVALID_MEMORY_PAYLOAD_HTTP="+invalid.status);
console.log("INVALID_MEMORY_PAYLOAD_RESPONSE="+invalid.body);
console.log("INVALID_PAYLOAD_NOTE=NO_MEMORY_TEXT_SENT_NO_PYTHON_STARTED");
if(invalid.status!==400||invalid.parsed?.error!=="COGNEE_INPUT_INVALID"){
 console.log("MEMORY_ERROR_SERIALIZATION=UNEXPECTED");
 process.exitCode=3;
}else console.log("MEMORY_ERROR_SERIALIZATION=PASS");

// Opt-in diagnostic; calls recall only. It does NOT call remember or REA.
// Cognee recall may create local model caches/download weights on first use.
if(process.argv.includes("--recall-original-note")){
 const m=health.parsed?.memory;
 if(health.status!==200||m?.enabled!==true)throw Error("COGNEE_STATUS_NOT_READY");
 const query="Fun Industrial requires operator approval before executing external tools.";
 console.log("COGNEE_RECALL_DIAGNOSTIC=START MEMORY_WRITE=NO EXTERNAL_TOOLS=NO");
 console.log("FIRST_RECALL_MAY_DOWNLOAD_LOCAL_MODEL_WEIGHTS=TRUE");
 const response=await fetch(base+"/api/intelligence/memory/recall",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({query}),signal:AbortSignal.timeout(280000)
 });
 const body=await response.text();
 console.log("COGNEE_RECALL_HTTP="+response.status);
 console.log("COGNEE_RECALL_RESPONSE="+body.slice(0,4500));
 if(response.ok){
  console.log("COGNEE_RECALL_API=PASS");
 }else{
  console.log("COGNEE_RECALL_API=HOLD HTTP="+response.status);
  process.exitCode=4;
 }
}

