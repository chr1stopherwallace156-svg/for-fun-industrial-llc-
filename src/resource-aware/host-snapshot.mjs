// Observational host sampling only; no process control or allocation enforcement.
import os from 'node:os';
const mib=1024*1024;
function cpuTotals(){let idle=0,total=0;for(const c of os.cpus()){for(const [k,v] of Object.entries(c.times)){total+=v;if(k==='idle')idle+=v;}}return {idle,total};}
export async function sampleHost({sampleDelayMs=150}={}){
 if(!Number.isInteger(sampleDelayMs)||sampleDelayMs<50||sampleDelayMs>3000)throw Error('RAEM_SAMPLE_DELAY_INVALID');
 const before=cpuTotals();await new Promise(resolve=>setTimeout(resolve,sampleDelayMs));const after=cpuTotals();
 const elapsed=after.total-before.total;
 const cpuBusyPct=elapsed>0?Math.min(100,Math.max(0,100*(1-(after.idle-before.idle)/elapsed))):100;
 const totalMiB=Math.floor(os.totalmem()/mib),freeMiB=Math.floor(os.freemem()/mib);
 return Object.freeze({totalMiB,freeMiB,cpuBusyPct:Number(cpuBusyPct.toFixed(2))});
}
