// Read-only, bounded source compatibility diagnostic for the deployed 8789 dashboard.
// Outputs ONLY code anchor counts and structural shapes; no user data, credentials,
// full source text, network access, process action, or file mutations.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {patchCognitiveLiveServer} from './patch-cognitive-live.mjs';
const count=(s,needle)=>s.split(needle).length-1;
const markers=[
 'FI_AUTO_COGNEE_CHAT_V1','FI_SECURITY_PRIMARY_8789_V1',
 'FI_SOURCING_RETIRED_V1','FI_VOICE_MOBILE_DASHBOARD_V1',
 '/api/rea/call','/api/ai/tool-call','/api/ai/chat',
 '/api/ai/automatic-memory/status'
];
export function diagnoseSource(source) {
 if(typeof source!=='string') throw Error('COGNITION_DIAG_INPUT_INVALID');
 const root='const root=path.dirname(fileURLToPath(import.meta.url));';
 const server='const server=http.createServer(async(req,res)=>{try{';
 const memory='const enriched=await fiAutomaticMemory(body,memoryStatus().enabled);';
 const declaration=/\b(const|let)\s+([a-zA-Z_$][\w$]*)\s*=\s*await\s+fiAutomaticMemory\s*\(/g;
 const decs=[...source.matchAll(declaration)].slice(0,10).map(m=>({form:m[1],name:m[2]}));
 const result={
  type:'FUN_COGNITION_ANCHOR_DIAGNOSTIC_V1',
  readOnly:true, sourceBytes:Buffer.byteLength(source,'utf8'),
  protectedMarkers:Object.fromEntries(markers.map(m=>[m,count(source,m)])),
  anchors:{
   rootExact:count(source,root),
   serverExact:count(source,server),
   memoryExact:count(source,memory),
   memoryCallCount:(source.match(/\bfiAutomaticMemory\s*\(/g)||[]).length,
   memoryDeclarations:decs,
   proxyOriginal:count(source,'return proxyCompute(req,res,"/ai/chat","POST",enriched.payload);'),
   webModelPayload:count(source,'modelPayload:enriched.payload'),
   installedMarker:count(source,'FI_COGNITIVE_LIVE_PATCH_V1'),
  },
  patchStatus:'UNKNOWN',reason:null
 };
 try {patchCognitiveLiveServer(source);result.patchStatus='COMPATIBLE';}
 catch(e){result.patchStatus='HOLD';result.reason=String(e.message||e).slice(0,180);}
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)throw Error('USAGE: node scripts/diagnose-cognitive-live.mjs ABSOLUTE_LIVE_SERVER_PATH');
  const source=readFileSync(process.argv[2],'utf8');
  console.log(JSON.stringify(diagnoseSource(source),null,2));
 }catch(e){console.error('FUN_COGNITION_DIAG_HOLD='+String(e.message||e).slice(0,180));process.exitCode=1;}
}
