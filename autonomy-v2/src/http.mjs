import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {events,readJSON,HOME} from "./core.mjs";
const page=readFileSync(join(HOME,"dashboard.html"),"utf8");
const ALLOWED=new Set(["/","/api/status","/api/events","/api/tasks","/api/research","/api/rea"]);
function output(res,status,body,type="application/json; charset=utf-8"){
 res.writeHead(status,{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});
 res.end(type.startsWith("text/html")?body:JSON.stringify(body));
}
export function startDashboard({sidequest,port=8792}){
 const server=createServer(async(req,res)=>{try{
  if(req.method!=="GET"||!ALLOWED.has(req.url))return output(res,404,{error:"NOT_FOUND"});
  if(!/^(?:127\.0\.0\.1|localhost):\d+$/.test(req.headers.host||""))return output(res,403,{error:"LOCAL_HOST_ONLY"});
  if(req.url==="/")return output(res,200,page,"text/html; charset=utf-8");
  if(req.url==="/api/events")return output(res,200,{events:events(75)});
  if(req.url==="/api/tasks")return output(res,200,{tasks:readJSON("pending-tasks.json",[]).slice(-100).reverse()});
  if(req.url==="/api/research")return output(res,200,{research:readJSON("latest-research.json",{}),products:readJSON("product-snapshot.json",{})});
  if(req.url==="/api/rea")return output(res,200,readJSON("rea-registry.json",{state:"not_yet_observed"}));
  const jobs=await sidequest.job.count();
  return output(res,200,{state:"running",application:"Fun Industrial Autonomous Workers",version:"0.2.0",pid:process.pid,uptimeSeconds:Math.floor(process.uptime()),schedule:{platform:"every 5 minutes",registry:"every 30 minutes",research:"every 6 hours",products:"hourly"},mode:"read-only",reaToolCalls:0,aiderRuns:0,externalResearch:"allowlisted GitHub releases API",jobs,platform:readJSON("platform-health.json",{state:"pending"}),lastResearch:readJSON("latest-research.json",{state:"pending"}),registry:readJSON("rea-registry.json",{state:"pending"}),eventsRecorded:events(10000).length});
 }catch(e){return output(res,500,{error:"DASHBOARD_ERROR",detail:String(e.message).slice(0,150)})}});
 return new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",()=>resolve(server))});
}
