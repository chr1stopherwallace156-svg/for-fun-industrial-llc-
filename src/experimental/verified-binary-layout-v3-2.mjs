/**
 * V3.2 isolated pilot: only inspect_binary_layout with canonical path.
 * Full canonical provider validation remains in 8797. No other tool permitted.
 * A completed MCP envelope verifies transmission, NOT correctness or lack of
 * provider-side temporary artifacts. This component never launches the binary.
 */
// FI_VERIFIED_BINARY_LAYOUT_V32 — exact, staged PE/ELF read-only layout examination.
// Independent of the V3.2 Rust inspection pilot. Never accesses arbitrary filesystem paths,
// creates files, starts providers, or invokes an MCP tool without a new approval.
import os from 'node:os';
import path from 'node:path';
import {constants as fsConstants} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';

const REA='http://127.0.0.1:8797';
const READ_STATUS=REA+'/api/rea229/status';
const READ_TOOLS=REA+'/api/rea229/tools?limit=229';
const CALL=REA+'/api/rea229/call';
const NAME='inspect_binary_layout';
const MAX_BYTES=64*1024*1024;
const SAFE_EXTENSIONS=new Set(['.exe','.dll','.elf','.so','.bin']);
const rootDefault=()=>path.join(os.homedir(),'FunIndustrial-Approved-Inputs');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('V32_'+x)};
const short=(x,n=240)=>String(x??'').replace(/[\x00-\x1f\x7f]+/g,' ').slice(0,n);
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{48}$/.test(a)&&
 /^[a-f0-9]{48}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const nativeCase=s=>process.platform==='win32'?String(s).toLowerCase():String(s);
function validateFilename(value){
 if(typeof value!=='string'||value.length>800||!value.trim()||
    value.includes('\0')||value.startsWith('\\\\')||value.startsWith('//'))fail('PATH_INVALID');
 const base=path.basename(value);
 if(base==='.'||base==='..'||!(/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(base))||
    !SAFE_EXTENSIONS.has(path.extname(base).toLowerCase()))fail('BASENAME_OR_EXTENSION_NOT_ALLOWLISTED');
 return base;
}
function fingerprintEqual(a,b){
 return a&&b&&a.sha256===b.sha256&&a.bytes===b.bytes&&
  nativeCase(a.path)===nativeCase(b.path)&&a.fileIdentity===b.fileIdentity;
}
function strictPathSchema(schema){
 if(!obj(schema)||schema.type!=='object'||JSON.stringify(schema).length>16000)
  fail('SCHEMA_INVALID');
 // The full JSON Schema language is not interpreted by this pilot. All
 // unknown assertions are REFUSED, not silently ignored.
 const rootKeys=new Set(['$schema','title','description','type','properties','required','additionalProperties','$id']);
 if(Object.keys(schema).some(k=>!rootKeys.has(k)))fail('UNSUPPORTED_ROOT_SCHEMA_CONSTRAINT');
 if(!Array.isArray(schema.required)||schema.required.length!==1||schema.required[0]!=='path')
  fail('EXACT_PATH_REQUIREMENT_MISSING');
 if(!obj(schema.properties)||!obj(schema.properties.path)||schema.properties.path.type!=='string')
  fail('PATH_SCHEMA_NOT_STRING');
 const pathSchema=schema.properties.path;
 const safePathKeys=new Set(['type','title','description','minLength','maxLength']);
 if(Object.keys(pathSchema).some(k=>!safePathKeys.has(k)))
  fail('UNSUPPORTED_PATH_SCHEMA_CONSTRAINT');
 if(pathSchema.minLength!==undefined&&(!Number.isSafeInteger(pathSchema.minLength)||pathSchema.minLength<0))
  fail('MIN_LENGTH_INVALID');
 if(pathSchema.maxLength!==undefined&&(!Number.isSafeInteger(pathSchema.maxLength)||pathSchema.maxLength<1))
  fail('MAX_LENGTH_INVALID');
 if(schema.additionalProperties!==undefined&&schema.additionalProperties!==false&&schema.additionalProperties!==true)
  fail('ADDITIONAL_PROPERTIES_SCHEMA_UNSUPPORTED');
 for(const [key,val] of Object.entries(schema.properties)){
  if(key!=='path'&&!obj(val))fail('NONPATH_PROPERTY_SCHEMA_INVALID');
  // Future optional parameters remain unprovided; if constraints elsewhere
  // require them we would have rejected that schema at the root.
 }
 return {schemaHash:hash(schema),min:pathSchema.minLength??0,max:pathSchema.maxLength??800};
}
function liveExact(status,catalogue){
 if(status?.liveMcpHealth!=='ready'||status?.realReaToolCount!==229)
  fail('REA_MCP_UNAVAILABLE');
 if(!Array.isArray(catalogue?.tools)||catalogue.tools.length!==229)
  fail('CATALOGUE_NOT_229');
 const names=new Set();
 for(const t of catalogue.tools){
  if(typeof t?.name!=='string'||names.has(t.name))fail('CATALOGUE_DUPLICATE_OR_INVALID');
  names.add(t.name);
 }
 const tool=catalogue.tools.find(t=>t.name===NAME);
 if(!tool)fail('EXACT_TOOL_NOT_REGISTERED');
 return strictPathSchema(tool.inputSchema);
}
export async function probeApprovedLayoutBinary(filePath,{root=rootDefault()}={}){
 const basename=validateFilename(filePath);
 if(typeof root!=='string'||!path.isAbsolute(root))fail('APPROVED_ROOT_INVALID');
 const rootResolved=path.resolve(root),wanted=path.isAbsolute(filePath)?path.resolve(filePath):path.resolve(rootResolved,filePath);
 if(nativeCase(path.dirname(wanted))!==nativeCase(rootResolved)||path.basename(wanted)!==basename)
  fail('PATH_OUTSIDE_APPROVED_ROOT');
 const rootStat=await lstat(rootResolved).catch(()=>fail('APPROVED_ROOT_MISSING'));
 if(!rootStat.isDirectory()||rootStat.isSymbolicLink())fail('APPROVED_ROOT_NOT_REAL_DIRECTORY');
 const trueRoot=await realpath(rootResolved);
 // Windows may canonicalize the drive or ancestor path differently from
 // its original spelling. Trust only the real resolved parent of the fixed
 // approved root; never permit a target whose own real parent differs.
 const stat=await lstat(wanted).catch(()=>fail('APPROVED_FILE_MISSING'));
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail('NOT_SINGLE_REGULAR_FILE');
 if(!Number.isSafeInteger(stat.size)||stat.size<4||stat.size>MAX_BYTES)
  fail('SIZE_OUTSIDE_LIMIT');
 const absolute=await realpath(wanted);
 if(nativeCase(path.dirname(absolute))!==nativeCase(trueRoot)||path.basename(absolute)!==basename)
  fail('TARGET_REDIRECTED');
 const fd=await open(wanted,fsConstants.O_RDONLY|(fsConstants.O_NOFOLLOW||0));
 try{
  const handleStat=await fd.stat();
  if(!handleStat.isFile()||handleStat.size!==stat.size||
    (handleStat.ino&&stat.ino&&handleStat.ino!==stat.ino)||
    (handleStat.dev&&stat.dev&&handleStat.dev!==stat.dev))
   fail('FILE_IDENTITY_CHANGED');
  const header=Buffer.alloc(4);
  const {bytesRead}=await fd.read(header,0,4,0);
  if(bytesRead!==4||!(header.subarray(0,2).toString('hex')==='4d5a'||
    header.toString('hex')==='7f454c46'))fail('NOT_PE_OR_ELF_STATIC_BINARY');
  const digest=createHash('sha256');
  let count=0;
  for await(const chunk of fd.createReadStream({start:0,autoClose:false})){
   count+=chunk.length;
   if(count>MAX_BYTES)fail('BINARY_SIZE_CHANGED_DURING_READ');
   digest.update(chunk);
  }
  const finish=await fd.stat();
  if(count!==stat.size||finish.size!==stat.size||finish.mtimeMs!==stat.mtimeMs||
   finish.ctimeMs!==stat.ctimeMs)fail('BINARY_CHANGED_DURING_HASH');
  return Object.freeze({
   path:absolute,name:basename,bytes:count,sha256:digest.digest('hex'),
   fileIdentity:String(finish.dev)+':'+String(finish.ino),
   format:header.toString('hex')==='7f454c46'?'ELF':'PE',
   root:trueRoot
  });
 }finally{await fd.close()}
}
export function createVerifiedBinaryLayoutV32({
 request,probe=probeApprovedLayoutBinary,clock=Date.now,
 tokenFactory=()=>randomBytes(24).toString('hex'),root=rootDefault()
}={}){
 if(typeof request!=='function'||typeof probe!=='function'||typeof clock!=='function'||
   typeof tokenFactory!=='function')fail('DEPENDENCIES_INVALID');
 let pending=null,busy=false,prepared=0,verified=0,unknown=0,lastReceipt=null;
 async function live(){
  const [status,catalogue]=await Promise.all([request(READ_STATUS),request(READ_TOOLS)]);
  return liveExact(status,catalogue);
 }
 async function preflight(){
  if(busy)fail('BUSY');
  busy=true;
  try{
   const schema=await live();
   return {version:'fi-verified-binary-layout-v3.2',state:'schema_compatible_file_not_probed',
    tool:NAME,requiredArguments:['path'],schemaHash:schema.schemaHash,
    approvedDirectory:root,executionCount:0,approvalGranted:false,
    providerReady:'mcp_session_only',specificProvider:'unverified',
    fileStaged:false,readOnlyCatalogueRequests:2};
  }finally{busy=false}
 }
 function status(){
  return {version:'fi-verified-binary-layout-v3.2',state:'ready_to_prepare',tool:NAME,
   enabled:true,approvedDirectory:root,maxBytes:MAX_BYTES,
   preparationPending:!!pending,busy,preparedCount:prepared,
   verifiedCount:verified,unverifiedCount:unknown,
   lastReceiptHash:lastReceipt?.receiptHash??null,
   requiresExplicitOperatorConfirmation:true,requiresStagedFile:true,
   backgroundExecution:false,automaticRetries:0,otherReaToolsApproved:false};
 }
 async function prepare({name,filePath}={}){
  if(busy)fail('BUSY');
  pending=null;
  if(name!==NAME)fail('NOT_ALLOWLISTED_INSPECTION_TOOL');
  busy=true;
  try{
   const schema=await live();
   const file=await probe(filePath,{root});
   const args={path:file.path};
   if(args.path.length<schema.min||args.path.length>schema.max)fail('SCHEMA_PATH_LENGTH_HOLD');
   const nonce=tokenFactory(),expiry=clock()+120000;
   if(typeof nonce!=='string'||!/^[a-f0-9]{48}$/.test(nonce))fail('TOKEN_INVALID');
   pending={nonce,expiry,tool:NAME,schemaHash:schema.schemaHash,
    argsHash:hash(args),file};
   prepared++;
   return {version:'fi-verified-binary-layout-v3.2',state:'awaiting_separate_operator_confirmation',
    token:nonce,expiresAtUnixMs:expiry,executionCount:0,approved:false,
    preview:{name:NAME,args,argumentsHash:hash(args),schemaHash:schema.schemaHash,
     file:{path:file.path,bytes:file.bytes,sha256:file.sha256,
      format:file.format},fileWasStaged:true,
     providerReadiness:'rea_mcp_ready_specific_provider_unverified',
     risk:'REA_analysis_provider_may_create_session_derived_data_no_binary_launch_requested',oneCallOnly:true}};
  }finally{busy=false}
 }
 async function confirm({token,operatorConfirmed}={}){
  if(busy)fail('BUSY');
  if(operatorConfirmed!==true)fail('SEPARATE_OPERATOR_APPROVAL_REQUIRED');
  if(!pending||!eq(token,pending.nonce))fail('PREPARATION_NOT_FOUND');
  const permit=pending;
  pending=null; // Consume before any I/O. An uncertain result is NOT replayable.
  if(clock()>permit.expiry)fail('APPROVAL_EXPIRED');
  busy=true;
  let submitted=false;
  try{
   let current,liveSchema;
   try{
    liveSchema=await live();
    if(liveSchema.schemaHash!==permit.schemaHash)fail('SCHEMA_CHANGED');
    current=await probe(permit.file.path,{root});
    if(!fingerprintEqual(current,permit.file))fail('FILE_CHANGED');
    if(clock()>permit.expiry)fail('APPROVAL_EXPIRED');
   }catch(e){
    return {version:'fi-verified-binary-layout-v3.2',state:'preflight_hold_no_call',
     reason:short(e.message),approved:true,tokenConsumed:true,
     requestSubmitted:false,executionCount:0};
   }
   const args={path:permit.file.path};
   let outcome;
   try{
    submitted=true;
    outcome=await request(CALL,{name:NAME,arguments:args});
   }catch(e){
    unknown++;
    return {version:'fi-verified-binary-layout-v3.2',
     state:'outcome_unknown_do_not_retry',reason:short(e?.message),
     approved:true,tokenConsumed:true,requestSubmitted:true,
     executionCount:'unknown',manualVerificationRequired:true};
   }
   let after=null,postError=null;
   try{after=await probe(permit.file.path,{root})}
   catch(e){postError=short(e?.message)}
   const sameFile=fingerprintEqual(after,permit.file);
   const toolMatches=outcome?.tool===NAME;
   const evidence=obj(outcome?.result?.structuredContent)||
     (Array.isArray(outcome?.result?.content)&&outcome.result.content.length>0);
   const envelope=obj(outcome?.result)&&outcome.result.isError!==true&&evidence;
   const state=toolMatches&&envelope&&sameFile&&JSON.stringify(outcome?.result??null).length<=131072?'verified_static_inspection':
    'result_hold_manual_review';
   const outputJson=JSON.stringify(outcome?.result??null);
   const boundedOutput=outputJson.length<=131072;
   const receipt={version:'fi-verified-binary-layout-v3.2',tool:NAME,
    schemaHash:permit.schemaHash,argumentsHash:permit.argsHash,
    fileSha256Before:permit.file.sha256,fileSha256After:after?.sha256??null,
    fileIdentityVerified:sameFile,fileBytes:permit.file.bytes,
    resultHash:boundedOutput?hash(outputJson):null,resultTooLarge:!boundedOutput,
    toolIdentityVerified:toolMatches,
    evidenceEnvelopeVerified:envelope,providerReturnedNonErrorEnvelope:toolMatches&&envelope,
    analysisContentAccuracyVerified:false,providerSideEffectsIndependentlyVerified:false,
    fileChangedOrUnverifiable:!sameFile,postError,
    approved:true,tokenConsumed:true,requestSubmitted:submitted,
    completedAtUnixMs:clock(),automaticRetries:0,state};
   receipt.receiptHash=hash(receipt);
   lastReceipt={...receipt};
   if(state==='verified_static_inspection')verified++;else unknown++;
   return {version:'fi-verified-binary-layout-v3.2',state,
    executionCount:state==='verified_static_inspection'?1:'unverified',
    requestSubmitted:true,approved:true,tokenConsumed:true,
    receipt,preview:short(outputJson,3800)};
  }finally{busy=false}
 }
 function cancel(){
  pending=null;
  return {version:'fi-verified-binary-layout-v3.2',state:'cancelled_no_execution',
   executionCount:0,approved:false};
 }
 return Object.freeze({prepare,confirm,cancel,status,preflight});
}
