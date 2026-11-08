// Isolate the deployed Node -> Python memory adapter without the HTTP server.
// Exact existing recall request, NO remember, REA tools, or service restart.
// Cognee recall may update local caches/search history; no retrieved text printed.
import {existsSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

const root=process.env.USERPROFILE;
if(process.platform!=="win32"||!root)throw Error("WINDOWS_PROFILE_REQUIRED");
const memoryModule=join(root,"FunIndustrial-REA-MCP-Activation","src","intelligence","memory.mjs");
if(!existsSync(memoryModule))throw Error("DEPLOYED_MEMORY_ADAPTER_NOT_FOUND");
const {memoryStatus,memoryAction}=await import(pathToFileURL(memoryModule).href);
const status=memoryStatus();
console.log("DEPLOYED_MEMORY_ADAPTER=FOUND");
console.log("MEMORY_AVAILABLE="+status.available+" ENABLED="+status.enabled+" WRITES_ENABLED="+status.writesEnabled);
if(!status.available||!status.enabled)throw Error("MEMORY_ADAPTER_NOT_READY");
console.log("NODE_ADAPTER_RECALL=START HTTP=NOT_USED REMEMBER=NOT_CALLED REA_TOOLS=NOT_CALLED");
try{
 const response=await memoryAction("recall",{query:"Fun Industrial requires operator approval before executing external tools."});
 console.log("NODE_ADAPTER_RECALL=PASS");
 console.log("RESPONSE_STATE="+String(response?.state));
 console.log("RESPONSE_OK="+String(response?.ok));
 console.log("RESPONSE_ACTION="+String(response?.action));
 console.log("RESULT_COUNT="+(Array.isArray(response?.results)?response.results.length:"unknown"));
 console.log("MEMORY_CONTENT_NOT_PRINTED=true");
}catch(error){
 console.log("NODE_ADAPTER_RECALL=HOLD");
 console.log("ERROR_TYPE="+(error?.constructor?.name||typeof error));
 console.log("ERROR_CODE="+String(error?.code||"none"));
 console.log("ERROR_MESSAGE="+String(error?.message||error).slice(0,700));
 const frames=String(error?.stack||"").split(/\r?\n/).slice(1,5).map(x=>x.trim());
 console.log("STACK_FRAMES="+frames.join(" | ").slice(0,950));
 process.exitCode=17;
}
