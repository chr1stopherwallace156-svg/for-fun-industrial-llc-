// Primary Fun Industrial dashboard Qwen chat. Same-origin, user-submit only.
(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const box=byId('fi-fial53-grounded'),send=byId('fi-fial53-send'),
  query=byId('fi-fial53-question'),history=byId('fi-fial53-history'),
  status=byId('fi-fial53-status');
 if(!box||!send||!query||!history||!status)return;
 function entry(kind,text){
  const article=document.createElement('article');
  article.style.cssText='padding:12px;border:1px solid #345269;border-radius:10px;background:#0e1c2b;white-space:pre-wrap;overflow-wrap:anywhere';
  const title=document.createElement('strong');title.textContent=kind;
  const content=document.createElement('div');content.textContent=text;
  article.append(title,content);history.append(article);
  article.scrollIntoView({block:'nearest',behavior:'auto'});
 }
 async function check(){
  try{
   const r=await fetch('/api/fial/grounded/status',{method:'GET',cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   if(data.model_interface!=='fixed_local_qwen_8088'||data.memory_interface!=='fixed_readonly_cognee_8789')throw Error('UNVERIFIED_QWEN_OR_MEMORY');
   status.textContent='Local Qwen and contextual memory interface configured. Ready for a question.';
  }catch(e){status.textContent='Chat status unavailable: '+String(e.message||e)}
 }
 async function submit(){
  const question=query.value.trim();
  if(question.length<4||question.length>1200){status.textContent='Enter a question between 4 and 1200 characters.';return}
  send.disabled=true;entry('You',question);query.value='';
  status.textContent='Checking relevant memory and requesting one local Qwen response…';
  try{
   const response=await fetch('/api/fial/grounded/chat',{method:'POST',
    credentials:'same-origin',headers:{'content-type':'application/json',
     'x-fi-chat-click':'one-local-model-response'},
    body:JSON.stringify({question})});
   const result=await response.json();
   if(!response.ok)throw Error('HTTP '+response.status+': '+String(result.error||'request held'));
   if(result.state==='ANSWERED_BY_QWEN'){
    entry('Qwen',String(result.answer||''));status.textContent=
     'Qwen answered · Cognee: '+String(result.memory_state||'unknown')+
     ' · excerpts: '+String(result.memory_excerpts_included||0)+' · no tools executed';
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
 void check();
})();
