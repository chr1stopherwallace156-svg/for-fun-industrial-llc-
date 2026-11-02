import {createReaAdapter} from "./adapters/rea.mjs";
import {createNetbirdAdapter} from "./adapters/netbird.mjs";
import {createComputeAdapter} from "./adapters/compute.mjs";
export function createPlatform(config){
 const vpn=createNetbirdAdapter(config.netbird),compute=createComputeAdapter(config.compute),rea=createReaAdapter(config.rea);
 let started=false,lastAction="idle",lastVpnGate="not-checked",gateDetail="VPN has not yet been checked.";
 async function vpnConnected(){const state=await vpn.health();const ok=state.state==="connected";lastVpnGate=ok?"connected":"blocked";gateDetail=state.detail;return ok;}
 return {
  async start(){
   const results=[];
   const v=await vpn.start();results.push({id:vpn.id,name:vpn.name,...v});
   let secure=await vpnConnected();
   if(config.vpnRequired&&!secure){const attempt=await vpn.connect();results.push({id:"vpn-connect",name:"VPN connection attempt",...attempt});secure=await vpnConnected();}
   const c=await compute.start();results.push({id:compute.id,name:compute.name,...c});
   if(!config.rea.enabled)results.push({id:rea.id,name:rea.name,state:"disabled",detail:"REA disabled in local configuration."});
   else if(config.vpnRequired&&!secure)results.push({id:rea.id,name:rea.name,state:"blocked",detail:"VPN_REQUIRED is enabled; REA MCP will not start until NetBird reports connected."});
   else {const r=await rea.start();results.push({id:rea.id,name:rea.name,...r});}
   started=true;lastAction="activate";
   return {results,status:await this.status()};
  },
  async stop(){
   const results=[];
   results.push({id:rea.id,name:rea.name,...await rea.stop()});
   results.push({id:compute.id,name:compute.name,...await compute.stop()});
   results.push({id:vpn.id,name:vpn.name,...await vpn.stop()});
   started=false;lastAction="stop";
   return {results,status:await this.status()};
  },
  async connectVpn(){lastAction="vpn-connect";const result=await vpn.connect();const secure=await vpnConnected();if(secure&&started&&config.rea.enabled){const r=await rea.start();return {state:"connected",vpn:result,rea:r};}return result;},
  async disconnectVpn(){lastAction="vpn-disconnect";const result=await vpn.disconnect();await rea.stop();lastVpnGate="blocked";gateDetail="VPN was explicitly disconnected; REA stopped.";return result;},
  async reaCatalog(){if(config.vpnRequired&&!await vpnConnected())throw new Error("VPN is not connected; REA tools are blocked.");const state=await rea.health();if(state.state!=="ready")throw new Error("REA MCP is not ready.");return rea.tools();},
  async reaTools(){return (await this.reaCatalog()).filter(tool=>config.rea.allowedTools.includes(tool.name));},
  async callReaTool(name,args){if(config.vpnRequired&&!await vpnConnected())throw new Error("VPN is not connected; REA tools are blocked.");if(!config.rea.allowedTools.includes(name))throw new Error("REA tool is not explicitly allowlisted in REA_ALLOWED_TOOLS.");return rea.callTool(name,args);},
  async status(){
   const services=await Promise.all([vpn.health(),compute.health(),rea.health()]);
   const secure=services[0].state==="connected";lastVpnGate=secure?"connected":"blocked";gateDetail=services[0].detail;
   if(config.vpnRequired&&!secure&&services[2].state==="ready"){await rea.stop();services[2]={state:"blocked",detail:"VPN disconnected; REA MCP stopped by fail-closed policy."};}
   if(config.vpnRequired&&!secure&&config.rea.enabled&&services[2].state==="stopped")services[2]={state:"blocked",detail:"VPN_REQUIRED is enabled; REA MCP unavailable while VPN is disconnected."};
   const definitions=[{id:"netbird",name:"NetBird VPN"},{id:"compute",name:"Graph / Tensor / Neural Compute"},{id:"rea",name:"REA MCP"}];
   const mapped=services.map((service,i)=>({...definitions[i],...service}));
   const enabled=mapped.filter(s=>s.state!=="disabled"),healthy=enabled.length>0&&enabled.every(s=>["running","observed","connected","ready"].includes(s.state));
   const lifecycle=!started?"stopped":healthy?"ready":"degraded";
   return {application:"Fun Industrial Platform",version:"0.3.0",lifecycle,lastAction,services:mapped,vpn_policy:{required:config.vpnRequired,state:lastVpnGate,detail:gateDetail,rea_blocked_without_vpn:config.vpnRequired},safety:{localOnly:true,reaRequiresVpn:config.vpnRequired,shellExecution:false,customCryptography:false}};
  }
 };
}
