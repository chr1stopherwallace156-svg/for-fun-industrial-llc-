// Primary Fun Industrial dashboard Qwen chat. Same-origin, user-submit only.
(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const box=byId('fi-fial53-grounded'),send=byId('fi-fial53-send'),
  query=byId('fi-fial53-question'),history=byId('fi-fial53-history'),
  status=byId('fi-fial53-status');
 if(!box||!send||!query||!history||!status)return;
 let pendingReaToken=null,includeApprovedReaOnce=false,reaBusy=false;
 function entry(kind,text){
  const article=document.createElement('article');
  article.style.cssText='padding:12px;border:1px solid #345269;border-radius:10px;background:#0e1c2b;white-space:pre-wrap;overflow-wrap:anywhere';
  const title=document.createElement('strong');title.textContent=kind;
  const content=document.createElement('div');content.textContent=text;
  article.append(title,content);history.append(article);
  article.scrollIntoView({block:'nearest',behavior:'auto'});
 }
 async function showCapabilityInventory(){
  const box=byId('fi-fial53-capability-list');
  if(!box)return;
  try{
   const res=await fetch('/api/fun/capabilities/status',{method:'GET',cache:'no-store'});
   if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json();
   if(data.version!=='fun-ai-capability-fabric-v1'||!Array.isArray(data.domains))
    throw Error('CAPABILITY_LIST_UNVERIFIED');
   box.textContent=data.domains.slice(0,16).map(x=>
    String(x.name||x.id).slice(0,100)+' — '+String(x.state||'unknown').slice(0,100)).join('\n')+
    '\n\nInventory is informational. Operations remain operator-reviewed.';
  }catch{box.textContent='The local capability inventory is unavailable; no tool availability is assumed.'}
 }
 async function check(){
  void showCapabilityInventory();
  try{
   const r=await fetch('/api/fial/grounded/status',{method:'GET',cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   if(data.model_interface!=='fixed_local_qwen_8088'||data.memory_interface!=='fixed_readonly_cognee_8789')throw Error('UNVERIFIED_QWEN_OR_MEMORY');
   status.textContent='Local Qwen and contextual memory interface configured. Ready for a question.';
  }catch(e){status.textContent='Chat status unavailable: '+String(e.message||e)}
 }
 async function reviewedRequest(action,body){
  const r=await fetch('/api/fun/rea/dispatch/'+action,{
   method:'POST',credentials:'same-origin',
   headers:{'content-type':'application/json','x-fi-rea-review':'operator-'+action},
   body:JSON.stringify(body)
  });
  const value=await r.json();
  if(!r.ok)throw Error('REA '+action+': '+String(value.error||r.status));
  return value;
 }
 function reaNotice(text){
  const elem=byId('fi-fial53-rea-review');
  if(elem)elem.textContent=String(text).slice(0,4500);
 }
 function bindReviewedTools(){
  const prepare=byId('fi-fial53-rea-prepare');
  const confirm=byId('fi-fial53-rea-confirm');
  const cancel=byId('fi-fial53-rea-cancel');
  const explain=byId('fi-fial53-rea-explain');
  const selection=byId('fi-fial53-rea-select');
  if(!prepare||!confirm||!cancel||!explain||!selection)return;
  const busy=v=>{reaBusy=v;prepare.disabled=v;confirm.disabled=v||!pendingReaToken;cancel.disabled=v};
  prepare.addEventListener('click',async()=>{
   if(reaBusy)return;
   pendingReaToken=null;explain.hidden=true;busy(true);
   reaNotice('Checking live REA status, exact tool identity and schema. No tool has run yet.');
   try{
    const value=await reviewedRequest('prepare',{name:selection.value,arguments:{}});
    if(value.state!=='awaiting_separate_operator_confirmation'||typeof value.authorizationToken!=='string')
     throw Error('REA preparation was not confirmed.');
    pendingReaToken=value.authorizationToken;
    reaNotice('PREPARED — NO EXECUTION YET\nTool: '+String(value.preview?.name||'unknown')+
      '\nArguments: {}\nScope: '+String(value.preview?.executionScope||'unknown')+
      '\nRequires a separate confirmation click. Expires in 120 seconds.');
   }catch(e){pendingReaToken=null;reaNotice('Preparation held: '+String(e.message||e))}
   finally{busy(false)}
  });
  confirm.addEventListener('click',async()=>{
   if(!pendingReaToken||reaBusy)return;
   const token=pendingReaToken;
   pendingReaToken=null;busy(true);
   reaNotice('Submitting ONE exact operator-approved read-only call. No retries.');
   try{
    const value=await reviewedRequest('confirm',{authorizationToken:token,operatorConfirmed:true});
    if(value.state==='verified_readonly_result'){
     reaNotice('VERIFIED READ-ONLY RESULT — operator approved\nTool: '+
      String(value.receipt?.tool||'unknown')+'\nResult: '+String(value.resultPreview||'').slice(0,3500)+
      '\nReceipt SHA-256: '+String(value.receipt?.receiptHash||'unavailable'));
     explain.hidden=false;
    }else{
     reaNotice('REA outcome requires review: '+String(value.state||'unknown')+
      '\nNo automatic retry. '+String(value.reason||''));
     explain.hidden=true;
    }
   }catch(e){reaNotice('REA confirmation held or outcome unknown — do not retry without review: '+String(e.message||e));explain.hidden=true}
   finally{busy(false)}
  });
  cancel.addEventListener('click',async()=>{
   if(reaBusy)return;
   pendingReaToken=null;busy(true);
   try{await reviewedRequest('cancel',{});reaNotice('Pending review cancelled. No tool executed.')}
   catch(e){reaNotice('Cancel hold: '+String(e.message||e))}
   finally{explain.hidden=true;busy(false)}
  });
  explain.addEventListener('click',()=>{
   if(send.disabled)return;
   includeApprovedReaOnce=true;
   query.value='Explain the last operator-approved REA inspection result, what it establishes, and what remains unknown.';
   void submit();
  });
 }
 async function submit(){
  const question=query.value.trim();
  if(question.length<4||question.length>1200){status.textContent='Enter a question between 4 and 1200 characters.';return}
  let payload={question};
  const reaFollowUp=includeApprovedReaOnce;
  includeApprovedReaOnce=false;
  if(reaFollowUp)payload.explainApprovedRea=true;
  const code=byId('fi-fial53-code')?.value||'';
  if(code.trim()&&!reaFollowUp){
   const f=byId('fi-fial53-function')?.value?.trim()||'';
   const ranges=(byId('fi-fial53-ranges')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   if(!f||ranges.length<1||ranges.length>16){
    status.textContent='Enter a function name and 1–16 input ranges to analyze code.';return;
   }
   payload.fisre={source:code,function:f,ranges};
  }
  send.disabled=true;entry('You',question+(payload.fisre?'\n[Python source attached for local FISRE reasoning]':''));query.value='';
  status.textContent='Checking relevant memory and requesting one local Qwen response…';
  try{
   const response=await fetch('/api/fial/grounded/chat',{method:'POST',
    credentials:'same-origin',headers:{'content-type':'application/json',
     'x-fi-chat-click':'one-local-model-response'},
    body:JSON.stringify(payload)});
   const result=await response.json();
   if(!response.ok)throw Error('HTTP '+response.status+': '+String(result.error||'request held'));
   if(result.reviewedToolSuggestion?.name){
    const sel=byId('fi-fial53-rea-select'),panel=byId('fi-fial53-rea-panel');
    if(sel&&[...sel.options].some(o=>o.value===result.reviewedToolSuggestion.name)){
     sel.value=result.reviewedToolSuggestion.name;
     if(panel)panel.open=true;
     reaNotice('SUGGESTED ONLY — NO TOOL EXECUTED\n'+
      String(result.reviewedToolSuggestion.description||'Read-only inspection')+
      '\nSelect Prepare to validate the live provider and tool schema.');
    }
   }
   if(result.state==='ANSWERED_BY_QWEN'){
    entry('Qwen',String(result.answer||''));
    status.textContent='Qwen answered · Cognee: '+String(result.memory_state||'unknown')+
     (result.fisre?.status?' · FISRE: '+String(result.fisre.status):'')+
     ' · read-only contexts: '+String(result.capabilities_referenced?.length||0)+
     (reaFollowUp?' · prior approved REA observation included':' · no external tools executed');
   }else if(result.state==='REFERENCE_ONLY_MODEL_EMPTY'){
    entry('Unverified stored memory (Qwen did not answer)',String(result.answer||''));
    status.textContent=String(result.warning||'Qwen returned empty text');
   }else{
    entry('Request held',String(result.warning||result.reason||result.state||'Unknown'));
    status.textContent='No verified Qwen answer; no automatic retry';
   }
  }catch(e){entry('Connection hold',String(e.message||e));status.textContent='Chat failed. No automatic retry.'}
  finally{send.disabled=false}
 }
 send.addEventListener('click',submit);
 query.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){
  e.preventDefault();if(!send.disabled)void submit();
 }});
 bindReviewedTools();
 void check();
})();
