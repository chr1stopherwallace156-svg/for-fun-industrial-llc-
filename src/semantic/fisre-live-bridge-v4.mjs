// FI_FISRE_LIVE_8802_V4 — operator-click in-memory Python analysis.
// Fixed trusted script only; never run/analyze user code as executable Python.
// No new listener, REA call, persistent memory mutation, or tool authority.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createFisreEvidencePacket} from '../cognition/fisre-evidence-v3.mjs';

export const FISRE_LIVE_VERSION='fun-fisre-live-v4';
const SCRIPT=fileURLToPath(new URL('../../scripts/Run-Fun-FISRE-Live-V4.py',import.meta.url));
const MAX_IN=24000,MAX_OUT=400000,MAX_ERR=1400,TIMEOUT=20000;
const fail=x=>{throw Error('FISRE_LIVE_'+x)};
let activeWorker=false; // Single bounded analysis at a time; no background queue.

export function validateFisrePayload(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||
    Object.keys(v).length!==3||!['source','function','ranges'].every(k=>Object.hasOwn(v,k))||
    typeof v.source!=='string'||!v.source.trim()||Buffer.byteLength(v.source,'utf8')>16000||
    typeof v.function!=='string'||!v.function.trim()||v.function.length>64||
    !Array.isArray(v.ranges)||v.ranges.length<1||v.ranges.length>16||
    v.ranges.some(x=>typeof x!=='string'||x.length>220))fail('INPUT_SCHEMA_INVALID');
 return v;
}

export async function parseFisreRequest(req){
 if(req.headers['content-type']!=='application/json')fail('JSON_CONTENT_TYPE_REQUIRED');
 let total=0;const chunks=[];
 for await (const chunk of req){
  total+=chunk.length;
  if(total>MAX_IN)fail('REQUEST_TOO_LARGE');
  chunks.push(chunk);
 }
 let v;
 try{v=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{fail('INVALID_JSON')}
 return validateFisrePayload(v);
}

export function runFisrePython(payload,{spawnProcess=spawn}={}){
 return new Promise((resolve,reject)=>{
  const input=JSON.stringify(payload);
  if(Buffer.byteLength(input,'utf8')>MAX_IN)return reject(Error('FISRE_LIVE_REQUEST_TOO_LARGE'));
  if(activeWorker)return reject(Error('FISRE_LIVE_BUSY_OPERATOR_RETRY_REQUIRED'));
  activeWorker=true;
  let child,done=false,out='',err='';
  const finish=(error,value)=>{
   if(done)return;
   done=true;
   activeWorker=false;
   clearTimeout(timer);
   if(error)reject(error);else resolve(value);
  };
  let timer;
  try{
   child=spawnProcess('py',['-3.12',SCRIPT],{
    shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],
    env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1'}
   });
  }catch(e){return finish(Error('FISRE_LIVE_WORKER_START_FAILED'))}
  timer=setTimeout(()=>{
   try{child.kill()}catch{}
   finish(Error('FISRE_LIVE_WORKER_TIMEOUT'));
  },TIMEOUT);
  child.on('error',()=>finish(Error('FISRE_LIVE_PYTHON_NOT_AVAILABLE')));
  child.stdout?.on('data',chunk=>{
   out+=chunk.toString('utf8');
   if(Buffer.byteLength(out,'utf8')>MAX_OUT){
    try{child.kill()}catch{}
    finish(Error('FISRE_LIVE_OUTPUT_TOO_LARGE'));
   }
  });
  child.stderr?.on('data',chunk=>{err=(err+chunk.toString('utf8')).slice(-MAX_ERR)});
  child.on('close',code=>{
   if(done)return;
   if(code!==0){
    let reason='WORKER_HOLD';
    try{const detail=JSON.parse(err.trim());if(detail.state==='HOLD'&&typeof detail.reason==='string')reason=detail.reason.slice(0,180)}catch{}
    return finish(Error('FISRE_LIVE_'+reason));
   }
   let result;
   try{result=JSON.parse(out)}catch{return finish(Error('FISRE_LIVE_WORKER_INVALID_JSON'))}
   if(!result||result.version!==FISRE_LIVE_VERSION||
      result.state!=='SOURCE_ANALYZED_AND_REPLAYED'||
      result.source_executed!==false||result.authority_granted!==false||
      result.external_actions!==0||result.replay?.state!=='SOURCE_BOUND_REPLAY_MATCH'||
      result.replay?.independently_proved!==false||result.replay?.source_executed!==false)
    return finish(Error('FISRE_LIVE_WORKER_IDENTITY_MISMATCH'));
   let packet;
   try{packet=createFisreEvidencePacket(result.proof)}
   catch{return finish(Error('FISRE_LIVE_COGNITION_REJECTED'))}
   if(packet.proposedClaim?.status!=='proposed'||packet.authorityGranted!==false)
    return finish(Error('FISRE_LIVE_COGNITIVE_AUTHORITY_MISMATCH'));
   // Only source and proof summaries are sent to the UI; no raw submitted source,
   // no kernel persistence, and no log/write of code.
   finish(null,{
    ...result,
    cognitive:{
     state:packet.state,claim:packet.proposedClaim,
     sourceReportDigest:packet.evidence.reportDigest,
     reportVerified:packet.evidence.reportVerified,
     independentlyChecked:packet.proofIndependentlyChecked,
     persisted:packet.persistencePerformed,authorityGranted:packet.authorityGranted
    }
   });
  });
  child.stdin?.on('error',()=>{});
  child.stdin?.end(input);
 });
}

export function fisreStatus(){
 return {version:FISRE_LIVE_VERSION,state:'available_operator_click_only',
  interface:'same_origin_8802',analysis:'python_ast_affine_rational_bound_replay',
  cognitive:'proposed_claim_only',sourceExecution:false,storage:false,
  toolAuthorityAdded:false,newListener:false,externalActions:0,
  chatCodeReasoning:true,
  qwenChatIntegration:'same_8802_grounded_8088_with_fisre_evidence',
  additionalModels:0};
}
