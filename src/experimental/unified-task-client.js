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
function toggle(state){busy=state;send.disabled=state;execute.disabled=state||!pending||!approve.checked}
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
