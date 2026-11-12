// FI_UNIFIED_V4_STAGE2_EMBEDDED_LOCAL — reuse the original 19-tool bridge
// in the 8798 Node process. NO 8796 /run POST, new HTTP port or REA grants.
// Only the outer Unified Chat's explicit operator confirmation calls run().
import {createAutoLocalDashboard} from './auto-local-dashboard.mjs';
const LOCAL='http://127.0.0.1:8796/api/ai/auto-local/status';
const PARENT='http://127.0.0.1:8789/api/ai/tools';
const REA='http://127.0.0.1:8797/api/rea229/status';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function hold(reason){throw Error('V42_EMBEDDED_LOCAL_'+reason)}
export function createEmbeddedLocalToolsV42({
 dashboard=createAutoLocalDashboard(),
 read=async(url)=>{throw Error('V42_READ_NOT_CONFIGURED_'+url)}
}={}){
 if(typeof dashboard?.run!=='function'||typeof dashboard?.status!=='function'||
  typeof read!=='function')hold('INVALID_DEPENDENCIES');
 let busy=false,started=0,finished=0,failed=0;
 function status(){
  return {version:'fi-v4-embedded-local-v4.2',enabled:true,busy:busy||dashboard.status().busy,
   executionPath:'8798_in_process_to_existing_8789_parent',
   legacy8796ExecutionPostUsed:false,legacy8796Retired:false,reaExecutionGrants:0,
   operatorApprovalRequired:true,backgroundExecution:false,automaticRetries:false,
   completedSessions:finished,failedSessions:failed,startedSessions:started};
 }
 async function run({prompt,rounds=2}={}){
  if(busy)hold('CONCURRENT_SESSION');
  if(typeof prompt!=='string'||prompt.length<3||prompt.length>2000||!prompt.trim()||
    rounds!==2)hold('REQUEST_INVALID');
  busy=true;started++;
  try{
   const prior=dashboard.status();
   if(prior.version!=='fi-auto-local-dashboard-v1'||prior.enabled!==true||
    prior.busy!==false||prior.reaExecutionGrants!==0||
    prior.scope!=='existing_local_registered_tools_only'||
    prior.backgroundExecution!==false)hold('ORIGINAL_LOCAL_BRIDGE_IDENTITY_CHANGED');
   // Stage 2 transitional protection. Only GET 8796 health; the embedded
   // executor no longer POSTs to 8796. Do not duplicate an active legacy run.
   const [legacy,tools]=await Promise.all([read(LOCAL),read(PARENT)]);
   if(!obj(legacy)||legacy.sidecar!==true||legacy.busy!==false||
    legacy.reaExecutionGrants!==0)hold('LEGACY_8796_BUSY_OR_IDENTITY_DRIFT');
   if(!obj(tools)||tools.local_tool_count!==19||
    ![0,229].includes(tools.rea_tool_count))hold('ORIGINAL_LOCAL_CATALOGUE_DRIFT');
   if(tools.rea_tool_count===0){
    // 8789 has not initialized its own REA session. Never assume the
    // independent 229-tool broker is ready without observing it.
    const rea=await read(REA);
    if(!obj(rea)||rea.liveMcpHealth!=='ready'||rea.realReaToolCount!==229)
     hold('INDEPENDENT_REA_CATALOGUE_NOT_VERIFIED');
   }
   const output=await dashboard.run({prompt,rounds:2});
   if(!obj(output)||output.version!=='fi-auto-local-dashboard-v1'||
    output.reaExecutionGrants!==0||!Array.isArray(output.actions)||
    output.actions.some(a=>typeof a?.tool!=='string'||!/^fi_[a-z0-9_]{2,100}$/.test(a.tool))||
    typeof output.reply!=='string')hold('LOCAL_RESULT_NEEDS_MANUAL_REVIEW_NO_RETRY');
   finished++;
   return {...output,localExecutionMode:'embedded_in_8798',legacy8796PostCount:0};
  }catch(e){failed++;throw e}finally{busy=false}
 }
 return Object.freeze({status,run});
}
