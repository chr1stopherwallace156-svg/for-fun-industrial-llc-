import {createReaAdapter} from "./adapters/rea.mjs";
import {createNetbirdAdapter} from "./adapters/netbird.mjs";
export function createPlatform(config) {
  const adapters=[createNetbirdAdapter(config.netbird),createReaAdapter(config.rea)]; let started=false,lastAction="idle";
  return {
    async start() { const results=[]; for (const a of adapters) results.push({id:a.id,name:a.name,...await a.start()}); started=true;lastAction="start";return {results,status:await this.status()}; },
    async stop() { const results=[];for(const a of [...adapters].reverse())results.push({id:a.id,name:a.name,...await a.stop()});started=false;lastAction="stop";return {results,status:await this.status()}; },
    async status() { const services=await Promise.all(adapters.map(async a=>({id:a.id,name:a.name,...await a.health()})));const enabled=services.filter(x=>x.state!=="disabled");const healthy=enabled.every(x=>["running","observed"].includes(x.state));return {application:"Fun Industrial Platform",version:"0.1.0",lifecycle:started?(healthy?"ready":"degraded"):"stopped",lastAction,services,safety:{localOnly:true,vpnMutations:false,automaticInstallation:false,shellExecution:false}}; }
  };
}
