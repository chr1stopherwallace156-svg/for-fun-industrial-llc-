// FI_V4_GATEWAY_STAGE1 — one 8798 read-only overview of existing internal services.
// This module NEVER binds new ports, launches workers, executes tools, retries
// side effects, changes permissions, or claims that sidecars have been retired.
const ENDPOINTS=Object.freeze({
 parent:'http://127.0.0.1:8789/api/ai/status',
 catalogue:'http://127.0.0.1:8789/api/ai/tools',
 local:'http://127.0.0.1:8796/api/ai/auto-local/status',
 rea:'http://127.0.0.1:8797/api/rea229/status',
 qwen:'http://127.0.0.1:8088/health',
 compute:'http://127.0.0.1:8791/health'
});
const allowed=new Set(Object.values(ENDPOINTS));
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const bounded=s=>String(s??'').slice(0,80);
const VALID_HEALTH=new Set(['ok','ready','running','healthy']);
export async function fixedGatewayGetV4(url,{timeoutMs=2500,maxBytes=1024*1024}={}){
 if(!allowed.has(url))throw Error('V4_UPSTREAM_NOT_ALLOWLISTED');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000 ||
  !Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>2*1024*1024)
  throw Error('V4_READ_BOUNDS_INVALID');
 const response=await fetch(url,{method:'GET',redirect:'error',
  signal:AbortSignal.timeout(timeoutMs),headers:{accept:'application/json'}});
 if(!response.ok||!String(response.headers.get('content-type')||'').toLowerCase().includes('application/json'))
  throw Error('V4_UPSTREAM_UNAVAILABLE');
 const length=Number(response.headers.get('content-length'));
 if(Number.isFinite(length)&&length>maxBytes)throw Error('V4_RESPONSE_TOO_LARGE');
 const chunks=[];let total=0;
 for await(const chunk of response.body){
  total+=chunk.length;
  if(total>maxBytes){await response.body.cancel?.().catch(()=>{});throw Error('V4_RESPONSE_TOO_LARGE')}
  chunks.push(chunk);
 }
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!object(value))throw Error('V4_INVALID_JSON_OBJECT');
 return value;
}
export function createUnifiedGatewayV4({read=fixedGatewayGetV4}={}){
 if(typeof read!=='function')throw Error('V4_READ_ADAPTER_REQUIRED');
 let inflight=null;
 async function status(){
  // One in-flight snapshot per gateway instance; no polling, timers or loops.
  if(inflight)return inflight;
  inflight=(async()=>{
   const entries=Object.entries(ENDPOINTS);
   const settled=await Promise.allSettled(entries.map(([,url])=>read(url)));
   const response={};const observed={};
   for(let i=0;i<entries.length;i++){
    const name=entries[i][0],item=settled[i];
    observed[name]=item.status==='fulfilled'&&object(item.value);
    response[name]=observed[name]?item.value:null;
   }
   const parentReady=observed.parent&&observed.catalogue;
   const reaCount=response.catalogue?.rea_tool_count;
   const localCount=response.catalogue?.local_tool_count;
   const localReady=observed.local&&response.local.sidecar===true&&
    response.local.reaExecutionGrants===0;
   const reaReady=observed.rea&&response.rea.liveMcpHealth==='ready'&&
    response.rea.realReaToolCount===229&&response.rea.busy===false;
   const qwenReachable=observed.qwen&&['ok','ready'].includes(String(response.qwen?.status??''));
   // The parent 8789 can be healthy while its old AI manager reports stopped
   // because Qwen was started independently. Likewise the old parent MCP
   // registry may be empty while 8797 validates all 229 live definitions.
   const countReady=parentReady&&localCount===19&&
    (reaCount===229||(reaCount===0&&reaReady));
   const computeReady=observed.compute&&VALID_HEALTH.has(
    String(response.compute.status??response.compute.state??'').toLowerCase());
   const entryReady=true; // This endpoint is served by the existing 8798 instance.
   const services=[
    {id:'gateway',port:8798,kind:'user_facing',ready:entryReady,source:'current_8798_http_request'},
    {id:'original_dashboard',port:8789,kind:'legacy_internal',ready:parentReady,
     source:'read_only_http_status'},
    {id:'local_tools',port:8796,kind:'legacy_internal',ready:localReady,
     expectedTools:19,source:'read_only_http_status_and_parent_catalogue'},
    {id:'rea_mcp',port:8797,kind:'legacy_internal',ready:reaReady,
     expectedTools:229,source:'read_only_http_status'},
    {id:'qwen_llama_cpp',port:8088,kind:'isolated_worker',
     ready:qwenReachable,source:'direct_llama_cpp_health'},
    {id:'python_compute',port:8791,kind:'isolated_worker',
     ready:computeReady,source:'read_only_http_health'}
   ];
   return {
    version:'fi-unified-runtime-v4-stage1',
    phase:'single_entrypoint_read_only_gateway',
    entrypoint:'http://127.0.0.1:8798/',
    state:services.every(x=>x.ready)&&countReady?'ready':'degraded',
    services,registered:{rea:reaReady?229:reaCount??null,
     local:localCount??null,
     parentReaRegistered:reaCount??null,
     verifiedCounts:!!countReady},
    componentsStillSeparate:true,legacyPortsRetired:[],
    workerProcessMemorySavingsVerified:false,ramSavingsClaimed:false,
    restartPerformed:false,toolExecutionsPerformed:0,approvalGrantsCreated:0,
    noBackgroundMonitoring:true,operatorApprovalsUnchanged:true,
    nextStage:'gradual_adapter_embedding_then_legacy_retirement_only_after_independent_qualification'
   };
  })();
  try{return await inflight}finally{inflight=null}
 }
 return Object.freeze({status});
}
