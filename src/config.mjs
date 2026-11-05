import path from "node:path";
const bool=(value,fallback=false)=>value==null?fallback:value.toLowerCase()==="true";
const csv=(value,fallback)=>value==null?fallback:value.split(",").map(x=>x.trim()).filter(Boolean);
export function loadConfig(env=process.env){
 const host=env.HOST||"127.0.0.1";
 if(!["127.0.0.1","::1","localhost"].includes(host))throw new Error("HOST must remain loopback-only in this release.");
 const exitNodeRole=(env.NETBIRD_EXIT_NODE_ROLE||"consumer").toLowerCase();
 if(!["provider","consumer"].includes(exitNodeRole))throw new Error("NETBIRD_EXIT_NODE_ROLE must be provider or consumer.");
 const localFirstMode=bool(env.LOCAL_FIRST_MODE,true);
 const providerConfigConfirmed=bool(env.NETBIRD_PROVIDER_CONFIG_CONFIRMED,false);
 const iphoneRouteVerified=bool(env.NETBIRD_IPHONE_ROUTE_VERIFIED,false);
 const port=Number(env.PORT||8787),computePort=Number(env.COMPUTE_PORT||8790);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error("PORT must be a valid TCP port.");
 if(!Number.isInteger(computePort)||computePort<1||computePort>65535||computePort===port)throw new Error("COMPUTE_PORT must be a distinct valid TCP port.");
 return Object.freeze({host,port,cwd:env.APP_ROOT||process.cwd(),localFirstMode,vpnRequired:localFirstMode?false:bool(env.VPN_REQUIRED,true),vpnRequireExitNode:localFirstMode?false:bool(env.VPN_REQUIRE_EXIT_NODE,true),vpnExitNodeRole:exitNodeRole,netbirdProviderConfigConfirmed:providerConfigConfirmed,netbirdIphoneRouteVerified:iphoneRouteVerified,rea:Object.freeze({enabled:bool(env.REA_ENABLED),command:env.REA_COMMAND||"rea",args:csv(env.REA_ARGS,["mcp"]),requiresVpn:localFirstMode?false:bool(env.REA_REQUIRES_VPN,true),allowedTools:csv(env.REA_ALLOWED_TOOLS,[])}),netbird:Object.freeze({enabled:bool(env.NETBIRD_ENABLED,false),autoConnect:bool(env.NETBIRD_AUTOCONNECT,false),command:env.NETBIRD_COMMAND||"netbird"}),compute:Object.freeze({enabled:bool(env.COMPUTE_ENABLED,false),python:env.COMPUTE_COMMAND||"python",port:computePort,cwd:env.APP_ROOT||process.cwd()}),ai:Object.freeze({aiEnabled:bool(env.AI_ENABLED,false),aiAutoStart:bool(env.AI_AUTOSTART,true),aiConfigured:!!(env.LLAMA_CPP_SERVER&&env.LLAMA_CPP_MODEL),port:computePort})});
}
