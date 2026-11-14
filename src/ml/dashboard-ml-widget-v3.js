/* FI_FUN_UNIFIED_ML_PANEL_V3: panel embedded in the current dashboard via local hub. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const panel=$('fi-ml-panel');if(!panel)return;
const prompt=$('fi-ml-prompt'),dataset=$('fi-ml-data'),training=$('fi-ml-train-approve'),
  run=$('fi-ml-run'),result=$('fi-ml-result'),state=$('fi-ml-status');
let busy=false;
function show(text){result.textContent=String(text).slice(0,40000)}
async function status(){
  try{
    const response=await fetch('/api/ml/dashboard/status',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'status failed');
    state.textContent=data.state==='ready'?
      'Ready · scikit-learn + local Qwen · training requires approval':
      'ML unavailable: '+String(data.reason||'unverified');
  }catch(e){state.textContent='ML status hold: '+String(e.message||e)}
}
run.addEventListener('click',async()=>{
  if(busy)return;
  let data;
  try{data=JSON.parse(dataset.value)}catch{show('Input must be valid JSON.');return}
  busy=true;run.disabled=true;show('Running verified local scikit-learn task...');
  try{
    const response=await fetch('/api/ml/dashboard/run',{
      method:'POST',headers:{'content-type':'application/json','x-fi-ml':'operator-click'},
      body:JSON.stringify({prompt:prompt.value,data,operatorConfirmed:training.checked})
    });
    const value=await response.json();
    if(!response.ok)throw Error(value.error||'ML task failed');
    show(JSON.stringify(value,null,2));
  }catch(e){show('FUN_ML_HOLD: '+String(e.message||e))}
  finally{busy=false;run.disabled=false;training.checked=false}
});
status();
})();
