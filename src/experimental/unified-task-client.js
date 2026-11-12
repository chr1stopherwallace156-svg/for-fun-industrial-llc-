/* FI_UNIFIED_TASK_CHAT_CLIENT_V1 — no existing dashboard DOM dependency */
(()=>{'use strict';
const el=id=>document.getElementById(id);
const task=el('task'),send=el('send'),history=el('history'),
      status=el('service-status'),review=el('action-review'),
      approve=el('local-consent'),execute=el('local-execute'),
      log=el('event-log');
if(!task||!send||!history||!status||!review||!approve||!execute||!log)return;
let busy=false,pending=null,pendingKind=null;
const conversation=[];
const v3choice=el('v3-choice'),v3prepare=el('v3-prepare'),
 v3confirm=el('v3-confirm'),v3cancel=el('v3-cancel'),v3preview=el('v3-preview');
let v3Token=null,v3PendingName=null;
function clearV3(){
 v3Token=null;v3PendingName=null;
 if(v3confirm)v3confirm.disabled=true;
 if(v3cancel)v3cancel.disabled=true;
 if(v3choice)v3choice.disabled=false;
 if(v3preview)v3preview.textContent='No V3 execution prepared.';
}

function appendContext(role,content){
 const limited=String(content||'').slice(0,1050);
 if(!limited.trim())return;
 conversation.push({role,content:limited});
 if(conversation.length>8)conversation.splice(0,conversation.length-8);
}
function message(role,text){
 const node=document.createElement('article');
 node.className=role;node.textContent=String(text).slice(0,13000);
 history.appendChild(node);history.scrollTop=history.scrollHeight;
}
function event(text){
 const node=document.createElement('div');
 node.textContent=String(text).slice(0,10000);
 log.appendChild(node);log.scrollTop=log.scrollHeight;
}
function toggle(state){
 busy=state;send.disabled=state;execute.disabled=state||!pending||!approve.checked;
 if(v3prepare)v3prepare.disabled=state||!!v3Token;
 if(v3confirm)v3confirm.disabled=state||!v3Token;
 if(v3cancel)v3cancel.disabled=state||!v3Token;
 if(v34prepare)v34prepare.disabled=state||!!v34Token;
 if(v34confirm)v34confirm.disabled=state||!v34Token;
 if(v34cancel)v34cancel.disabled=state||!v34Token;
}
function resetReview(){
 pending=null;pendingKind=null;approve.checked=false;review.classList.remove('open');toggle(busy);
}
async function api(url,body){
 const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',
  headers:body?{'content-type':'application/json','x-fi-unified':'operator-click'}:{},
  body:body?JSON.stringify(body):undefined});
 const data=await response.json();
 if(!response.ok)throw Error(String(data.error||'HTTP '+response.status));
 return data;
}
function showActions(data){
 const acts=Array.isArray(data.actions)?data.actions:[];
 for(const a of acts){
  event('REAL ACTION: '+String(a.tool||'unknown')+' '+(a.executed?'executed':'reported'));
  event(String(a.resultPreview||'').slice(0,5500));
 }
 if(!acts.length)event('No tool executed; route='+String(data.route||'?'));
 if(data.capabilityPlan){
  const p=data.capabilityPlan;
  event('ADAPTIVE V2 — LIVE REGISTERED: REA='+String(p.catalogue?.rea)+
   ' LOCAL='+String(p.catalogue?.local)+' EXECUTED=0');
  for(const c of (Array.isArray(p.candidates)?p.candidates:[])){
   event('CANDIDATE NOT EXECUTED: '+String(c.name)+' ['+String(c.source)+
    '] required='+String(Array.isArray(c.requiredArguments)?c.requiredArguments.join(','):'UNKNOWN')+
    ' providerVerified=false');
  }
  for(const h of (Array.isArray(p.prerequisites)?p.prerequisites:[]))
   event('MISSING PREREQUISITE: '+String(h));
  for(const h of (Array.isArray(p.discoveryErrors)?p.discoveryErrors:[]))
   event('DISCOVERY HOLD: '+String(h));
 }
 if(data.source)event('Observation source: '+String(data.source));
 if(data.modelTokens!==null&&data.modelTokens!==undefined)event('Qwen completion tokens: '+String(data.modelTokens));
}
if(v3choice&&v3prepare&&v3confirm&&v3cancel&&v3preview){
 v3choice.addEventListener('change',()=>{if(!busy)clearV3()});
 v3prepare.addEventListener('click',async()=>{
  if(busy||v3Token)return;
  toggle(true);status.textContent='Checking live V3 tool schema (no execution)…';
  try{
   const name=v3choice.value;
   const r=await api('/api/unified/v3/prepare',{name,arguments:{}});
   if(r.state!=='awaiting_separate_operator_confirmation'||r.preview?.name!==name)
    throw Error('V3_PREPARATION_INVALID');
   v3Token=r.authorizationToken;v3PendingName=name;
   v3choice.disabled=true;
   v3preview.textContent='Prepared: '+name+'\\n'+
    'Exact arguments: {}\\nSchema hash: '+String(r.preview.schemaHash)+'\\n'+
    'MCP live: '+String(r.preview.liveMcpSessionReady)+
    '\\nSpecific provider success is not yet proven.\\nExpires at: '+
    new Date(r.expiresAtUnixMs).toLocaleTimeString()+
    '\\nConfirmation executes exactly ONE MCP request.';
   event('V3 PREPARED (NO EXECUTION): '+name+' schema='+String(r.preview.schemaHash));
   status.textContent='V3 awaiting separate operator confirmation';
  }catch(e){
   clearV3();
   event('V3 PREPARE HOLD: '+String(e.message||e));
   status.textContent='V3 preparation HOLD';
  }finally{toggle(false)}
 });
 v3cancel.addEventListener('click',async()=>{
  if(busy||!v3Token)return;toggle(true);
  try{
   const r=await api('/api/unified/v3/cancel',{});
   event('V3 CANCELED: '+String(r.state));
  }catch(e){event('V3 CANCEL HOLD: '+String(e.message||e))}
  finally{clearV3();toggle(false)}
 });
 v3confirm.addEventListener('click',async()=>{
  if(busy||!v3Token||!v3PendingName)return;
  const token=v3Token,name=v3PendingName;
  // Remove the token locally before posting: never silently retry.
  v3Token=null;v3PendingName=null;toggle(true);
  v3preview.textContent='Submitting one approved REA inspection; no automatic retries.';
  try{
   const r=await api('/api/unified/v3/confirm',{authorizationToken:token,operatorConfirmed:true});
   const outcome=String(r.state);
   event('V3 TOOL='+name+' STATE='+outcome+' EXECUTED='+String(r.executedActions));
   if(r.receipt)event('V3 RECEIPT HASH='+String(r.receipt.receiptHash)+
    ' RESULT SHA256='+String(r.receipt.resultHash));
   if(r.resultPreview)event('V3 RESULT (UNTRUSTED): '+String(r.resultPreview));
   message('assistant','V3 '+outcome+' for '+name+'; inspect execution evidence for receipt.');
   status.textContent='V3 '+outcome;
  }catch(e){
   event('V3 OUTCOME UNKNOWN OR HOLD: '+String(e.message||e)+' — DO NOT RETRY AUTOMATICALLY');
   status.textContent='V3 uncertain outcome / hold';
  }finally{clearV3();toggle(false)}
 });
}

const v31file=el('v31-file'),v31prepare=el('v31-prepare'),
 v31confirm=el('v31-confirm'),v31cancel=el('v31-cancel'),
 v31preview=el('v31-preview'),v31root=el('v31-root');
let v31Token=null;
function clearV31(){
 v31Token=null;
 if(v31confirm)v31confirm.disabled=true;
 if(v31cancel)v31cancel.disabled=true;
 if(v31file)v31file.disabled=false;
 if(v31preview)v31preview.textContent='No staged file prepared.';
}
if(v31file&&v31prepare&&v31confirm&&v31cancel&&v31preview&&v31root){
 api('/api/unified/v3.1/status').then(s=>{
  v31root.textContent='Approved input directory: '+String(s.approvedDirectory);
 }).catch(e=>{v31root.textContent='V3.1 status unavailable: '+String(e.message||e)});
 v31file.addEventListener('input',()=>{if(v31Token)clearV31()});
 v31prepare.addEventListener('click',async()=>{
  if(busy||v31Token)return;
  const filename=v31file.value.trim();
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(filename)){
   v31preview.textContent='Provide only a staged binary filename (no folders or paths).';return;
  }
  toggle(true);v31prepare.disabled=true;
  try{
   const result=await api('/api/unified/v3.1/prepare',{
    name:'inspect_rust_binary',filePath:filename});
   if(result.state!=='awaiting_separate_operator_confirmation'||
     result.preview?.name!=='inspect_rust_binary'||
     result.executionCount!==0)throw Error('PREPARATION_NOT_VERIFIED');
   v31Token=result.token;
   v31file.disabled=true;
   v31preview.textContent=[
    'Review EXACT static inspection:',
    'Tool: '+result.preview.name,
    'Arguments: '+JSON.stringify(result.preview.args),
    'File SHA-256: '+result.preview.file.sha256,
    'File bytes: '+result.preview.file.bytes,
    'File format signature: '+result.preview.file.format,
    'Schema SHA-256: '+result.preview.schemaHash,
    'Specific provider readiness remains unproven.',
    'Expires: '+new Date(result.expiresAtUnixMs).toLocaleTimeString(),
    'Approve only if this is your authorized file.',
    'There will be exactly ONE MCP call and no retry.'
   ].join('\n');
   v31confirm.disabled=false;v31cancel.disabled=false;
   event('V3.1 PREPARED; NO MCP CALL. Tool=inspect_rust_binary sha256='+String(result.preview.file.sha256));
   status.textContent='V3.1 awaiting separate explicit approval';
  }catch(error){
   clearV31();event('V3.1 PREPARE HOLD '+String(error.message||error));
   v31preview.textContent='V3.1 HOLD: '+String(error.message||error);
  }finally{toggle(false);v31prepare.disabled=!!v31Token||busy;}
 });
 v31cancel.addEventListener('click',async()=>{
  if(busy||!v31Token)return;toggle(true);
  try{const outcome=await api('/api/unified/v3.1/cancel',{});
   event('V3.1 CANCELED '+String(outcome.state))}
  catch(e){event('V3.1 CANCEL HOLD '+String(e.message||e))}
  finally{clearV31();v31prepare.disabled=false;toggle(false)}
 });
 v31confirm.addEventListener('click',async()=>{
  if(busy||!v31Token)return;
  const token=v31Token;v31Token=null;toggle(true);
  v31preview.textContent='One approved inspection submitted. Uncertain outcome will NOT be retried.';
  try{
   const result=await api('/api/unified/v3.1/confirm',{
    token,operatorConfirmed:true});
   event('V3.1 STATE='+String(result.state)+' MCP_CALLS='+String(result.executionCount));
   if(result.receipt){
    event('V3.1 FILE BEFORE='+String(result.receipt.fileSha256Before)+
      ' AFTER='+String(result.receipt.fileSha256After));
    event('V3.1 RESULT HASH='+String(result.receipt.resultHash)+
      ' RECEIPT='+String(result.receipt.receiptHash));
   }
   if(result.preview)event('V3.1 UNTRUSTED OUTPUT: '+String(result.preview));
   v31preview.textContent='V3.1 '+String(result.state)+
     '\nCheck execution evidence. A correct envelope is not proof of Rust source language or analysis accuracy.';
   status.textContent='V3.1 '+String(result.state);
  }catch(error){
   v31preview.textContent='V3.1 HOLD/UNCERTAIN: '+String(error.message||error)+
     '\nDo not retry automatically.';
   event('V3.1 OUTCOME HOLD '+String(error.message||error));
  }finally{clearV31();v31prepare.disabled=false;toggle(false)}
 });
}

const v32file=el('v32-file'),v32prepare=el('v32-prepare'),
 v32confirm=el('v32-confirm'),v32cancel=el('v32-cancel'),
 v32preview=el('v32-preview'),v32root=el('v32-root');
let v32Token=null;
function clearV32(){
 v32Token=null;
 if(v32confirm)v32confirm.disabled=true;
 if(v32cancel)v32cancel.disabled=true;
 if(v32file)v32file.disabled=false;
 if(v32preview)v32preview.textContent='No staged file prepared.';
}
if(v32file&&v32prepare&&v32confirm&&v32cancel&&v32preview&&v32root){
 api('/api/unified/v3.2/status').then(s=>{
  v32root.textContent='Approved input directory: '+String(s.approvedDirectory);
 }).catch(e=>{v32root.textContent='V3.2 status unavailable: '+String(e.message||e)});
 v32file.addEventListener('input',()=>{if(v32Token)clearV32()});
 v32prepare.addEventListener('click',async()=>{
  if(busy||v32Token)return;
  const filename=v32file.value.trim();
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(filename)){
   v32preview.textContent='Provide only a staged binary filename (no folders or paths).';return;
  }
  toggle(true);v32prepare.disabled=true;
  try{
   const result=await api('/api/unified/v3.2/prepare',{
    name:'inspect_binary_layout',filePath:filename});
   if(result.state!=='awaiting_separate_operator_confirmation'||
     result.preview?.name!=='inspect_binary_layout'||
     result.executionCount!==0)throw Error('PREPARATION_NOT_VERIFIED');
   v32Token=result.token;
   v32file.disabled=true;
   v32preview.textContent=[
    'Review EXACT static inspection:',
    'Tool: '+result.preview.name,
    'Arguments: '+JSON.stringify(result.preview.args),
    'File SHA-256: '+result.preview.file.sha256,
    'File bytes: '+result.preview.file.bytes,
    'File format signature: '+result.preview.file.format,
    'Schema SHA-256: '+result.preview.schemaHash,
    'Specific provider readiness remains unproven.',
    'Expires: '+new Date(result.expiresAtUnixMs).toLocaleTimeString(),
    'Approve only if this is your authorized file.',
    'There will be exactly ONE MCP call and no retry.'
   ].join('\n');
   v32confirm.disabled=false;v32cancel.disabled=false;
   event('V3.2 PREPARED; NO MCP CALL. Tool=inspect_binary_layout sha256='+String(result.preview.file.sha256));
   status.textContent='V3.2 awaiting separate explicit approval';
  }catch(error){
   clearV32();event('V3.2 PREPARE HOLD '+String(error.message||error));
   v32preview.textContent='V3.2 HOLD: '+String(error.message||error);
  }finally{toggle(false);v32prepare.disabled=!!v32Token||busy;}
 });
 v32cancel.addEventListener('click',async()=>{
  if(busy||!v32Token)return;toggle(true);
  try{const outcome=await api('/api/unified/v3.2/cancel',{});
   event('V3.2 CANCELED '+String(outcome.state))}
  catch(e){event('V3.2 CANCEL HOLD '+String(e.message||e))}
  finally{clearV32();v32prepare.disabled=false;toggle(false)}
 });
 v32confirm.addEventListener('click',async()=>{
  if(busy||!v32Token)return;
  const token=v32Token;v32Token=null;toggle(true);
  v32preview.textContent='One approved inspection submitted. Uncertain outcome will NOT be retried.';
  try{
   const result=await api('/api/unified/v3.2/confirm',{
    token,operatorConfirmed:true});
   event('V3.2 STATE='+String(result.state)+' MCP_CALLS='+String(result.executionCount));
   if(result.receipt){
    event('V3.2 FILE BEFORE='+String(result.receipt.fileSha256Before)+
      ' AFTER='+String(result.receipt.fileSha256After));
    event('V3.2 RESULT HASH='+String(result.receipt.resultHash)+
      ' RECEIPT='+String(result.receipt.receiptHash));
   }
   if(result.receipt?.providerErrorCode)event('V3.2 PROVIDER ERROR: '+
     String(result.receipt.providerErrorCode)+' CLASS_HEURISTIC='+
     String(result.receipt.providerDetailedCause)+' EVIDENCE_HASH='+
     String(result.receipt.providerEvidenceHash||'unavailable'));
   if(result.preview)event('V3.2 UNTRUSTED OUTPUT: '+String(result.preview));
   v32preview.textContent='V3.2 '+String(result.state)+
     '\nCheck execution evidence. A correct envelope is not proof of provider side-effect absence or analysis accuracy.';
   status.textContent='V3.2 '+String(result.state);
  }catch(error){
   v32preview.textContent='V3.2 HOLD/UNCERTAIN: '+String(error.message||error)+
     '\nDo not retry automatically.';
   event('V3.2 OUTCOME HOLD '+String(error.message||error));
  }finally{clearV32();v32prepare.disabled=false;toggle(false)}
 });
}


const v34file=el('v34-file'),v34choice=el('v34-choice'),
 v34prepare=el('v34-prepare'),v34confirm=el('v34-confirm'),
 v34cancel=el('v34-cancel'),v34preview=el('v34-preview'),v34root=el('v34-root');
let v34Token=null;
function clearV34(){
 v34Token=null;
 if(v34confirm)v34confirm.disabled=true;
 if(v34cancel)v34cancel.disabled=true;
 if(v34file)v34file.disabled=false;
 if(v34choice)v34choice.disabled=false;
}
if(v34file&&v34choice&&v34prepare&&v34confirm&&v34cancel&&v34preview&&v34root){
 api('/api/unified/v3.4/status').then(s=>{
  v34root.textContent='Approved input directory: '+String(s.approvedDirectory);
 }).catch(e=>{v34root.textContent='V3.4 status HOLD: '+String(e.message||e)});
 const invalidate=()=>{if(v34Token){
  v34preview.textContent='Review changed. Previous token must be canceled before another preparation.';
  v34confirm.disabled=true;
 }};
 v34file.addEventListener('input',invalidate);
 v34choice.addEventListener('change',invalidate);
 v34prepare.addEventListener('click',async()=>{
  if(busy||v34Token)return;
  const filePath=v34file.value.trim(),name=v34choice.value;
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(exe|dll)$/i.test(filePath)){
   v34preview.textContent='Enter only a staged .exe or .dll basename.';return;
  }
  toggle(true);
  try{
   const prepared=await api('/api/unified/v3.4/prepare',{name,filePath});
   if(prepared.state!=='awaiting_separate_operator_confirmation'||
     prepared.preview?.name!==name||prepared.executionCount!==0)
    throw Error('V34_PREPARATION_NOT_VERIFIED');
   v34Token=prepared.token;
   v34file.disabled=true;v34choice.disabled=true;
   v34preview.textContent=[
    'Review exact REA call:',JSON.stringify(prepared.preview.arguments),
    'Tool: '+prepared.preview.name,
    'SHA-256: '+prepared.preview.file.sha256,
    'PE machine: 0x'+prepared.preview.file.machine.toString(16),
    'PE sections: '+prepared.preview.file.sections,
    'Canonical schema SHA-256: '+prepared.preview.schemaHash,
    'Specific provider capability is still UNVERIFIED.',
    'Separate approval authorizes one call, never retries.'
   ].join('\n');
  }catch(e){v34preview.textContent='V3.4 PREPARE HOLD: '+String(e.message||e);
  }finally{toggle(false)}
 });
 v34cancel.addEventListener('click',async()=>{
  if(busy||!v34Token)return;
  toggle(true);
  try{
   const result=await api('/api/unified/v3.4/cancel',{});
   event('V3.4 CANCEL='+String(result.state)+' MCP_CALLS=0');
   v34preview.textContent='Canceled without any REA inspection.';
  }catch(e){event('V3.4 CANCEL HOLD '+String(e.message||e));
  }finally{clearV34();toggle(false)}
 });
 v34confirm.addEventListener('click',async()=>{
  if(busy||!v34Token)return;
  const token=v34Token;v34Token=null;toggle(true);
  v34preview.textContent='One approved REA call submitted. No automatic retry.';
  try{
   const outcome=await api('/api/unified/v3.4/confirm',{
    token,operatorConfirmed:true});
   event('V3.4 STATE='+String(outcome.state)+' COUNT='+String(outcome.executionCount));
   if(outcome.receipt){
    event('V3.4 RECEIPT='+String(outcome.receipt.receiptHash)+
     ' FILE_UNCHANGED='+String(outcome.receipt.fileIdentityVerified));
    if(outcome.receipt.mcpError)event('V3.4 PROVIDER ERROR CATEGORY='+
     String(outcome.receipt.mcpErrorClass));
   }
   if(outcome.preview)event('V3.4 BOUNDED OUTPUT='+String(outcome.preview));
   v34preview.textContent='V3.4 '+String(outcome.state)+
    '\nReview evidence log. A valid envelope is not independent proof of detailed analysis accuracy.';
  }catch(e){
   v34preview.textContent='V3.4 OUTCOME HOLD: '+String(e.message||e)+
    '\nDo not automatically repeat.';
  }finally{clearV34();toggle(false)}
 });
}



const v4button=el('v4-refresh'),v4summary=el('v4-summary'),v4services=el('v4-services');
if(v4button&&v4summary&&v4services){
 const checkV4=async()=>{
  v4button.disabled=true;
  v4summary.textContent='Reading the current service health (no actions)…';
  try{
   const report=await api('/api/unified/v4/status');
   if(report.version!=='fi-unified-runtime-v4-stage1')throw Error('V4_IDENTITY_MISMATCH');
   v4summary.textContent='V4 '+report.state+
    ' · 1 user-facing address · '+String(report.registered?.rea??'?')+
    ' REA · '+String(report.registered?.local??'?')+' local tools';
   v4services.textContent=report.services.map(item=>
    String(item.id)+': '+(item.ready?'ready':'unavailable')+
    ' (internal '+String(item.port)+')').join('\n');
   event('V4 READ-ONLY: '+report.state+
    ' | legacy ports not retired | no tool calls or restarts');
  }catch(e){v4summary.textContent='V4 STATUS HOLD: '+String(e.message||e);
  }finally{v4button.disabled=false}
 };
 v4button.addEventListener('click',checkV4);
 // No background polling, timers or service changes.
}

send.addEventListener('click',async()=>{
 if(busy)return;
 const prompt=task.value.trim();
 if(prompt.length<3||prompt.length>2200){status.textContent='Enter 3–2200 characters';return}
 resetReview();toggle(true);
 message('you',prompt);status.textContent='Routing task…';
 try{
  const result=await api('/api/unified/chat',{prompt,context:conversation.slice()});
  message('assistant',result.reply||'(No model response. Inspect the evidence log.)');
  appendContext('user',prompt);appendContext('assistant',result.reply);
  event('ROUTE='+String(result.route)+' STATE='+String(result.state));
  showActions(result);
  if(['local_action_review','rea_action_review'].includes(result.route)){
   pending=prompt;
   pendingKind=result.route==='rea_action_review'?'rea':'local';
   const kindText=pendingKind==='rea'?
    'REA may change files, devices or processes. One REA execution round may call more than one tool.':
    'Registered local compute tools may change in-memory state.';
   event('REVIEW REQUIRED: '+kindText);
   execute.textContent=pendingKind==='rea'?'Execute REA tools (approved)':'Execute local tools (approved)';
   review.classList.add('open');execute.disabled=true;
  }
  status.textContent='READY · '+String(result.state)+' · '+String(result.execution);
  task.value='';
 }catch(error){message('error','HOLD: '+String(error.message||error));status.textContent='HOLD'}
 finally{toggle(false)}
});
approve.addEventListener('change',()=>{execute.disabled=busy||!pending||!approve.checked});
execute.addEventListener('click',async()=>{
 if(busy||!pending||!approve.checked)return;
 const prompt=pending,kind=pendingKind;
 // One click equals one authorized finite tool session, never silent.
 resetReview();toggle(true);status.textContent='Running explicitly authorized '+kind+' tools…';
 event('Operator explicitly authorized one '+kind+' tools session');
 try{
  const data=await api(kind==='rea'?'/api/unified/rea/execute':'/api/unified/local/execute',{prompt,operatorConfirmed:true});
  message('assistant',data.reply||('Tool session completed: '+String(data.state)));
  appendContext('assistant',data.reply||('Tool session completed: '+String(data.state)));
  showActions(data);
  status.textContent='READY · '+String(data.state);
 }catch(error){message('error','LOCAL EXECUTION HOLD: '+String(error.message||error));status.textContent='LOCAL HOLD'}
 finally{toggle(false)}
});
api('/api/unified/status').then(s=>{
 status.textContent='READY · Qwen local · REA '+(s.rea?.ready?'229 registered':'unavailable')+
  ' · Local tools '+(s.local?.ready?String(s.local.count)+' available':'unavailable')+
  ' · separate authorization for local actions';
}).catch(err=>status.textContent='Health check unavailable: '+String(err.message||err));
})();
