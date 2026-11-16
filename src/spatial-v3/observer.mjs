// Explicit, bounded read-only GET observations from known localhost endpoints.
// No POST, model prompt, REA, service start or background polling.
import {buildGraph} from './graph.mjs';
const SOURCES=Object.freeze([
 ['qwen',8802,'/api/fial/grounded/status'],
 ['memory',8789,'/api/ai/automatic-memory/status'],
 ['rea',8802,'/api/unified/status'],
 ['ml',8802,'/api/ml/dashboard/status'],
 ['compute-engine',8791,'/health'],
 ['buyers',8802,'/api/operator/buyer/status'],
 ['procurement',8802,'/api/operator/procurement/status'],
 ['regulatory',8802,'/api/operator/regulatory/status'],
 ['commerce',8802,'/api/commerce/status'],
 ['mobile-voice',8789,'/api/voice/mobile/status']
]);
export const OBSERVED_ENDPOINTS=SOURCES.map(([id,port,path])=>({id,port,path}));
function verified(id,d){
 if(!d||typeof d!=='object'||Array.isArray(d))return 'unverified';
 switch(id){
  case 'qwen':return d.version==='fial5.3-primary-grounded-chat-v1'&&d.state==='ready'&&d.authority_added===false?'available':'unverified';
  case 'memory':return d.memoryAvailable===true&&d.memoryWrites===false&&d.mode==='automatic_contextual_read_only'?'available':'unverified';
  case 'rea':return d.version==='fi-unified-task-chat-8798-v1'&&d.rea?.ready===true&&Number(d.rea.count)===229?'available':'unverified';
  case 'ml':return d.state==='ready'?'available':'unverified';
  case 'compute-engine':return d.state==='running'&&d.graph_engine==='networkx'&&d.tensor_engine==='quimb'&&d.neural_engine==='pytorch-cpu'?'available':'unverified';
  case 'buyers':return d.version==='fial5.13-verified-fleet-buyer-v1'&&d.boundaries?.rea_calls===0?'available':'unverified';
  case 'procurement':return d.version==='fial5.10-published-procurement-v1'&&d.boundaries?.actual_rfps_submitted===0?'available':'unverified';
  case 'regulatory':return d.version==='fial5.8-regulatory-economic-v1'&&d.boundaries?.model_calls===0?'available':'unverified';
  case 'commerce':return typeof d.version==='string'&&d.version.length>0?'available':'unverified';
  case 'mobile-voice':return d.code==='FI_VOICE_MOBILE_UPLOAD_V1'&&d.enabled===true?'available':'unverified';
  default:return 'unverified';
 }
}
async function boundedGet(port,path,fetchImpl){
 const url='http://127.0.0.1:'+port+path;
 const ctl=new AbortController();
 const timer=setTimeout(()=>ctl.abort(),2500);
 try{
  const res=await fetchImpl(url,{method:'GET',redirect:'error',signal:ctl.signal,headers:{accept:'application/json'}});
  if(!res.ok||!String(res.headers.get('content-type')||'').includes('application/json'))return null;
  const len=Number(res.headers.get('content-length')||0);
  if(len>65536)return null;
  const chunks=[];let bytes=0;
  for await(const chunk of res.body){bytes+=chunk.byteLength;if(bytes>65536)return null;chunks.push(Buffer.from(chunk))}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch{return null}finally{clearTimeout(timer)}
}
export async function observeSpatialV3(fetchImpl=fetch){
 const states=Object.create(null),evidence=[];
 await Promise.all(SOURCES.map(async([id,port,path])=>{
  const data=await boundedGet(port,path,fetchImpl);
  const state=verified(id,data);
  states[id]=state;
  evidence.push({node:id,state,source:'127.0.0.1:'+port+path});
 }));
 for(const branch of ['ai','tools','compute','business','voice']){
  const kids={'ai':['qwen','memory'],'tools':['rea'],'compute':['compute-engine','ml'],
    'business':['buyers','procurement','regulatory','commerce'],'voice':['mobile-voice']}[branch];
  states[branch]=kids.some(n=>states[n]==='available')?'available':'unverified';
 }
 states.security='unverified';states.review='unverified';states.localhost='unverified';states.gateway='unverified';states.authority='unverified';
 return {...buildGraph(states),observed_at:new Date().toISOString(),evidence:evidence.sort((a,b)=>a.node.localeCompare(b.node)),
  legend:{available:'verified local status endpoint; no business or tool authority implied',unverified:'not confirmed by this read-only check'},
  remote_execution:false,tools_called:0,model_calls:0,auto_refresh:false};
}
