// FI_WEB_PLATFORM_PATCH_V1 — additive integration with the existing Activate button.
// Existing platform status, REA, AI, voice, Cognee and optimization routes are preserved.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const MARK="FI_WEB_PLATFORM_ACTIVATION_V1";
function once(s,needle,replacement){
 const count=s.split(needle).length-1;
 if(count!==1)throw Error("WEB_PATCH_ANCHOR_HOLD "+needle.slice(0,65)+" COUNT="+count);
 return s.replace(needle,()=>replacement);
}
export function patchWebPlatform(original){
 if(original.includes(MARK))throw Error("WEB_PLATFORM_ALREADY_PATCHED");
 for(const seal of ["FI_OPTIMIZATION_AGENT_V1","FI_OPTIMIZATION_PHASE23_V1",
  "FI_AUTO_COGNEE_CHAT_V1","FI_VOICE_MOBILE_DASHBOARD_V1","FI_SOURCING_RETIRED_V1"]){
  if(!original.includes(seal))throw Error("WEB_PLATFORM_BASELINE_MISSING_"+seal);
 }
 let out=once(original,
  'import {createAutonomyActivator} from "./autonomy-activation.mjs";',
  'import {createAutonomyActivator} from "./autonomy-activation.mjs";\n'+
  'import {createWebResearchActivator} from "./web-activation.mjs";');
 out=once(out,'const autonomyActivator=createAutonomyActivator();',
  'const autonomyActivator=createAutonomyActivator();\n'+
  'const webResearchActivator=createWebResearchActivator();');
 const startResponse='const autonomy=await autonomyActivator.activate();return json(res,200,{...result,...(platform_error?{platform_error}:{}),autonomy});';
 out=once(out,startResponse,
  'const autonomy=await autonomyActivator.activate();\n'+
  '   const web=await webResearchActivator.activate();\n'+
  '   return json(res,200,{...result,...(platform_error?{platform_error}:{}),autonomy,web,\n'+
  '    results:[...(result.results||[]),{id:"web",name:"Web Research / DDGS",...web}],\n'+
  '    status:{...result.status,services:[...(result.status?.services||[]),\n'+
  '     {id:"web",name:"Web Research / DDGS",...web}]}});');
 out=once(out,'services:[...(status.services||[]),',
  'services:[...(status.services||[]),{id:"web",name:"Web Research / DDGS",...(await webResearchActivator.status())},');
 const stopAnchor='if(req.url==="/api/stop")return json(res,200,await platform.stop());';
 out=once(out,stopAnchor,
  'if(req.url==="/api/stop"){\n'+
  '   const old=await platform.stop(),web=await webResearchActivator.stop();\n'+
  '   return json(res,200,{...old,web,results:[...(old.results||[]),{id:"web",name:"Web Research / DDGS",...web}],\n'+
  '    status:{...old.status,services:[...(old.status?.services||[]),\n'+
  '     {id:"web",name:"Web Research / DDGS",...(await webResearchActivator.status())}]}});\n'+
  '  }');
 const serverAnchor='const server=http.createServer(async(req,res)=>{try{';
 out=once(out,serverAnchor,serverAnchor+'\n'+
  ' // '+MARK+' — observational health, no unauthenticated web-launch endpoint.\n'+
  ' if(req.method==="GET"&&req.url==="/api/web/status"){\n'+
  '  if(!localRequest(req,res))return;return json(res,200,await webResearchActivator.status());\n'+
  ' }');
 // Guard: original route bodies and protection remain present.
 for(const protectedMarker of ["/api/rea/call","/api/ai/chat","/api/optimization/agent/analyze"]){
  if(!out.includes(protectedMarker))throw Error("WEB_PLATFORM_EXISTING_ROUTE_LOST");
 }
 const csp=[...out.matchAll(/script-src\s+([^;]+);/g)];
 if(csp.length!==1||!/(?:^|\s)'self'(?:\s|$)/.test(csp[0][1]))throw Error("WEB_PLATFORM_CSP_HOLD");
 return out;
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const [source,dest]=process.argv.slice(2);
  if(!source||!dest||resolve(source)===resolve(dest))throw Error("WEB_STAGE_PATHS_INVALID");
  writeFileSync(dest,patchWebPlatform(readFileSync(source,"utf8")),"utf8");
  console.log("FUN_WEB_PLATFORM_PATCH=PASS EXISTING_ROUTES_PRESERVED=TRUE");
 }catch(error){console.error("FUN_WEB_PLATFORM_PATCH_HOLD="+error.message);process.exitCode=1;}
}
