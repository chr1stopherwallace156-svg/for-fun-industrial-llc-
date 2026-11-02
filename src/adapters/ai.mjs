export function createAiAdapter(config){
 const base="http://127.0.0.1:"+config.port;let managed=false;
 async function request(path,method="GET"){
  const response=await fetch(base+path,{method,signal:AbortSignal.timeout(method==="POST"?130000:3000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.detail||data.error||("AI runtime HTTP "+response.status));
  return data;
 }
 return {id:"ai",name:"Local AI / llama.cpp",
  async start(){
   if(!config.aiEnabled)return {state:"disabled",detail:"Local AI runtime disabled by configuration."};
   if(!config.aiConfigured)return {state:"not-configured",detail:"Set LLAMA_CPP_SERVER and LLAMA_CPP_MODEL with Configure-LocalModel.ps1."};
   if(!config.aiAutoStart)return this.health();
   try{const current=await this.health();if(current.state==="ready")return current;const result=await request("/ai/runtime/llama-cpp/start","POST");managed=result.state==="ready"||result.state==="process-started";return result;}
   catch(error){return {state:"failed",detail:error.message};}
  },
  async stop(){if(!managed)return {state:"not-managed",detail:"Local model was not started by this controller; any pre-existing runtime was left untouched."};try{const result=await request("/ai/runtime/llama-cpp/stop","POST");managed=false;return result;}catch(error){return {state:"unavailable",detail:error.message};}},
  async health(){
   if(!config.aiEnabled)return {state:"disabled",detail:"Local AI runtime disabled."};
   if(!config.aiConfigured)return {state:"not-configured",detail:"Local GGUF model and llama-server path have not been configured."};
   try{const status=await request("/ai/runtime/llama-cpp");return {...status,detail:status.state==="ready"?"Local GGUF model loaded and responding on loopback.":"Local model state: "+status.state};}
   catch(error){return {state:"unavailable",detail:error.message};}
  }
 };
}
