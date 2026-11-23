// Primary Fun Industrial dashboard Qwen chat. Same-origin, user-submit only.
(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const box=byId('fi-fial53-grounded'),send=byId('fi-fial53-send'),
  query=byId('fi-fial53-question'),history=byId('fi-fial53-history'),
  status=byId('fi-fial53-status');
 if(!box||!send||!query||!history||!status)return;
 let pendingReaToken=null,includeApprovedReaOnce=false,reaBusy=false;
 let pendingComputeToken=null,includeApprovedComputeOnce=false,computeBusy=false;
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
 const exampleData={
  optuna_inventory:{demand:[3,4,3,6,7,4,5,8,5,4],holding_cost:1,shortage_cost:3,min_stock:0,max_stock:12,trials:48},
  ortools_routing:{cost_matrix:[[0,3,4,5],[3,0,2,7],[4,2,0,3],[5,7,3,0]]},
  ml_deals:{deals:Array.from({length:8},(_,i)=>({id:'example_'+(i+1),cost:15+i*3,sale_price:35+i*4,shipping:4,fees:2,return_allowance:1}))},
  ml_history:{history:Array.from({length:16},(_,i)=>({visits:100+i*12,price:18+(i%4)*3,ad_spend:10+i*2,units_sold:3+(i%5)}))},
  ml_candidates:{candidates:[{visits:200,price:25,ad_spend:12},{visits:350,price:35,ad_spend:20}]}
 };
 async function computeRequest(action,body){
  const res=await fetch('/api/fun/compute/'+action,{method:'POST',credentials:'same-origin',
   headers:{'content-type':'application/json','x-fi-compute-review':'operator-'+action},
   body:JSON.stringify(body)});
  const answer=await res.json();
  if(!res.ok)throw Error('Compute '+action+': '+String(answer.error||res.status));
  return answer;
 }
 function computeNotice(text){
  const el=byId('fi-fial53-compute-review');
  if(el)el.textContent=String(text).slice(0,9000);
 }
 function bindReviewedCompute(){
  const panel=byId('fi-fial53-compute-panel');
  const select=byId('fi-fial53-compute-kind'),data=byId('fi-fial53-compute-data');
  const prompt=byId('fi-fial53-compute-prompt');
  const prepare=byId('fi-fial53-compute-prepare');
  const confirm=byId('fi-fial53-compute-confirm');
  const cancel=byId('fi-fial53-compute-cancel');
  const explain=byId('fi-fial53-compute-explain');
  if(!panel||!select||!data||!prompt||!prepare||!confirm||!cancel||!explain)return;
  const reset=v=>{computeBusy=v;prepare.disabled=v;cancel.disabled=v;confirm.disabled=v||!pendingComputeToken};
  const example=()=>{
   pendingComputeToken=null;confirm.disabled=true;explain.hidden=true;
   data.value=JSON.stringify(exampleData[select.value]||{},null,2);
   computeNotice('Synthetic example loaded. Replace with your own data, then Prepare. No computation has executed.');
  };
  select.addEventListener('change',example);
  example();
  for(const field of [data,prompt]){
   field.addEventListener('input',()=>{
    if(pendingComputeToken){
     pendingComputeToken=null;confirm.disabled=true;
     computeNotice('Input edited after preparation. Click Prepare again to review the new exact data.');
    }
   });
  }
  prepare.addEventListener('click',async()=>{
   if(computeBusy)return;
   pendingComputeToken=null;explain.hidden=true;reset(true);
   try{
    const spec=JSON.parse(data.value);
    const value=await computeRequest('prepare',{kind:select.value,spec,prompt:prompt.value});
    if(value.state!=='awaiting_separate_operator_confirmation'||typeof value.authorizationToken!=='string')
     throw Error('Reviewed preparation not accepted');
    pendingComputeToken=value.authorizationToken;
    computeNotice('PREPARED — NOT EXECUTED\n'+JSON.stringify(value.preview,null,2)+
      '\nConfirm is a separate click. The token expires in two minutes; edits require Prepare again.');
   }catch(e){pendingComputeToken=null;computeNotice('Preparation held: '+String(e.message||e))}
   finally{reset(false)}
  });
  confirm.addEventListener('click',async()=>{
   if(computeBusy||!pendingComputeToken)return;
   const token=pendingComputeToken;
   pendingComputeToken=null;reset(true);
   computeNotice('Submitting exactly one approved local computation. No automatic retry.');
   try{
    const result=await computeRequest('confirm',{authorizationToken:token,operatorConfirmed:true});
    if(result.state==='verified_local_result'){
     computeNotice('VERIFIED LOCAL RESULT — operator approved\n'+String(result.resultPreview||'')+
       '\nReceipt: '+String(result.receipt?.receiptHash||'unknown')+
       '\nQwen can explain this result; it cannot rerun or modify the job.');
     explain.hidden=false;
    }else{
     explain.hidden=true;
     computeNotice('COMPUTE OUTCOME UNCERTAIN — DO NOT RETRY AUTOMATICALLY\n'+
       String(result.state||'unknown')+'\n'+String(result.reason||''));
    }
   }catch(e){
    explain.hidden=true;
    computeNotice('Compute submission failed or outcome unknown. Do not retry without review: '+String(e.message||e));
   }finally{reset(false)}
  });
  cancel.addEventListener('click',async()=>{
   if(computeBusy)return;
   pendingComputeToken=null;reset(true);
   try{await computeRequest('cancel',{});computeNotice('Pending compute cancelled. No computation submitted.')}
   catch(e){computeNotice('Cancel hold: '+String(e.message||e))}
   finally{explain.hidden=true;reset(false)}
  });
  explain.addEventListener('click',()=>{
   if(send.disabled)return;
   includeApprovedComputeOnce=true;
   query.value='Explain the last operator-approved optimization or ML result, its limitations, and the decision implications.';
   void submit();
  });
  // Status is observational; it never starts a solver or trains a model.
  void fetch('/api/fun/compute/status',{method:'GET',cache:'no-store'})
   .then(r=>r.ok?r.json():null).then(x=>{
    if(x?.version==='fun-reviewed-compute-v1')
     computeNotice('Reviewed ML + optimization available. One job per explicit confirmation. Synthetic example loaded.');
   }).catch(()=>{});
 }
 async function submit(){
  const question=query.value.trim();
  if(question.length<4||question.length>1200){status.textContent='Enter a question between 4 and 1200 characters.';return}
  let payload={question};
  if(byId('fi-fial53-math-evidence')?.checked)payload.useMathEvidence=true;
  if(byId('fi-fial53-math-v3-evidence')?.checked)payload.useMathV3Evidence=true;
  const reaFollowUp=includeApprovedReaOnce;
  const computeFollowUp=includeApprovedComputeOnce;
  includeApprovedReaOnce=false;includeApprovedComputeOnce=false;
  if(reaFollowUp)payload.explainApprovedRea=true;
  if(computeFollowUp)payload.explainApprovedCompute=true;
  const code=byId('fi-fial53-code')?.value||'';
  if(code.trim()&&!reaFollowUp&&!computeFollowUp){
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
   if(result.reviewedComputeSuggestion?.kind){
    const select=byId('fi-fial53-compute-kind'),panel=byId('fi-fial53-compute-panel');
    if(select&&[...select.options].some(o=>o.value===result.reviewedComputeSuggestion.kind)){
     select.value=result.reviewedComputeSuggestion.kind;
     select.dispatchEvent(new Event('change'));
     if(panel)panel.open=true;
     computeNotice('SUGGESTED — NO COMPUTATION EXECUTED. Review or replace the synthetic input data, then Prepare and separately Confirm.');
    }
   }
   if(result.state==='ANSWERED_BY_QWEN'){
    entry('Qwen',String(result.answer||''));
    status.textContent='Qwen answered · Cognee: '+String(result.memory_state||'unknown')+
     (result.fisre?.status?' · FISRE: '+String(result.fisre.status):'')+
     ' · read-only contexts: '+String(result.capabilities_referenced?.length||0)+
     (reaFollowUp?' · prior approved REA observation included':computeFollowUp?' · prior approved compute result included':' · no tools executed from chat');
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
 bindReviewedCompute();
 void check();
})();
