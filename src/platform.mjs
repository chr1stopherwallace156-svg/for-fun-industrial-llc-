import {createReaAdapter} from "./adapters/rea.mjs";
import {createNetbirdAdapter} from "./adapters/netbird.mjs";

export function createPlatform(config) {
  const adapters=[createNetbirdAdapter(config.netbird),createReaAdapter(config.rea)];
  let started=false,lastAction="idle";
  return {
    async start() {
      const results=[];
      for(const adapter of adapters) results.push({id:adapter.id,name:adapter.name,...await adapter.start()});
      started=true;
      lastAction="start";
      return {results,status:await this.status()};
    },
    async stop() {
      const results=[];
      for(const adapter of [...adapters].reverse()) results.push({id:adapter.id,name:adapter.name,...await adapter.stop()});
      started=false;
      lastAction="stop";
      return {results,status:await this.status()};
    },
    async status() {
      const services=await Promise.all(adapters.map(async adapter=>({id:adapter.id,name:adapter.name,...await adapter.health()})));
      const enabled=services.filter(service=>service.state!=="disabled");
      const healthy=enabled.length>0 && enabled.every(service=>["running","observed"].includes(service.state));
      const lifecycle=!started?"stopped":enabled.length===0?"idle":healthy?"ready":"degraded";
      return {application:"Fun Industrial Platform",version:"0.1.0",lifecycle,lastAction,services,safety:{localOnly:true,vpnMutations:false,automaticInstallation:false,shellExecution:false}};
    }
  };
}
