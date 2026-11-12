// FI_V34_PE_SCHEMA_DIAGNOSTIC — GETs only, no file read, MCP execution or restart.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fixedJson} from '../src/experimental/unified-task-chat.mjs';
import {PE_TOOLS,createVerifiedPeInspectionV34} from '../src/experimental/verified-pe-inspection-v3-4.mjs';
export async function diagnosePe34({request=fixedJson,write=console.log}={}){
 const runner=createVerifiedPeInspectionV34({request});
 const hashes=[];
 for(const name of PE_TOOLS){
  const p=await runner.preflight({name});
  if(p.state!=='schema_compatible_file_not_probed'||p.mcpCalls!==0||
    p.executionCount!==0||p.name!==name)throw Error('V34_SCHEMA_PREFLIGHT_UNVERIFIED');
  hashes.push({name,sha256:p.schemaHash});
  write('V34_SCHEMA_TOOL='+name+' SHA256='+p.schemaHash);
 }
 write('V34_SCHEMA_PREFLIGHT=PASS EXACT_TOOLS='+PE_TOOLS.length);
 write('V34_MCP_CALLS=0 FILES_OPENED=0 APPROVAL_GRANTED=FALSE PROCESSES_MODIFIED=FALSE');
 return hashes;
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 if(process.argv.length!==3||process.argv[2]!=='--schema-only')
  console.log('V34_DIAGNOSTIC=INACTIVE. Explicit --schema-only required.');
 else{
  try{await diagnosePe34()}
  catch(e){console.error('V34_SCHEMA_PREFLIGHT_HOLD='+String(e?.message||e).slice(0,280));process.exitCode=2}
 }
}
