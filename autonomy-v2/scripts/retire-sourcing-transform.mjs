// Reversible retirement of domestic and international sourcing (not all Autonomy).
import {readFileSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error("RETIRE_ANCHOR_NOT_UNIQUE:"+a.slice(0,70));return s.replace(a,b)};
function cut(s,start,end,replacement=""){
 const i=s.indexOf(start);if(i<0||s.indexOf(start,i+1)>=0)throw Error("RETIRE_START_MISSING_OR_DUPLICATE:"+start.slice(0,70));
 const j=s.indexOf(end,i+start.length);if(j<0)throw Error("RETIRE_END_MISSING:"+end.slice(0,70));
 return s.slice(0,i)+replacement+s.slice(j);
}
export function workerHttp(input){
 // Git for Windows may check out the same committed UTF-8 file with CRLF line endings.
 input=input.replace(/\r\n?/g,"\n");
 if(input.includes("FI_SOURCING_RETIRED_V1"))throw Error("ALREADY_RETIRED");
 let s=once(input,'import {DomesticScan} from "./jobs.mjs";\n',"");
 s=once(s,'import {combinedOpportunities} from "./gsa-bridge.mjs";\n',"");
 s=once(s,'import {sourcesForUI,PORTS,CATEGORIES,COUNTRIES} from "./international.mjs";\n',"");
 s=once(s,' let lastScanRequest=0;\n',"");
 s=cut(s,'  if(req.method==="POST"&&req.url==="/api/opportunities/scan"){',
 '  if(req.method!=="GET"||!ALLOWED.has(req.url))',
 '  // FI_SOURCING_RETIRED_V1: archive retained; all opportunity API endpoints disabled.\n'+
 '  if(["/api/opportunities/scan","/api/opportunities","/api/international"].includes(req.url))return output(res,410,{error:"SOURCING_RETIRED",dataPreserved:true});\n');
 s=cut(s,'  if(req.url==="/api/international"){','  const jobs=await sidequest.job.count();',
 '  // Domestic and international listing reads retired; health/REA/research remain.\n');
 s=once(s,'"/api/rea","/api/opportunities","/api/international"','"/api/rea"');
 s=once(s,'domestic:"every 6 hours; on-demand scan"','domestic:"retired_no_new_scans"');
 s=once(s,'externalResearch:"allowlisted GitHub releases, Grants.gov, optional SAM.gov and GSA Auctions APIs"',
   'externalResearch:"allowlisted GitHub release research; sourcing feeds retired"');
 return s;
}
export function workerService(input){
 // Git for Windows may check out the same committed UTF-8 file with CRLF line endings.
 input=input.replace(/\r\n?/g,"\n");
 if(input.includes("FI_SOURCING_RETIRED_V1"))throw Error("ALREADY_RETIRED");
 let s=once(input,'import {Discover,Registry,Research,ProductSnapshot,DomesticScan} from "./jobs.mjs";',
  'import {Discover,Registry,Research,ProductSnapshot} from "./jobs.mjs";');
 s=once(s,' await Sidequest.build(DomesticScan).queue(queue).maxAttempts(1).schedule("25 */6 * * *");\n',
  ' // FI_SOURCING_RETIRED_V1: no new domestic schedules.\n');
 s=once(s,'for(const J of [Discover,Registry,Research,ProductSnapshot,DomesticScan])',
  'for(const J of [Discover,Registry,Research,ProductSnapshot])');
 return s;
}
export function workerJobs(input){
 // Git for Windows may check out the same committed UTF-8 file with CRLF line endings.
 input=input.replace(/\r\n?/g,"\n");
 if(input.includes("FI_SOURCING_RETIRED_V1"))throw Error("ALREADY_RETIRED");
 let s=once(input,'import {scanDomestic} from "./domestic.mjs";\n',"");
 s=cut(s,'export class DomesticScan extends Job {','export class Followup extends Job {',
  '// FI_SOURCING_RETIRED_V1: keep class identity for already-persisted schedules/jobs, never fetch upstream.\n'+
  'export class DomesticScan extends Job {\n async run(){return {state:"SOURCING_RETIRED",networkCalls:0,transactions:0}}\n}\n');
 return s;
}
export function platformServer(input){
 // Git for Windows may check out the same committed UTF-8 file with CRLF line endings.
 input=input.replace(/\r\n?/g,"\n");
 if(input.includes("FI_SOURCING_RETIRED_V1"))throw Error("ALREADY_RETIRED");
 let s=once(input,',"/api/autonomy/international":"/api/international"',"");
 s=once(s,',"/api/autonomy/opportunities":"/api/opportunities"',"");
 s=cut(s,' // FI_DOMESTIC_OPPORTUNITIES_V1',
  ' if(req.method==="GET"&&Object.prototype.hasOwnProperty.call(autonomyPaths,req.url)){',
  ' // FI_SOURCING_RETIRED_V1: 410 on both retired sources, all other APIs unchanged.\n'+
  ' if(["/api/autonomy/scan","/api/autonomy/opportunities","/api/autonomy/international"].includes(req.url))return json(res,410,{error:"SOURCING_RETIRED",dataPreserved:true});\n');
 return s;
}
export function platformUi(input){
 // Git for Windows may check out the same committed UTF-8 file with CRLF line endings.
 input=input.replace(/\r\n?/g,"\n");
 if(input.includes("FI_SOURCING_RETIRED_V1"))throw Error("ALREADY_RETIRED");
 let s=input;
 const intl=s.includes("<!-- FI_INTERNATIONAL_SOURCE_V1 -->");
 const start=intl?'<!-- FI_INTERNATIONAL_SOURCE_V1 -->':'<!-- FI_DOMESTIC_OPPORTUNITIES_V1 -->';
 const i=s.indexOf(start),j=s.indexOf("</section>",i);
 if(i<0||j<0)throw Error("UI_PANEL_BOUNDARY_MISSING");
 const block=s.slice(i,j);
 if(!block.includes('id="fiDomesticScanBtn"')||(intl&&!block.includes('id="fiIntlRefresh"'))||block.includes("<section"))
  throw Error("UNRECOGNIZED_UI_BLOCK_HOLD");
 s=s.slice(0,i)+"<!-- FI_SOURCING_RETIRED_V1: source panels retired, original backed up -->\n"+s.slice(j);
 s=cut(s,'/* U.S. opportunity research — same-origin 8789, safely rendered as plain text */','function bindEvents(){');
 const bind="function bindEvents(){$('fiDomesticScanBtn').addEventListener('click',scanDomesticOpportunities);";
 if(intl){
  s=once(s,bind+"$('fiIntlRefresh').addEventListener('click',refreshInternational);for(const id of ['fiIntlCountry','fiIntlCategory','fiIntlQuery'])$(id).addEventListener('input',renderInternational);","function bindEvents(){");
  s=once(s,"if(id==='autonomy'){void refreshAutonomy();void refreshDomesticOpportunities();void refreshInternational();}","if(id==='autonomy')void refreshAutonomy();");
 }else{
  s=once(s,bind,"function bindEvents(){");
  s=once(s,"if(id==='autonomy'){void refreshAutonomy();void refreshDomesticOpportunities();}","if(id==='autonomy')void refreshAutonomy();");
 }
 if(/fiDomesticScanBtn|fiIntlRefresh|refreshDomesticOpportunities\(|refreshInternational\(/.test(s))throw Error("DANGLING_SOURCING_UI_REFERENCE");
 return s;
}
export const files=Object.freeze({
 "worker/src/http.mjs":workerHttp,
 "worker/src/jobs.mjs":workerJobs,
 "worker/src/service.mjs":workerService,
 "platform/src/server.mjs":platformServer,
 "platform/public/index.html":platformUi
});
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [platformRoot,workerRoot,destinationRoot]=process.argv.slice(2);
  if(!platformRoot||!workerRoot||!destinationRoot)throw Error("PLATFORM_WORKER_OUTPUT_REQUIRED");
  const roots={platform:resolve(platformRoot),worker:resolve(workerRoot)},output=resolve(destinationRoot);
  if(Object.values(roots).some(v=>v===output||output.startsWith(v+"/")||output.startsWith(v+"\\")))throw Error("STAGING_MUST_BE_SEPARATE");
  for(const [name,fn] of Object.entries(files)){
   const [kind,...relative]=name.split("/");
   const source=join(roots[kind],...relative),out=join(output,name);
   const result=fn(readFileSync(source,"utf8"));mkdirSync(dirname(out),{recursive:true});writeFileSync(out,result,"utf8");
   if(name.endsWith(".mjs"))execFileSync(process.execPath,["--check",out],{stdio:"pipe"});
   if(name==="platform/public/index.html"){
    const m=result.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
    if(!m)throw Error("INLINE_DASHBOARD_JS_NOT_FOUND");
    const tmp=join(tmpdir(),"fi-retire-check-"+process.pid+".mjs");
    try{writeFileSync(tmp,m[1],"utf8");execFileSync(process.execPath,["--check",tmp],{stdio:"pipe"})}
    finally{rmSync(tmp,{force:true})}
   }
   console.log("RETIRE_STAGE=PASS FILE="+name);
  }
  console.log("RETIRE_STAGE=PASS FILES=5 LIVE_FILES_UNCHANGED=TRUE");
 }catch(e){console.error("RETIRE_STAGE=HOLD REASON="+String(e.message).slice(0,210));process.exitCode=1}
}
