// FI_ML_DASHBOARD_V3: fixed local ML bridge for existing Fun Industrial dashboards.
// No arbitrary URLs, shell, REA access, background actions, or permission expansion.
import {readFile} from 'node:fs/promises';
const ML='http://127.0.0.1:8801';
const ROUTES=Object.freeze({status:ML+'/api/ml/status',run:ML+'/api/ml/run'});
const MAX_BODY=220000,MAX_RESULT=512000;
export const ML_WIDGET=new URL('./dashboard-ml-widget-v3.js',import.meta.url);
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const schemas=Object.freeze({
  deals:{min:8,max:250,fields:['id','cost','sale_price','shipping','fees','return_allowance']},
  history:{min:16,max:1000,fields:['visits','price','ad_spend','units_sold']},
  candidates:{min:1,max:100,fields:['visits','price','ad_spend']}
});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function validateDashboardMlPayload(value){
  if(!obj(value)||Object.keys(value).some(k=>!['prompt','data','operatorConfirmed'].includes(k))||
    typeof value.prompt!=='string'||value.prompt.length<4||value.prompt.length>1000||
    !obj(value.data)||Object.keys(value.data).length!==1||
    (value.operatorConfirmed!==undefined&&typeof value.operatorConfirmed!=='boolean'))
    throw Error('ML_DASHBOARD_PAYLOAD_INVALID');
  const key=Object.keys(value.data)[0],schema=schemas[key];
  if(!schema)throw Error('ML_DASHBOARD_DATA_SCHEMA_INVALID');
  const records=value.data[key];
  if(!Array.isArray(records)||records.length<schema.min||records.length>schema.max)
    throw Error('ML_DASHBOARD_RECORD_COUNT_INVALID');
  const ids=new Set();
  for(const rec of records){
    if(!obj(rec)||Object.keys(rec).length!==schema.fields.length||
       !schema.fields.every(k=>own(rec,k)))throw Error('ML_DASHBOARD_FIELDS_INVALID');
    if(key==='deals'){
      if(typeof rec.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(rec.id)||ids.has(rec.id))
        throw Error('ML_DASHBOARD_DEAL_ID_INVALID');
      ids.add(rec.id);
    }
    for(const field of schema.fields.filter(x=>x!=='id')){
      const val=rec[field],max=['visits','units_sold'].includes(field)?1e7:1e6;
      if(typeof val!=='number'||!Number.isFinite(val)||val<0||val>max)
        throw Error('ML_DASHBOARD_NUMBER_INVALID');
    }
  }
  if(key==='history'&&value.operatorConfirmed!==true)throw Error('ML_DASHBOARD_TRAIN_APPROVAL_REQUIRED');
  if(Buffer.byteLength(JSON.stringify(value),'utf8')>MAX_BODY)throw Error('ML_DASHBOARD_BYTES_EXCEEDED');
  return value;
}
export async function readMlJson(url,body=null,{fetchImpl=fetch}={}){
  if(!Object.values(ROUTES).includes(url))throw Error('ML_DASHBOARD_URL_DENIED');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),body===null?3500:100000);
  try{
    const response=await fetchImpl(url,{
      method:body===null?'GET':'POST',redirect:'error',signal:controller.signal,
      headers:body===null?{accept:'application/json'}:{
        'content-type':'application/json','x-fi-ml':'operator-click',origin:ML
      },
      body:body===null?undefined:JSON.stringify(body)
    });
    const ctype=response.headers.get('content-type')||'';
    if(!ctype.toLowerCase().includes('application/json'))throw Error('ML_DASHBOARD_RESPONSE_NOT_JSON');
    const declared=Number(response.headers.get('content-length'));
    if(Number.isFinite(declared)&&declared>MAX_RESULT)throw Error('ML_DASHBOARD_RESPONSE_EXCESS');
    let bytes=0;const chunks=[];
    for await(const chunk of response.body){
      bytes+=chunk.length;if(bytes>MAX_RESULT)throw Error('ML_DASHBOARD_RESPONSE_EXCESS');
      chunks.push(chunk);
    }
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!obj(value))throw Error('ML_DASHBOARD_RESULT_INVALID');
    if(!response.ok)throw Error('ML_DASHBOARD_UPSTREAM_'+response.status+':'+String(value.error||'UNAVAILABLE').slice(0,90));
    return value;
  }finally{clearTimeout(timeout)}
}
export function createMlDashboardBridge({read=readMlJson,widget=()=>readFile(ML_WIDGET,'utf8')}={}){
  if(typeof read!=='function'||typeof widget!=='function')throw Error('ML_DASHBOARD_ADAPTER_INVALID');
  return Object.freeze({
    async status(){
      try{
        const value=await read(ROUTES.status);
        if(value.version!=='fun-qwen-scikit-v2'||value.pythonInstalled!==true||
           value.reaExecutionGrants!==0||value.externalActions!==0)throw Error('ML_IDENTITY_MISMATCH');
        return {state:'ready',bridge:'fun-ml-dashboard-v3',port:8801,capabilities:value.capabilities,
          trainingRequiresReview:true,externalActions:0};
      }catch(e){return {state:'unavailable',bridge:'fun-ml-dashboard-v3',port:8801,
        reason:String(e.message||e).slice(0,110),externalActions:0}}
    },
    async run(body){
      const verified=validateDashboardMlPayload(body);
      const result=await read(ROUTES.run,verified);
      if(result.state!=='completed'||result.route!=='automatic_verified_ml'||
         result.externalActions!==0||!obj(result.verifiedML)||
         result.verifiedML.ok!==true||result.verifiedML.external_actions!==0)
        throw Error('ML_DASHBOARD_RESULT_ATTESTATION_FAILED');
      return result;
    },
    widget
  });
}
export async function parseMlDashboardBody(req){
  let bytes=0;const chunks=[];
  for await (const part of req){
    bytes+=part.length;
    if(bytes>MAX_BODY)throw Error('ML_DASHBOARD_REQUEST_TOO_LARGE');
    chunks.push(part);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
  catch{throw Error('ML_DASHBOARD_JSON_INVALID')}
}
// A dashboard browser click is required. The existing authenticated HTTPS
// gateway strips Origin before forwarding but supplies these fixed headers.
export function mlDashboardOriginAccepted(req,port){
  if(req.headers['x-fi-ml']!=='operator-click')return false;
  const o=String(req.headers.origin||'');
  if(o==='http://127.0.0.1:'+port||o==='http://localhost:'+port)return true;
  if(port===8789&&o===''&&
      req.headers['x-forwarded-host']==='100.109.4.20:8443'&&
      req.headers['x-forwarded-proto']==='https'&&
      req.headers['x-forwarded-for']==='100.109.87.100')return true;
  return false;
}
