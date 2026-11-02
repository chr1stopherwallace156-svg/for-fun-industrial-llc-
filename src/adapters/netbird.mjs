import {runCommand} from "./command.mjs";
export function createNetbirdAdapter(config) {
  return {id:"netbird",name:"NetBird VPN",
    async start() { if (!config.enabled) return {state:"disabled",detail:"Install and enroll the official client separately, then enable this adapter."}; const r=await runCommand(config.command,["status"]); return r.ok ? {state:"observed",detail:r.stdout || "Status command responded; verify peer and tunnel state."} : {state:"unavailable",detail:r.error || r.stderr || "NetBird status unavailable."}; },
    async stop() { return {state:"not-controlled",detail:"VPN state is never changed by this adapter."}; },
    async health() { if (!config.enabled) return {state:"disabled",detail:"Adapter disabled."}; const r=await runCommand(config.command,["status"]); return r.ok ? {state:"observed",detail:r.stdout || "Status responded; connectivity not independently proven."} : {state:"unavailable",detail:r.error || r.stderr || "NetBird status unavailable."}; }
  };
}
