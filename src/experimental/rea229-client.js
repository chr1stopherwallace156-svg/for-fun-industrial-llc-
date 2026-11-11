/* FI_REA229_BROWSER_V1 — same-origin explicit operator-started REA tool session */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const state=$('rea-state'),task=$('rea-task'),output=$('rea-output');
const run=$('rea-run'),search=$('rea-search'),term=$('rea-search-text'),results=$('rea-search-results');
const exact=$('rea-exact-run'),exactName=$('rea-exact-name'),exactArgs=$('rea-exact-args');
let busy=false;
function note(text){
 const node=document.createElement('div');
 node.className='log';
 node.textContent=String(text).slice(0,12000);
 output.appendChild(node);output.scrollTop=output.scrollHeight;
}
async function api(path,body=null){
 const response=await fetch(path,{method:body?'POST':'GET',
  headers:body?{'content-type':'application/json','x-fi-rea229':'operator-click'}:{},
  body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||('HTTP '+response.status));
 return data;
}
function toggle(value){busy=value;run.disabled=value;exact.disabled=value;search.disabled=value}
async function action(title,body,path){
 if(busy)return;
 output.textContent='';
 note('Operator request: '+title);
 toggle(true);state.textContent='REA MCP tool execution in progress…';
 try{
  const data=await api(path,body);
  const actions=Array.isArray(data.actions)?data.actions:(data.tool?[data]:[]);
  for(const a of actions){
   note('EXECUTED REA tool: '+String(a.tool)+(a.round?' · round '+a.round:''));
   const value=a.summary||JSON.stringify(a.result??null);
   note(String(value).slice(0,12000));
  }
  if(!actions.length)note('No REA tool was executed in this session.');
  if(data.reply)note('Qwen: '+data.reply);
  state.textContent=String(data.state||'done')+' · REA=229 real tools · actions='+actions.length;
 }catch(error){note('HOLD: '+String(error.message||error));state.textContent='HOLD: '+String(error.message||error).slice(0,180)}
 finally{toggle(false)}
}
run.addEventListener('click',()=>{
 const p=task.value.trim();
 if(p.length<3||p.length>2000){state.textContent='Enter a task of 3–2000 characters';return}
 action(p,{prompt:p,rounds:2},'/api/rea229/run');
});
search.addEventListener('click',async()=>{
 if(busy)return;
 try{
  const data=await api('/api/rea229/tools?query='+encodeURIComponent(term.value.trim())+'&limit=8');
  results.textContent='';
  for(const item of data.tools){
   const row=document.createElement('div');row.className='log';
   const button=document.createElement('button');button.textContent=item.name;
   button.type='button';button.addEventListener('click',()=>{
    exactName.value=item.name;
    exactArgs.value='{}';
   });
   row.appendChild(button);
   const description=document.createElement('span');description.textContent=' '+String(item.description||'').slice(0,350);
   row.appendChild(description);results.appendChild(row);
  }
  state.textContent='Found '+data.returned+' matching tools out of '+data.total+' verified real REA tools';
 }catch(error){state.textContent='HOLD: '+String(error.message||error).slice(0,180)}
});
exact.addEventListener('click',()=>{
 const name=exactName.value.trim();
 let args;
 try{args=JSON.parse(exactArgs.value)}
 catch{state.textContent='Invalid arguments JSON';return}
 if(!args||typeof args!=='object'||Array.isArray(args)){state.textContent='Arguments must be a JSON object';return}
 if(!name){state.textContent='Choose an existing REA tool first';return}
 action(name,{name,arguments:args},'/api/rea229/call');
});
api('/api/rea229/status').then(data=>{
 if(data.liveMcpHealth!=='ready'||data.realReaToolCount!==229)throw Error('REA_MCP_SESSION_NOT_READY');
 state.textContent='READY · '+data.realReaToolCount+' real MCP tools · no per-tool confirmation prompts';
}).catch(error=>state.textContent='HOLD: '+String(error.message));
})();
