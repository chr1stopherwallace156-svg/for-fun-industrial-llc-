// Read-only health plus intentionally invalid memory request: never calls Python or stores a note.
// No external network. Designed for Node 22+ Windows Fun Industrial deployment.
const base="http://127.0.0.1:8789";
const statuses=[];
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
