// FI_VERIFIED_REA_EXECUTION_V3 — bounded exact-tool read-only pilot.
// Deliberately tiny allowlist. Discovery ranking is NEVER execution authority.
// A prepare token binds ONE live MCP tool name + exact empty args + schema digest.
// One separate operator click consumes it. Never auto-retries an ambiguous result.
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
const REA='http://127.0.0.1:8797';
const STATUS=REA+'/api/rea229/status';
const CATALOGUE=REA+'/api/rea229/tools?limit=229';
const CALL=REA+'/api/rea229/call';
const SAFE_TOOLS=Object.freeze(['inspect_analysis_settings','binary_session']);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const hold=code=>{throw Error('V3_'+code)};
const compact=(s,n=200)=>String(s??'').replace(/[\r\n\u0000-\u001f]+/g,' ').slice(0,n);
function equalToken(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==48||b.length!==48||
    !/^[a-f0-9]{48}$/.test(a)||!/^[a-f0-9]{48}$/.test(b))return false;
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function verifyExactEmptyArgs(args){
 // V3's verified read-only tools have no required fields. Do NOT use this
 // logic for future file/binary tools; they'll require a separate schema
 // validator, target-attestation and effect classification.
 if(!object(args)||Object.keys(args).length!==0)hold('ARGS_MUST_BE_EXACT_EMPTY_OBJECT');
}
function safeCatalogue(status,raw,name){
 if(status?.liveMcpHealth!=='ready'||status?.realReaToolCount!==229)
  hold('LIVE_REA_NOT_READY');
 if(!Array.isArray(raw?.tools)||raw.tools.length!==229)hold('LIVE_CATALOGUE_NOT_229');
 const names=new Set();
 for(const tool of raw.tools){
  if(typeof tool?.name!=='string'||names.has(tool.name))hold('LIVE_CATALOGUE_INVALID_OR_DUPLICATE');
  names.add(tool.name);
 }
 const t=raw.tools.find(x=>x.name===name);
 if(!t)hold('TOOL_ABSENT_FROM_LIVE_CATALOGUE');
 const schema=t.inputSchema;
 if(!object(schema)||schema.type!=='object'||JSON.stringify(schema).length>16000)
  hold('SCHEMA_INVALID');
 const req=schema.required??[];
 if(!Array.isArray(req)||req.length)hold('TOOL_REQUIRES_ARGUMENTS_UNSUPPORTED_IN_V3');
 // Exact {} satisfies root required=[] and carries no unknown properties.
 // Complex root constraints (allOf/oneOf/not, etc) are not supported.
 if(['allOf','anyOf','oneOf','not','$ref','if','then','else','dependentRequired','minProperties'].some(k=>Object.hasOwn(schema,k)))
  hold('COMPLEX_SCHEMA_REQUIRES_MORE_VALIDATION');
 return {name,schemaHash:hash(schema),schema,description:compact(t.description,160)};
}
export function v3ApprovedReadOnlyTools(){return [...SAFE_TOOLS]}
export function createVerifiedReaV3({request,clock=Date.now,tokenFactory=()=>randomBytes(24).toString('hex')}={}){
 if(typeof request!=='function'||typeof clock!=='function'||typeof tokenFactory!=='function')
  hold('DEPENDENCIES_MISSING');
 let pending=null,busy=false,prepared=0,executed=0,holds=0,lastReceipt=null,attempts=0;
 async function inspectLive(name){
  const [status,catalogue]=await Promise.all([request(STATUS),request(CATALOGUE)]);
  return safeCatalogue(status,catalogue,name);
 }
 function status(){
  return {version:'fi-verified-rea-v3',state:'ready_to_prepare',readOnlyPilot:true,
   approvedTools:v3ApprovedReadOnlyTools(),catalogueExpected:229,
   providerInitialization:false,externalProcessChanges:false,
   preparationPending:!!pending,completedExecutions:executed,
   preparedCount:prepared,failedOrUnverifiedAttempts:holds,
   ambiguousAttempts:attempts,busy,
   approvalRequired:true,autoExecution:false,backgroundExecution:false,
   lastReceiptHash:lastReceipt?.receiptHash??null};
 }
 async function prepare({name,arguments:args}={}){
  if(busy)hold('BUSY');
  // A new preparation attempt invalidates any earlier review, including
  // when the new candidate fails validation.
  pending=null;
  if(typeof name!=='string'||!SAFE_TOOLS.includes(name))hold('TOOL_NOT_IN_REVIEWED_READONLY_ALLOWLIST');
  verifyExactEmptyArgs(args);
  busy=true;
  try{
   const item=await inspectLive(name);
   const nonce=tokenFactory();
   if(typeof nonce!=='string'||!/^[a-f0-9]{48}$/.test(nonce))hold('TOKEN_GENERATION_INVALID');
   const validUntil=clock()+120000;
   pending=Object.freeze({nonce,name,schemaHash:item.schemaHash,
    argumentHash:hash({}),validUntil,preparedAt:clock()});
   prepared++;
   return {
    version:'fi-verified-rea-v3',state:'awaiting_separate_operator_confirmation',
    authorizationToken:nonce,expiresAtUnixMs:validUntil,
    preview:{name,source:'rea_mcp_8797',arguments:{},schemaHash:item.schemaHash,
     argumentsHash:hash({}),description:item.description,
     liveMcpSessionReady:true,toolPresentInLiveCatalogue:true,
     specificProviderUsability:'not_proven_until_call',
     executionScope:'one_exact_readonly_tool_call',sideEffects:'read_only_allowlisted',
     requiresSeparateOperatorClick:true,actualToolCalls:0},
    executedActions:0,approvalGranted:false
   };
  }finally{busy=false}
 }
 async function execute({authorizationToken,operatorConfirmed}={}){
  if(busy)hold('BUSY');
  if(operatorConfirmed!==true)hold('OPERATOR_CONFIRMATION_REQUIRED');
  if(!pending||!equalToken(authorizationToken,pending.nonce))hold('NO_MATCHING_LIVE_PREPARATION');
  const item=pending;
  // Single-use, never replay, even if preflight or transport subsequently fails.
  pending=null;
  if(clock()>item.validUntil){holds++;hold('PREPARATION_EXPIRED_NO_CALL')}
  busy=true;
  try{
   let live;
   try{live=await inspectLive(item.name)}
   catch(e){holds++;return {version:'fi-verified-rea-v3',
    state:'preflight_hold_no_execution',reason:compact(e?.message),
    executedActions:0,approvalGranted:true,tokenConsumed:true,requestSubmitted:false}}
   if(live.schemaHash!==item.schemaHash){
    holds++;return {version:'fi-verified-rea-v3',
     state:'schema_changed_no_execution',executedActions:0,
     approvalGranted:true,tokenConsumed:true,requestSubmitted:false};
   }
   if(clock()>item.validUntil){holds++;return {version:'fi-verified-rea-v3',
    state:'expired_before_call_no_execution',executedActions:0,
    approvalGranted:true,tokenConsumed:true,requestSubmitted:false}}
   // The original 8797 runner returns {tool,result}. Do not let a model
   // decide arguments; this request carries the exact operator-reviewed {}.
   let res;
   try{
    attempts++;
    res=await request(CALL,{name:item.name,arguments:{}});
   }catch(e){
    holds++;
    return {version:'fi-verified-rea-v3',state:'outcome_unverified_do_not_retry',
     tool:item.name,requestSubmitted:true,executedActions:'unknown',
     approvalGranted:true,tokenConsumed:true,reason:compact(e?.message),
     retryPolicy:'new_review_and_manual_check_required'};
   }
   const toolMatches=res?.tool===item.name;
   // A successful HTTP request alone does not prove a tool produced evidence.
   // Accept actual MCP structured data or a nonempty content array only.
   const hasEvidence=object(res?.result?.structuredContent)||
    (Array.isArray(res?.result?.content)&&res.result.content.length>0);
   const resultValid=object(res?.result)&&res.result.isError!==true&&hasEvidence;
   const raw=object(res?.result)?res.result:null;
   const resultDigest=hash(raw);
   const receipt={
    version:'fi-verified-rea-v3',tool:item.name,source:'real_rea_mcp_8797',
    schemaHash:item.schemaHash,argumentsHash:item.argumentHash,
    resultHash:resultDigest,
    completedAtUnixMs:clock(),
    verifiedToolIdentity:toolMatches,verifiedResultEnvelope:resultValid,
    operatorApproved:true,tokenConsumed:true,
    automaticRetries:0,
    state:toolMatches&&resultValid?'verified_readonly_result':'result_hold_verify_manually'
   };
   receipt.receiptHash=hash(receipt);
   lastReceipt=Object.freeze({...receipt});
   if(receipt.state==='verified_readonly_result')executed++;
   else holds++;
   return {version:'fi-verified-rea-v3',state:receipt.state,
    executedActions:toolMatches&&resultValid?1:'unverified',
    approvalGranted:true,requestSubmitted:true,tokenConsumed:true,
    resultPreview:compact(JSON.stringify(raw),4200),receipt};
  }finally{busy=false}
 }
 function cancel(){
  pending=null;
  return {version:'fi-verified-rea-v3',state:'approval_cancelled_no_execution',
   executedActions:0,approvalGranted:false};
 }
 return Object.freeze({prepare,execute,status,cancel});
}
