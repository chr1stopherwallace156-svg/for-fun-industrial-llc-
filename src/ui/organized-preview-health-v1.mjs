// Read-only check of the existing local Qwen worker. No model inference, new process, or polling.
export const PREVIEW_HEALTH_VERSION='fun-ui-preview-qwen-health-v1';
export async function previewQwenHealth({fetchImpl=fetch,timeoutMs=1800}={}){
 const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeoutMs);
 try{
  const res=await fetchImpl('http://127.0.0.1:8088/health',{
   method:'GET',redirect:'error',cache:'no-store',
   headers:{accept:'application/json'},signal:ctl.signal
  });
  if(!res.ok)return {version:PREVIEW_HEALTH_VERSION,state:'NOT_VERIFIED',ready:false,modelStart:false};
  const length=Number(res.headers?.get?.('content-length')||0);
  if(length>1024)return {version:PREVIEW_HEALTH_VERSION,state:'NOT_VERIFIED',ready:false,modelStart:false};
  const response=await res.text();
  if(response.length>1024)throw Error('HEALTH_RESPONSE_OVERSIZE');
  const obj=JSON.parse(response);
  const ready=obj&&obj.status==='ok';
  return {version:PREVIEW_HEALTH_VERSION,state:ready?'READY':'NOT_VERIFIED',ready,modelStart:false};
 }catch{
  return {version:PREVIEW_HEALTH_VERSION,state:'OFFLINE_OR_UNVERIFIED',ready:false,modelStart:false};
 }finally{clearTimeout(t)}
}