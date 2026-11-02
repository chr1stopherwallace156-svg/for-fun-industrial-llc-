import { spawn } from "node:child_process";
export function createReaAdapter(config) {
  let child = null;
  return {id:"rea",name:"REA CLI / MCP",
    async start() {
      if (!config.enabled) return {state:"disabled",detail:"Enable REA_ENABLED after installing REA."};
      if (child && child.exitCode === null) return {state:"running",detail:"REA process already running."};
      try { child = spawn(config.command, config.args, {shell:false,windowsHide:true,stdio:["pipe","pipe","pipe"]}); child.stdout.on("data",()=>{}); child.stderr.on("data",()=>{}); child.on("error",()=>{}); await new Promise(r=>setTimeout(r,250));
        return child.exitCode === null ? {state:"running",detail:"Process started; MCP handshake is not yet qualified."} : {state:"failed",detail:"REA exited during startup."};
      } catch(e) { return {state:"failed",detail:e.message}; }
    },
    async stop() { if (child && child.exitCode === null) child.kill(); child=null; return {state:"stopped",detail:"REA child process stopped."}; },
    async health() { if (!config.enabled) return {state:"disabled",detail:"Adapter disabled."}; return {state:child && child.exitCode === null ? "running" : "stopped",detail:"Process-level check only; MCP handshake pending."}; }
  };
}
