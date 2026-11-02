import {createReaAdapter} from "./adapters/rea.mjs";
import {createNetbirdAdapter} from "./adapters/netbird.mjs";
import {createComputeAdapter} from "./adapters/compute.mjs";
import {createAiAdapter} from "./adapters/ai.mjs";
export function createPlatform(config,overrides={}){
 const vpn=overrides.vpn||createNetbirdAdapter(config.netbird),compute=overrides.compute||createComputeAdapter(config.compute),ai=overrides.ai||createAiAdapter(config.ai),rea=overrides.rea||createReaAdapter(config.rea);
 let started=false,lastAction="idle",lastVpnGate="not-checked",gateDetail="VPN has not yet been checked.";
 async function vpnConnected(){const state=await vpn.health();const ok=state.state==="connected"&&(!config.vpnRequireExitNode||state.exitNodeRoute===true);lastVpnGate=ok?"connected":"blocked";gateDetail=ok?state.detail:(state.state==="connected"&&config.vpnRequireExitNode?"NetBird is connected but its IPv4 default route (0.0.0.0/0) is missing. Configure an approved exit node.":state.detail);return ok;}
 return {
  async start(){
   const results=[];
   results.push({id:vpn.id,name:vpn.name,...await vpn.start()});
   let secure=await vpnConnected();
   if(config.vpnRequired&&!secure){results.push({id:"vpn-connect",name:"VPN connection attempt",...await vpn.connect()});secure=await vpnConnected();}
   if(config.vpnRequired&&!secure)results.push({id:compute.id,name:compute.name,state:"blocked",detail:"All Fun Industrial functions require the NetBird exit-node gate; compute remains stopped until VPN is ready."});
   else results.push({id:compute.id,name:compute.name,...await compute.start()});
   if(config.vpnRequired&&!secure)results.push({id:ai.id,name:ai.name,state:"blocked",detail:"All Fun Industrial functions require the NetBird exit-node gate; local AI remains stopped until VPN is ready."});
   else results.push({id:ai.id,name:ai.name,...await ai.start()});
   if(!config.rea.enabled)results.push({id:rea.id,name:rea.name,state:"disabled",detail:"REA disabled in local configuration."});
   else if(config.vpnRequired&&!secure)results.push({id:rea.id,name:rea.name,state:"blocked",detail:"VPN_REQUIRED and VPN_REQUIRE_EXIT_NODE are enabled; REA MCP will not start until NetBird reports a connected exit-node route."});
   else results.push({id:rea.id,name:rea.name,...await rea.start()});
   started=true;lastAction="activate";
   return {results,status:await this.status()};
  },
  async stop(){
   const results=[];
   results.push({id:rea.id,name:rea.name,...await rea.stop()});
   results.push({id:ai.id,name:ai.name,...await ai.stop()});
   results.push({id:compute.id,name:compute.name,...await compute.stop()});
   results.push({id:vpn.id,name:vpn.name,...await vpn.stop()});
   started=false;lastAction="stop";
   return {results,status:await this.status()};
  },
  async connectVpn(){lastAction="vpn-connect";const result=await vpn.connect();const secure=await vpnConnected();if(secure&&started){const computeResult=await compute.start();const aiResult=await ai.start();const reaResult=config.rea.enabled?await rea.start():{state:"disabled"};return {state:"connected",vpn:result,compute:computeResult,ai:aiResult,rea:reaResult};}return result;},
  async disconnectVpn(){lastAction="vpn-disconnect";const result=await vpn.disconnect();await rea.stop();await ai.stop();await compute.stop();lastVpnGate="blocked";gateDetail="VPN was explicitly disconnected; Fun Industrial AI and REA services stopped.";return result;},
  async reaCatalog(){if(config.vpnRequired&&!await vpnConnected())throw new Error("VPN or required exit-node route is not connected; REA tools are blocked.");const state=await rea.health();if(state.state!=="ready")throw new Error("REA MCP is not ready.");return rea.tools();},
  async reaTools(){return (await this.reaCatalog()).filter(tool=>config.rea.allowedTools.slice(0,14).includes(tool.name));},
  async callReaTool(name,args){if(config.vpnRequired&&!await vpnConnected())throw new Error("VPN or required exit-node route is not connected; REA tools are blocked.");if(!config.rea.allowedTools.slice(0,14).includes(name))throw new Error("REA tool is not among the first 14 explicitly allowlisted names in REA_ALLOWED_TOOLS.");return rea.callTool(name,args);},
  async status(){
   const services=await Promise.all([vpn.health(),compute.health(),ai.health(),rea.health()]);
   const secure=services[0].state==="connected"&&(!config.vpnRequireExitNode||services[0].exitNodeRoute===true);lastVpnGate=secure?"connected":"blocked";gateDetail=secure?services[0].detail:(services[0].state==="connected"&&config.vpnRequireExitNode?"NetBird connected but no IPv4 default exit-node route was detected.":services[0].detail);
   if(!secure&&services[0].state==="connected")services[0]={...services[0],state:"blocked",detail:gateDetail};
   if(config.vpnRequired&&!secure&&services[1].state==="running"){await compute.stop();services[1]={state:"blocked",detail:"VPN or exit-node route lost; compute service stopped by fail-closed platform policy."};}
   if(config.vpnRequired&&!secure&&services[1].state==="stopped")services[1]={state:"blocked",detail:"VPN_REQUIRED is enabled; compute service remains stopped until NetBird and the exit-node route are ready."};
   if(config.vpnRequired&&!secure&&services[2].state==="ready"){await ai.stop();services[2]={state:"blocked",detail:"VPN or exit-node route lost; local AI runtime stopped by fail-closed platform policy."};}
   if(config.vpnRequired&&!secure&&services[3].state==="ready"){await rea.stop();services[3]={state:"blocked",detail:"VPN or exit-node route lost; REA MCP stopped by fail-closed policy."};}
   if(config.vpnRequired&&!secure&&config.rea.enabled&&services[3].state==="stopped")services[3]={state:"blocked",detail:"VPN_REQUIRED is enabled; REA MCP unavailable while VPN or exit-node route is disconnected."};
   const definitions=[{id:"netbird",name:"NetBird VPN"},{id:"compute",name:"Graph / Tensor / Neural Compute"},{id:"ai",name:"Local AI / llama.cpp"},{id:"rea",name:"REA MCP"}];
   const mapped=services.map((service,i)=>({...definitions[i],...service}));
   const enabled=mapped.filter(s=>!["disabled","not-configured"].includes(s.state)),healthy=enabled.length>0&&enabled.every(s=>["running","observed","connected","ready"].includes(s.state));
   const lifecycle=!started?"stopped":healthy?"ready":"degraded";
   return {application:"Fun Industrial Platform",version:"0.3.0",lifecycle,lastAction,services:mapped,vpn_policy:{required:config.vpnRequired,require_exit_node:config.vpnRequireExitNode,state:lastVpnGate,detail:gateDetail,rea_blocked_without_vpn:config.vpnRequired},safety:{localOnly:true,reaRequiresVpn:config.vpnRequired,reaRequiresExitNode:config.vpnRequireExitNode,shellExecution:false,customCryptography:false}};
  }
 };
}
