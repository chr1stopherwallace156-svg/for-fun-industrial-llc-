export function createAiAdapter(config){
 const base="http://127.0.0.1:"+config.port;
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
   try{return await request("/ai/runtime/llama-cpp/start","POST");}
   catch(error){return {state:"failed",detail:error.message};}
  },
  async stop(){try{return await request("/ai/runtime/llama-cpp/stop","POST");}catch(error){return {state:"unavailable",detail:error.message};}},
  async health(){
   if(!config.aiEnabled)return {state:"disabled",detail:"Local AI runtime disabled."};
   if(!config.aiConfigured)return {state:"not-configured",detail:"Local GGUF model and llama-server path have not been configured."};
   try{const status=await request("/ai/runtime/llama-cpp");return {...status,detail:status.state==="ready"?"Local GGUF model loaded and responding on loopback.":"Local model state: "+status.state};}
   catch(error){return {state:"unavailable",detail:error.message};}
  }
 };
}
