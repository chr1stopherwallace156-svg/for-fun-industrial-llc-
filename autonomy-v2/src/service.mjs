import {Sidequest} from "sidequest";
import {Discover,Registry,Research,ProductSnapshot} from "./jobs.mjs";
import {startDashboard} from "./http.mjs";
import {dataPath,ensureData,logEvent} from "./core.mjs";
ensureData();
let server,stopping=false;
const queue="fi-autonomy";
try{
 await Sidequest.start({backend:{driver:"@sidequest/sqlite-backend",config:dataPath("jobs.sqlite")},dashboard:{enabled:false},queues:[{name:queue,concurrency:1,priority:10,state:"active"}],maxConcurrentJobs:1,minThreads:1,maxThreads:1,fork:false,runner:"thread",jobPollingInterval:250});
 server=await startDashboard({sidequest:Sidequest,port:8792});
 await Sidequest.build(Discover).queue(queue).maxAttempts(1).schedule("*/5 * * * *");
 await Sidequest.build(Registry).queue(queue).maxAttempts(1).schedule("*/30 * * * *");
 await Sidequest.build(Research).queue(queue).maxAttempts(1).schedule("0 */6 * * *");
 await Sidequest.build(ProductSnapshot).queue(queue).maxAttempts(1).schedule("0 * * * *");
 for(const J of [Discover,Registry,Research,ProductSnapshot])await Sidequest.build(J).queue(queue).maxAttempts(1).enqueue();
 logEvent("service_started",{pid:process.pid,version:"0.2.0",reaCalls:0});
 console.log("AUTONOMY_V2=RUNNING DASHBOARD=http://127.0.0.1:8792 PID="+process.pid);
}catch(e){console.error("AUTONOMY_START_FAIL",e);process.exitCode=1;if(server)server.close();await Sidequest.stop().catch(()=>{});throw e}
async function shutdown(){if(stopping)return;stopping=true;console.log("AUTONOMY_SHUTDOWN");try{server.close();await Sidequest.stop();logEvent("service_stopped",{pid:process.pid})}catch(e){console.error(e)}process.exit(0)}
process.on("SIGINT",()=>void shutdown());
process.on("SIGTERM",()=>void shutdown());
