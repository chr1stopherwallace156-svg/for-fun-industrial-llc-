const bool=(value,fallback=false)=>value==null?fallback:value.toLowerCase()==="true";
const csv=(value,fallback)=>value==null?fallback:value.split(",").map(x=>x.trim()).filter(Boolean);
export function loadConfig(env=process.env) {
 const host=env.HOST||"127.0.0.1";
 if(!["127.0.0.1","::1","localhost"].includes(host)) throw new Error("HOST must remain loopback-only in this release.");
 const port=Number(env.PORT||8787);
 if(!Number.isInteger(port)||port<1||port>65535) throw new Error("PORT must be a valid TCP port.");
 return Object.freeze({host,port,rea:Object.freeze({enabled:bool(env.REA_ENABLED),command:env.REA_COMMAND||"rea",args:csv(env.REA_ARGS,["mcp"])}),netbird:Object.freeze({enabled:bool(env.NETBIRD_ENABLED),autoConnect:bool(env.NETBIRD_AUTOCONNECT),command:env.NETBIRD_COMMAND||"netbird"})});
}
