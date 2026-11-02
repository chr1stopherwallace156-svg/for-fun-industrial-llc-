import path from "node:path";
const bool=(value,fallback=false)=>value==null?fallback:value.toLowerCase()==="true";
const csv=(value,fallback)=>value==null?fallback:value.split(",").map(x=>x.trim()).filter(Boolean);
export function loadConfig(env=process.env){
 const host=env.HOST||"127.0.0.1";
 if(!["127.0.0.1","::1","localhost"].includes(host))throw new Error("HOST must remain loopback-only in this release.");
 const port=Number(env.PORT||8787),computePort=Number(env.COMPUTE_PORT||8790);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error("PORT must be a valid TCP port.");
 if(!Number.isInteger(computePort)||computePort<1||computePort>65535||computePort===port)throw new Error("COMPUTE_PORT must be a distinct valid TCP port.");
 return Object.freeze({host,port,cwd:env.APP_ROOT||process.cwd(),rea:Object.freeze({enabled:bool(env.REA_ENABLED),command:env.REA_COMMAND||"rea",args:csv(env.REA_ARGS,["mcp"])}),netbird:Object.freeze({enabled:bool(env.NETBIRD_ENABLED),autoConnect:bool(env.NETBIRD_AUTOCONNECT),command:env.NETBIRD_COMMAND||"netbird"}),compute:Object.freeze({enabled:bool(env.COMPUTE_ENABLED,false),python:env.COMPUTE_COMMAND||"python",port:computePort,cwd:env.APP_ROOT||process.cwd()})});
}
