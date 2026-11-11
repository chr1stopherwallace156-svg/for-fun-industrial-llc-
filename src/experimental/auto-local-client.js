/* FI_AUTO_LOCAL_DASHBOARD_CLIENT_V2 — standalone panel, no dependency on old chat IDs. */
(()=>{'use strict';
const byId=id=>document.getElementById(id);
const button=byId('fi-auto-run'),state=byId('fi-auto-state');
const prompt=byId('fi-auto-task'),out=byId('fi-auto-output');
if(!button||!state||!prompt||!out)return;
let busy=false;
function write(value){
 const node=document.createElement('div');
 node.style.whiteSpace='pre-wrap';node.style.overflowWrap='anywhere';
 node.textContent=String(value).slice(0,12000);
 out.appendChild(node);out.scrollTop=out.scrollHeight;
}
button.addEventListener('click',async()=>{
 if(busy)return;
 const task=prompt.value.trim();
 if(task.length<3||task.length>2000){
  state.textContent='Task must be 3–2000 characters';return;
 }
 busy=true;button.disabled=true;
 state.textContent='One operator-started local execution session running…';
 out.textContent='';write('Requested task: '+task);
 try{
  const response=await fetch('/api/ai/auto-local/run',{
   method:'POST',credentials:'same-origin',
   headers:{'content-type':'application/json','x-fi-auto-local':'operator-click'},
   body:JSON.stringify({prompt:task,rounds:2})
  });
  const data=await response.json();
  if(!response.ok)throw Error(String(data.error||('HTTP '+response.status)));
  const actions=Array.isArray(data.actions)?data.actions:[];
  for(const item of actions){
   write('Executed '+String(item.tool||'?')+' (round '+String(item.round||'?')+')');
   write(JSON.stringify(item.result).slice(0,5000));
  }
  write('AI: '+String(data.reply||'(no text response)'));
  state.textContent=String(data.state||'complete')+
   ' · executions: '+actions.length+
   ' · registered local: '+String(data.registeredLocal||0)+
   ' · REA unchanged';
  prompt.value='';
 }catch(error){
  const reason=String(error?.message||error).slice(0,240);
  write('HOLD — '+reason);
  state.textContent='HOLD: '+reason;
 }finally{busy=false;button.disabled=false}
});
})();
