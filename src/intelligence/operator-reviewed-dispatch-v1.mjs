// FUN_AI_REVIEWED_REA_DISPATCH_V1
// Operator-controlled EXACT read-only tools on existing REA 8797.
// Never expose a raw MCP call from model input. Uses established V3 single-use
// token, live catalogue/schema recheck, and no automatic retries.
import {createVerifiedReaV3,v3ApprovedReadOnlyTools} from '../experimental/verified-rea-v3.mjs';

export const DISPATCH_VERSION='fun-ai-reviewed-rea-dispatch-v1';
const ROOT='http://127.0.0.1:8797';
const ALLOWED=new Set([
 ROOT+'/api/rea229/status',
 ROOT+'/api/rea229/tools?limit=229',
 ROOT+'/api/rea229/call'
]);
const hold=code=>{throw Error('FUN_REVIEWED_DISPATCH_'+code)};
const actionNames=v3ApprovedReadOnlyTools();

async function readonlyReaRequest(url,body=null){
 if(!ALLOWED.has(url))hold('OUTBOUND_NOT_ALLOWLISTED');
 if(body!==null&&url!==ROOT+'/api/rea229/call')hold('ONLY_FIXED_CALL_ACCEPTS_BODY');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),body===null?5500:18000);
 try{
  const res=await fetch(url,{method:body===null?'GET':'POST',redirect:'error',signal:controller.signal,
   headers:body===null?{'accept':'application/json'}:{'content-type':'application/json','accept':'application/json',
    'origin':ROOT,'x-fi-rea229':'operator-click'},
   ...(body===null?{}:{body:JSON.stringify(body)})});
  if(!res.ok)hold('REA_HTTP_'+res.status);
  if(!String(res.headers.get('content-type')||'').toLowerCase().includes('json'))
   hold('REA_RESPONSE_CONTENT_TYPE');
  const pieces=[];let size=0;
  for await(const part of res.body??[]){
   size+=part.length;
   if(size>512000)hold('REA_RESPONSE_TOO_LARGE');
   pieces.push(part);
  }
  let data;
  try{data=JSON.parse(Buffer.concat(pieces).toString('utf8'))}catch{hold('REA_JSON_INVALID')}
  if(!data||typeof data!=='object'||Array.isArray(data))hold('REA_NOT_OBJECT');
  return data;
 }finally{clearTimeout(timer)}
}

export function recommendReviewedTool(question){
 if(typeof question!=='string'||question.length>1200)return null;
 if(/\b(?:rea|mcp|agent)\b/i.test(question)&&/\b(?:analysis settings?|runtime settings?|analysis configuration|timeouts?|heap limits?)\b/i.test(question))
  return {name:'inspect_analysis_settings',kind:'readonly_rea_inspection',approval:'separate_prepare_and_confirm_required',
    description:'Inspect current REA analysis configuration; no changes'};
 if(/\b(?:rea|mcp|agent)\b/i.test(question)&&/\b(?:binary sessions?|provider status|available providers?|provider availability)\b/i.test(question))
  return {name:'binary_session',kind:'readonly_rea_inspection',approval:'separate_prepare_and_confirm_required',
    description:'Inspect binary analysis session/providers; no changes'};
 return null;
}

export function createReviewedDispatch({request=readonlyReaRequest}={}){
 const rea=createVerifiedReaV3({request});
 let recent=null; // Ephemeral verified read-only observation, not memory.
 return Object.freeze({
  status(){
   const s=rea.status();
   return {version:DISPATCH_VERSION,state:'review_enabled_no_autonomy',
    approvedTools:actionNames,readonlyOnly:true,
    operatorApprovalRequired:true,
    modelCanExecute:false,
    providerStatus:'not_verified_until_prepare',
    upstream:'rea_8797_independent_of_degraded_8798',
    lastReceiptHash:s.lastReceiptHash,
    pending:s.preparationPending,
    completedReadOnlyExecutions:s.completedExecutions,
    externalSideEffectAuthority:false};
  },
  prepare(body){
   recent=null;
   if(!body||typeof body!=='object'||Array.isArray(body)||
      Object.keys(body).sort().join(',')!=='arguments,name'||
      !actionNames.includes(body.name)||
      !body.arguments||typeof body.arguments!=='object'||Array.isArray(body.arguments)||
      Object.keys(body.arguments).length!==0)
    hold('PREPARE_BODY_NOT_APPROVED');
   return rea.prepare(body);
  },
  async confirm(body){
   if(!body||typeof body!=='object'||Array.isArray(body)||
      Object.keys(body).sort().join(',')!=='authorizationToken,operatorConfirmed'||
      typeof body.authorizationToken!=='string'||body.operatorConfirmed!==true)
    hold('EXPLICIT_CONFIRMATION_REQUIRED');
   const result=await rea.execute(body);
   recent=result?.state==='verified_readonly_result'&&result?.receipt?.verifiedToolIdentity===true&&result?.receipt?.verifiedResultEnvelope===true?
    Object.freeze({tool:result.receipt.tool,receiptHash:result.receipt.receiptHash,
      resultPreview:String(result.resultPreview||'').slice(0,2200),
      state:result.state,verified:true,authorization:'operator_approved_single_readonly_call'}):null;
   return result;
  },
  lastEvidence(){return recent?{...recent}:null},
  cancel(body){
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)
    hold('CANCEL_BODY_NOT_EMPTY');
   recent=null;
   return rea.cancel();
  },
  recommend:recommendReviewedTool
 });
}
