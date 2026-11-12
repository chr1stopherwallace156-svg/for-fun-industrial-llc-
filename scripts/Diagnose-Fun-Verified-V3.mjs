// FI_VERIFIED_REA_V3_PREFLIGHT
// Operator-initiated, prepare-only live REA schema qualification.
// Never sends /api/rea229/call or /run, or touches services or files.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createVerifiedReaV3} from '../src/experimental/verified-rea-v3.mjs';
import {fixedJson} from '../src/experimental/unified-task-chat.mjs';

export async function diagnoseVerifiedV3({request=fixedJson,write=console.log}={}){
 const pilot=createVerifiedReaV3({request});
 const plan=await pilot.prepare({name:'inspect_analysis_settings',arguments:{}});
 if(plan?.preview?.name!=='inspect_analysis_settings'||
  plan.preview.liveMcpSessionReady!==true||plan.executedActions!==0)
   throw Error('V3_PREPARATION_VERIFICATION_INVALID');
 write('V3_PREFLIGHT=PASS');
 write('V3_TOOL='+plan.preview.name);
 write('V3_SCHEMA_SHA256='+plan.preview.schemaHash);
 write('V3_ARGUMENTS_SHA256='+plan.preview.argumentsHash);
 write('V3_PROVIDER_USABILITY='+plan.preview.specificProviderUsability);
 write('V3_PREPARED_ACTIONS=0');
 write('V3_APPROVAL_GRANTED=false');
 write('V3_NO_TOOL_CALLS=TRUE');
 write('V3_PROTECTED_SERVICES_UNCHANGED=TRUE');
 pilot.cancel();
 return plan;
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 if(process.argv.length!==3||process.argv[2]!=='--prepare-only'){
  console.log('V3_DIAGNOSTIC=INACTIVE. Explicit --prepare-only required.');
 }else{
  try{await diagnoseVerifiedV3()}
  catch(e){
   console.error('V3_PREFLIGHT_HOLD='+String(e?.message||e).slice(0,240));
   process.exitCode=2;
  }
 }
}
