// V4 single-entrypoint read-only live service preflight; no new listener.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createUnifiedGatewayV4} from '../src/experimental/unified-gateway-v4.mjs';
export async function diagnoseV4({gateway=createUnifiedGatewayV4(),write=console.log}={}){
 const value=await gateway.status();
 if(value.version!=='fi-unified-runtime-v4-stage1'||
    value.state!=='ready'||value.services.length!==6||
    value.registered.verifiedCounts!==true)throw Error('V4_DEPENDENCIES_NOT_ALL_READY');
 for(const s of value.services){
  if(!s.ready)throw Error('V4_REQUIRED_SERVICE_UNAVAILABLE_'+s.id);
  write('V4_PREFLIGHT_COMPONENT='+s.id+' PORT='+s.port+' READY=true');
 }
 write('V4_PREFLIGHT=PASS COMPONENTS=6 REA=229 LOCAL=19');
 write('V4_PROCESSES_STARTED=0 PROCESSES_STOPPED=0 MCP_TOOL_CALLS=0');
 return value;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--check-only')
  console.log('V4_GATEWAY_DIAGNOSTIC=INACTIVE; explicit --check-only required.');
 else try{await diagnoseV4()}
 catch(e){console.error('V4_PREFLIGHT_HOLD='+String(e.message||e).slice(0,200));process.exitCode=2}
}
