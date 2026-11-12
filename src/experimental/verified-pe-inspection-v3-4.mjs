// FI_VERIFIED_PE_INSPECTION_V34 — one operator-approved, schema-bound PE inspection.
// No model chooses an inspection, no binary launch, no background work, no automatic retries.
// Provider behavior and analysis accuracy are never inferred from a successful MCP envelope.
import os from 'node:os';
import path from 'node:path';
import {open} from 'node:fs/promises';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {probeApprovedLayoutBinary} from './verified-binary-layout-v3-2.mjs';

const REA='http://127.0.0.1:8797';
const STATUS=REA+'/api/rea229/status';
const TOOLS=REA+'/api/rea229/tools?limit=229';
const CALL=REA+'/api/rea229/call';
export const PE_TOOLS=Object.freeze([
 'inspect_pe_imports','inspect_native_exports','inspect_pe_resources',
 'inspect_byte_entropy','inspect_pe_load_config'
]);
const names=new Set(PE_TOOLS);
const rootDefault=()=>path.join(os.homedir(),'FunIndustrial-Approved-Inputs');
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const short=(s,n=240)=>String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n);
const hold=c=>{throw Error('V34_'+c)};
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&
 /^[a-f0-9]{48}$/.test(a)&&/^[a-f0-9]{48}$/.test(b)&&
 timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const same=(a,b)=>!!a&&!!b&&a.sha256===b.sha256&&a.bytes===b.bytes&&
 a.fileIdentity===b.fileIdentity&&a.path===b.path&&
 a.machine===b.machine&&a.sections===b.sections&&a.optionalMagic===b.optionalMagic;
const schemaKeys=new Set(['$schema','title','description','type','properties','required','additionalProperties','$id']);
const pathKeys=new Set(['type','title','description','minLength','maxLength','pattern']);
function exactSchema(schema){
 if(!obj(schema)||JSON.stringify(schema).length>16000||schema.type!=='object'||
   Object.keys(schema).some(k=>!schemaKeys.has(k)))hold('SCHEMA_UNSUPPORTED');
 if(!Array.isArray(schema.required)||schema.required.length!==1||schema.required[0]!=='path')
  hold('EXACT_PATH_REQUIREMENT_MISSING');
 if(!obj(schema.properties)||!obj(schema.properties.path)||schema.properties.path.type!=='string'||
   Object.keys(schema.properties.path).some(k=>!pathKeys.has(k)))
  hold('PATH_SCHEMA_UNSUPPORTED');
 // Accept only the canonical NUL-excluding path pattern if advertised.
 // Unknown path-pattern constraints always fail closed.
 if(Object.prototype.hasOwnProperty.call(schema.properties.path,'pattern') &&
   schema.properties.path.pattern!==String.raw`^[^\x00]*$`)
  hold('PATH_PATTERN_UNSUPPORTED');
 // The canonical MCP provider still independently validates all optional fields.
 // Only {path} is transmitted, never guessed or synthesized optional arguments.
 if(schema.additionalProperties!==false)hold('ADDITIONAL_FIELDS_MUST_BE_FORBIDDEN');
 const {minLength=0,maxLength=800}=schema.properties.path;
 if(!Number.isSafeInteger(minLength)||minLength<0||!Number.isSafeInteger(maxLength)||
   maxLength<1||minLength>maxLength)hold('PATH_LENGTH_SCHEMA_INVALID');
 return {schemaHash:hash(schema),minLength,maxLength};
}
function exactLive(status,catalogue,name){
 if(!names.has(name))hold('TOOL_NOT_ALLOWLISTED');
 if(status?.liveMcpHealth!=='ready'||status?.realReaToolCount!==229)
  hold('REA_SESSION_NOT_READY');
 if(!Array.isArray(catalogue?.tools)||catalogue.tools.length!==229)
  hold('CATALOGUE_SIZE_CHANGED');
 const actual=new Set();
 for(const t of catalogue.tools){
  if(!obj(t)||typeof t.name!=='string'||actual.has(t.name))
   hold('CATALOGUE_INVALID_OR_DUPLICATE');
  actual.add(t.name);
 }
 const matched=catalogue.tools.find(t=>t.name===name);
 if(!matched)hold('SELECTED_TOOL_MISSING');
 return exactSchema(matched.inputSchema);
}
// Reads the DOS+PE file signature, x64 machine, section count, and optional-header
// magic without loading or executing the file. The existing V3.2 approved-root
// probe independently establishes file type, single-link identity, size and SHA256.
export async function probeApprovedPeBinary(filePath,{root=rootDefault()}={}){
 if(typeof filePath!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(exe|dll)$/i.test(filePath))
  hold('STAGED_PE_FILENAME_REQUIRED');
 const before=await probeApprovedLayoutBinary(filePath,{root});
 if(before.format!=='PE')hold('NOT_PE');
 const handle=await open(before.path,'r');
 let machine,sections,optionalMagic;
 try{
  const dos=Buffer.alloc(64);
  const a=await handle.read(dos,0,64,0);
  if(a.bytesRead!==64||dos.readUInt16LE(0)!==0x5a4d)hold('DOS_HEADER_INVALID');
  const peOffset=dos.readInt32LE(60);
  if(peOffset<64||peOffset>before.bytes-26)hold('PE_OFFSET_INVALID');
  const pe=Buffer.alloc(26);
  const b=await handle.read(pe,0,26,peOffset);
  if(b.bytesRead!==26||pe.readUInt32LE(0)!==0x00004550)hold('PE_SIGNATURE_INVALID');
  machine=pe.readUInt16LE(4);
  sections=pe.readUInt16LE(6);
  optionalMagic=pe.readUInt16LE(24);
  const optionalSize=pe.readUInt16LE(20);
  if(machine!==0x8664||sections<1||sections>96||optionalMagic!==0x20b)
   hold('NOT_X64_PE32_PLUS');
  // PE32+ optional header carries at least 112 structural bytes; declared
  // optional header plus all 40-byte section headers must fit in the file.
  if(optionalSize<112||optionalSize>4096||
     peOffset+24+optionalSize+40*sections>before.bytes)
   hold('PE_HEADER_OR_SECTION_TABLE_TRUNCATED');
 }finally{await handle.close()}
 const after=await probeApprovedLayoutBinary(filePath,{root});
 if(before.path!==after.path||before.sha256!==after.sha256||
   before.fileIdentity!==after.fileIdentity||before.bytes!==after.bytes)
  hold('PE_CHANGED_DURING_HEADER_READ');
 return Object.freeze({...after,machine,sections,optionalMagic});
}
export function createVerifiedPeInspectionV34({
 request,probe=probeApprovedPeBinary,root=rootDefault(),clock=Date.now,
 tokenFactory=()=>randomBytes(24).toString('hex')
}={}){
 if(typeof request!=='function'||typeof probe!=='function'||typeof clock!=='function'||
  typeof tokenFactory!=='function')hold('DEPENDENCIES_INVALID');
 let pending=null,busy=false,prepared=0,verified=0,holds=0,lastReceipt=null;
 async function live(name){
  const [status,catalogue]=await Promise.all([request(STATUS),request(TOOLS)]);
  return exactLive(status,catalogue,name);
 }
 function status(){
  return {version:'fi-verified-pe-v3.4',state:'ready_to_prepare',enabled:true,
   supportedTools:[...PE_TOOLS],approvedDirectory:root,
   requiresSeparateOperatorConfirmation:true,oneToolCallPerApproval:true,
   preparationPending:!!pending,busy,preparedCount:prepared,
   verifiedEnvelopeCount:verified,failedOrUnverifiedCount:holds,
   lastReceiptHash:lastReceipt?.receiptHash??null,
   noAutomaticRetry:true,backgroundExecution:false,otherReaToolsAuthorized:false};
 }
 async function preflight({name}={}){
  if(busy)hold('BUSY');
  busy=true;
  try{
   const schema=await live(name);
   return {version:'fi-verified-pe-v3.4',state:'schema_compatible_file_not_probed',
    name,schemaHash:schema.schemaHash,requiredArguments:['path'],
    approvedDirectory:root,requestSubmitted:false,executionCount:0,
    providerUsability:'unverified',mcpCalls:0};
  }finally{busy=false}
 }
 async function prepare({name,filePath}={}){
  if(busy)hold('BUSY');
  pending=null;
  if(!names.has(name))hold('TOOL_NOT_ALLOWLISTED');
  busy=true;
  try{
   const schema=await live(name);
   const file=await probe(filePath,{root});
   if(typeof file?.path!=='string'||typeof file?.sha256!=='string'||file?.format!=='PE'||
    file.machine!==0x8664||file.optionalMagic!==0x20b)hold('PE_PROBE_INVALID');
   const args={path:file.path};
   if(args.path.length<schema.minLength||args.path.length>schema.maxLength)
    hold('PATH_LENGTH_NOT_SCHEMA_COMPATIBLE');
   const nonce=tokenFactory();
   if(!/^[a-f0-9]{48}$/.test(nonce))hold('TOKEN_INVALID');
   const expiry=clock()+120000;
   pending={name,file,schemaHash:schema.schemaHash,argsHash:hash(args),nonce,expiry};
   prepared++;
   return {version:'fi-verified-pe-v3.4',state:'awaiting_separate_operator_confirmation',
    token:nonce,expiresAtUnixMs:expiry,executionCount:0,approved:false,
    preview:{name,arguments:args,argumentsHash:hash(args),
     schemaHash:schema.schemaHash,file:{path:file.path,bytes:file.bytes,
      sha256:file.sha256,machine:file.machine,sections:file.sections,
      optionalMagic:file.optionalMagic,format:file.format},
     providerUsability:'unverified',oneCallOnly:true,
     risk:'Provider may produce temporary/session-derived artifacts; does not execute staged binary'}};
  }finally{busy=false}
 }
 async function confirm({token,operatorConfirmed}={}){
  if(busy)hold('BUSY');
  if(operatorConfirmed!==true)hold('SEPARATE_OPERATOR_CONFIRMATION_REQUIRED');
  if(!pending||!equal(token,pending.nonce))hold('PREPARATION_NOT_FOUND');
  const permit=pending;
  pending=null; // irreversible consumption before any further IO, even on failure
  if(clock()>permit.expiry)hold('APPROVAL_EXPIRED');
  busy=true;
  try{
   try{
    const schema=await live(permit.name);
    if(schema.schemaHash!==permit.schemaHash)hold('SCHEMA_CHANGED');
    const current=await probe(permit.file.name,{root});
    if(!same(current,permit.file))hold('FILE_CHANGED');
    if(clock()>permit.expiry)hold('APPROVAL_EXPIRED');
   }catch(e){
    holds++;
    return {version:'fi-verified-pe-v3.4',state:'preflight_hold_no_call',
     reason:short(e?.message),requestSubmitted:false,executionCount:0,
     approved:true,tokenConsumed:true};
   }
   let response;
   try{
    response=await request(CALL,{name:permit.name,arguments:{path:permit.file.path}});
   }catch(e){
    holds++;
    return {version:'fi-verified-pe-v3.4',state:'outcome_unknown_do_not_retry',
     reason:short(e?.message),requestSubmitted:true,executionCount:'unknown',
     approved:true,tokenConsumed:true,manualVerificationRequired:true};
   }
   let after=null,postError=null;
   try{after=await probe(permit.file.name,{root})}
   catch(e){postError=short(e?.message)}
   const sameFile=same(after,permit.file);
   const toolIdentity=response?.tool===permit.name;
   const raw=JSON.stringify(response?.result??null);
   const withinBounds=raw.length<=131072;
   const mcpError=response?.result?.isError===true;
   const info=response?.mcpErrorEvidence;
   const safeClass=new Set(['access_denied','provider_unavailable','input_validation',
    'file_unavailable','format_not_supported','analysis_timeout','unclassified_mcp_error']);
   const safeError=mcpError&&obj(info)&&info.version==='fi-rea-mcp-error-evidence-v1'&&
    safeClass.has(info.errorClass)&&info.resultIsError===true&&
    info.analysisSucceeded===false&&info.diagnosticTextExposed===false&&
    /^[a-f0-9]{64}$/.test(info.evidenceDigestSha256??'');
   const evidence=obj(response?.result?.structuredContent)||
    (Array.isArray(response?.result?.content)&&response.result.content.length>0);
   const success=toolIdentity&&!mcpError&&response?.result?.isError!==true&&
    obj(response?.result)&&evidence&&sameFile&&withinBounds;
   const state=success?'verified_mcp_envelope':toolIdentity&&safeError?
    'provider_mcp_error_reported':'result_hold_manual_review';
   const receipt={version:'fi-verified-pe-v3.4',state,tool:permit.name,
    schemaHash:permit.schemaHash,argumentsHash:permit.argsHash,
    fileSha256Before:permit.file.sha256,fileSha256After:after?.sha256??null,
    fileIdentityVerified:sameFile,fileBytes:permit.file.bytes,
    fileMachine:permit.file.machine,fileSections:permit.file.sections,
    toolIdentityVerified:toolIdentity,analysisAccuracyVerified:false,
    providerSideEffectsVerified:false,
    mcpError,mcpErrorClass:safeError?info.errorClass:null,
    mcpErrorEvidenceHash:safeError?info.evidenceDigestSha256:null,
    resultHash:success?hash(raw):null,
    resultTooLarge:!withinBounds,postError,
    requestSubmitted:true,tokenConsumed:true,automaticRetries:0,
    completedAtUnixMs:clock()};
   receipt.receiptHash=hash(receipt);lastReceipt={...receipt};
   if(success)verified++;else holds++;
   return {version:'fi-verified-pe-v3.4',state,executionCount:success?1:'unverified',
    requestSubmitted:true,approved:true,tokenConsumed:true,
    manualVerificationRequired:!success,receipt,
    preview:success?short(raw,3400):safeError?
     'MCP provider error category (heuristic): '+info.errorClass+'; analysis not verified':
     'Result needs manual review; raw error text withheld'};
  }finally{busy=false}
 }
 function cancel(){
  pending=null;
  return {version:'fi-verified-pe-v3.4',state:'cancelled_no_execution',
   requestSubmitted:false,executionCount:0,approved:false};
 }
 return Object.freeze({status,preflight,prepare,confirm,cancel});
}
