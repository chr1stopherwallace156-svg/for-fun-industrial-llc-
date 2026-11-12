// FI_V31_SCHEMA_PREFLIGHT — zero MCP tool calls, files, writes or restarts.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createVerifiedFileV31} from '../src/experimental/verified-file-v3-1.mjs';
import {fixedJson} from '../src/experimental/unified-task-chat.mjs';
export async function diagnoseV31({request=fixedJson,write=console.log}={}){
 const runner=createVerifiedFileV31({request});
 const p=await runner.preflight();
 if(p.state!=='schema_compatible_file_not_probed'||p.executionCount!==0)
  throw Error('V31_SCHEMA_PREFLIGHT_UNVERIFIED');
 write('V31_SCHEMA_PREFLIGHT=PASS');
 write('V31_TOOL='+p.tool);
 write('V31_SCHEMA_SHA256='+p.schemaHash);
 write('V31_APPROVED_INPUT_ROOT='+p.approvedDirectory);
 write('V31_REQUIRED_ARGUMENTS='+p.requiredArguments.join(','));
 write('V31_PROVIDER_USABILITY='+p.specificProvider);
 write('V31_FILES_OPENED=0 MCP_CALLS=0 APPROVAL_GRANTED=false');
 write('V31_RUNNING_SERVICES_UNCHANGED=TRUE');
 return p;
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 if(process.argv.length!==3||process.argv[2]!=='--schema-only')
  console.log('V31_DIAG=INACTIVE. Explicit --schema-only required.');
 else{
  try{await diagnoseV31()}
  catch(error){
   console.error('V31_SCHEMA_HOLD='+String(error?.message||error).slice(0,260));
   process.exitCode=2;
  }
 }
}
