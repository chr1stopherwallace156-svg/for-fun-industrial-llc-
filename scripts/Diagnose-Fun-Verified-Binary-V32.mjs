// FI_V32_SCHEMA_PREFLIGHT — zero MCP tool calls, files, writes or restarts.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createVerifiedBinaryLayoutV32} from '../src/experimental/verified-binary-layout-v3-2.mjs';
import {fixedJson} from '../src/experimental/unified-task-chat.mjs';
export async function diagnoseV32({request=fixedJson,write=console.log}={}){
 const runner=createVerifiedBinaryLayoutV32({request});
 const p=await runner.preflight();
 if(p.state!=='schema_compatible_file_not_probed'||p.executionCount!==0)
  throw Error('V32_SCHEMA_PREFLIGHT_UNVERIFIED');
 write('V32_SCHEMA_PREFLIGHT=PASS');
 write('V32_TOOL='+p.tool);
 write('V32_SCHEMA_SHA256='+p.schemaHash);
 write('V32_APPROVED_INPUT_ROOT='+p.approvedDirectory);
 write('V32_REQUIRED_ARGUMENTS='+p.requiredArguments.join(','));
 write('V32_PROVIDER_USABILITY='+p.specificProvider);
 write('V32_FILES_OPENED=0 MCP_CALLS=0 APPROVAL_GRANTED=false');
 write('V32_RUNNING_SERVICES_UNCHANGED=TRUE');
 return p;
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 if(process.argv.length!==3||process.argv[2]!=='--schema-only')
  console.log('V32_DIAG=INACTIVE. Explicit --schema-only required.');
 else{
  try{await diagnoseV32()}
  catch(error){
   console.error('V32_SCHEMA_HOLD='+String(error?.message||error).slice(0,260));
   process.exitCode=2;
  }
 }
}
