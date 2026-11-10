// FI_WEB_EVIDENCE_BUDGET_SERVER_PATCH_V2 — modify only installed web-assisted reply metadata.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const oldImport='import {enrichWebChat,addWebSources} from "./intelligence/chat-web.mjs";';
const newImport='import {enrichWebChat,addWebSources,webChatTokenMetrics} from "./intelligence/chat-web.mjs";';
const oldMeta='web:{searched:true,source_count:web.sources.length,read_only:true,external_actions_executed:0}});';
const newMeta='web:{searched:true,source_count:web.sources.length,read_only:true,external_actions_executed:0,token_budget:webChatTokenMetrics(result,web)}});';
const once=(source,needle,replacement)=>{
 const count=source.split(needle).length-1;
 if(count!==1)throw Error("WEB_BUDGET_ANCHOR_COUNT_"+count);
 return source.replace(needle,()=>replacement);
};
export function patchWebBudgetServer(source){
 if(typeof source!=="string"||!source.includes("FI_WEB_CHAT_CONSOLIDATION_V1"))throw Error("WEB_BUDGET_INSTALLED_SERVER_REQUIRED");
 if(source.includes("FI_WEB_EVIDENCE_BUDGET_SERVER_PATCH_V2")||source.includes(newImport))throw Error("WEB_BUDGET_ALREADY_INSTALLED");
 for(const required of ["FI_VOICE_MOBILE_DASHBOARD_V1","FI_AUTO_COGNEE_CHAT_V1","FI_OPTIMIZATION_AGENT_V1","FI_WEB_PLATFORM_ACTIVATION_V1"]){
  if(!source.includes(required))throw Error("WEB_BUDGET_PROTECTED_MARKER_MISSING_"+required);
 }
 let out=once(source,oldImport,'// FI_WEB_EVIDENCE_BUDGET_SERVER_PATCH_V2\n'+newImport);
 out=once(out,oldMeta,newMeta);
 for(const route of ["/api/rea/call","/api/voice/mobile/","/api/activate","/api/optimization/agent/analyze","/api/ai/automatic-memory/status"]){
  if(!out.includes(route)||!source.includes(route))throw Error("WEB_BUDGET_ROUTE_MISSING_"+route);
 }
 return out;
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output))throw Error("WEB_BUDGET_STAGING_PATH_INVALID");
  writeFileSync(output,patchWebBudgetServer(readFileSync(input,"utf8")),"utf8");
  console.log("FUN_WEB_TOKEN_BUDGET_STAGING=PASS ORIGINAL_SERVER_UNCHANGED=TRUE");
 }catch(e){console.error("FUN_WEB_TOKEN_BUDGET_STAGING_HOLD="+String(e.message||e));process.exitCode=1;}
}