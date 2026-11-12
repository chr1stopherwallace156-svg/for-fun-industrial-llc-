// FI_ADAPTIVE_V2_READONLY_DIAGNOSTIC
// One command, no process startup, no source changes, no tool execution.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createAdaptivePlanner} from '../src/experimental/adaptive-capability-v2.mjs';
import {fixedJson} from '../src/experimental/unified-task-chat.mjs';

export async function runAdaptiveDiagnostic({prompt,request=fixedJson,write=console.log}={}){
 if(typeof prompt!=='string'||prompt.trim().length<5||prompt.length>1200)
  throw Error('ADAPTIVE_DIAG_INVALID_PROMPT');
 const planner=createAdaptivePlanner({request});
 const plan=await planner.plan(prompt);
 write('ADAPTIVE_V2_STATE='+plan.state);
 write('ADAPTIVE_V2_CATEGORY='+plan.category);
 write('REGISTERED_REA='+plan.catalogue.rea+' REGISTERED_LOCAL='+plan.catalogue.local);
 write('MATCHED_CANDIDATES='+plan.candidates.length);
 for(const c of plan.candidates){
  write('CANDIDATE='+JSON.stringify({
   name:c.name,source:c.source,requiredArguments:c.requiredArguments,
   providerVerified:c.providerVerified,operatorApprovalRequired:c.operatorApprovalRequired,
   executionAllowed:c.executionAllowed
  }));
 }
 for(const blocker of plan.prerequisites)write('BLOCKER='+blocker);
 for(const err of plan.discoveryErrors)write('DISCOVERY_HOLD='+err);
 write('ADAPTIVE_V2_EXECUTED_ACTIONS='+plan.executedActions);
 write('ADAPTIVE_V2_APPROVAL_GRANTED='+plan.approvalGranted);
 write('ADAPTIVE_V2_RUNNING_SERVICES_UNCHANGED=TRUE');
 return plan;
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 if(process.argv.length!==4||process.argv[2]!=='--plan'){
  console.log('ADAPTIVE_V2=INACTIVE. Use explicit --plan "describe an engineering task"');
 }else{
  try{const p=await runAdaptiveDiagnostic({prompt:process.argv[3]});
   if(p.catalogue.rea!==229||p.catalogue.local!==19||p.discoveryErrors.length)
    process.exitCode=2;
  }catch(e){
   console.error('ADAPTIVE_V2_HOLD='+String(e?.message||e).slice(0,280));
   process.exitCode=1;
  }
 }
}
