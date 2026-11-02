import {createReaAdapter} from "./adapters/rea.mjs";
import {createNetbirdAdapter} from "./adapters/netbird.mjs";
import {createComputeAdapter} from "./adapters/compute.mjs";
export function createPlatform(config){
 const adapters=[createNetbirdAdapter(config.netbird),createComputeAdapter(config.compute),createReaAdapter(config.rea)];
 const vpn=adapters[0];let started=false,lastAction="idle";
 return {
  async start(){const results=[];for(const adapter of adapters)results.push({id:adapter.id,name:adapter.name,...await adapter.start()});started=true;lastAction="activate";return {results,status:await this.status()};},
  async stop(){const results=[];for(const adapter of [...adapters].reverse())results.push({id:adapter.id,name:adapter.name,...await adapter.stop()});started=false;lastAction="stop";return {results,status:await this.status()};},
  async connectVpn(){lastAction="vpn-connect";return vpn.connect();},
  async disconnectVpn(){lastAction="vpn-disconnect";return vpn.disconnect();},
  async status(){const services=await Promise.all(adapters.map(async adapter=>({id:adapter.id,name:adapter.name,...await adapter.health()})));const enabled=services.filter(s=>s.state!=="disabled"),healthy=enabled.length>0&&enabled.every(s=>["running","observed","connected"].includes(s.state));const lifecycle=!started?"stopped":enabled.length===0?"idle":healthy?"ready":"degraded";return {application:"Fun Industrial Platform",version:"0.2.0",lifecycle,lastAction,services,safety:{localOnly:true,vpnMutations:false,automaticInstallation:false,shellExecution:false}};}
 };
}
