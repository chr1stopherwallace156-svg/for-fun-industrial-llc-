// FI_SOFTWARE_FIRST_WORKFLOW_CLI_V1 — bounded local CLI; no dashboard or network listener.
import {readFile,lstat} from "node:fs/promises";
import {resolve} from "node:path";
import {createWorkflowCoordinator} from "./coordinator.mjs";
const [command,...args]=process.argv.slice(2);
function fail(message){console.error("FUN_WORKFLOW_CLI_HOLD="+message);process.exitCode=1;}
async function loadSpec(file){
 const full=resolve(file||"");
 const info=await lstat(full);
 if(!info.isFile()||info.isSymbolicLink()||info.size>12000)throw Error("WORKFLOW_SPEC_FILE_UNSAFE");
 return JSON.parse(await readFile(full,"utf8"));
}
try{
 const coordinator=createWorkflowCoordinator();
 let result;
 if(command==="create"&&args.length===1)result=await coordinator.create(await loadSpec(args[0]));
 else if(command==="status"&&args.length===1)result=await coordinator.get(args[0]);
 else if(command==="step"&&args.length===1)result=await coordinator.advance(args[0]);
 else if(command==="review"&&args.length===2)result=await coordinator.review(args[0],args[1]);
 else if(command==="retry"&&args.length===1)result=await coordinator.retry(args[0]);
 else throw Error("WORKFLOW_COMMAND_INVALID: create SPEC_JSON | status ID | step ID | review ID approve/reject | retry ID");
 console.log(JSON.stringify({event:"FUN_WORKFLOW_CLI_RESULT",state:result.status,id:result.id,cursor:result.cursor,
  steps:result.steps.length,used_completion_tokens:result.used_completion_tokens,
  measured_prompt_tokens:result.measured_prompt_tokens,
  token_usage_complete:result.token_usage_complete,
  results:result.results,hold_reason:result.hold_reason||null}));
}catch(e){fail(String(e.message||e).slice(0,240));}
