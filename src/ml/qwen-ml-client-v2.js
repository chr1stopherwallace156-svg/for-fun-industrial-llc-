// Fun Industrial Qwen-ML V2 browser client. User submits one bounded ML task at a time.
(()=>{'use strict';
const $=id=>document.getElementById(id);
const result=$('result'),button=$('run');
async function status(){
  try{
    const r=await fetch('/api/ml/status',{cache:'no-store'});
    if(!r.ok)throw Error('HTTP '+r.status);
    const s=await r.json();
    $('health').textContent='ML bridge: '+(s.pythonInstalled?'installed':'not installed')+
      ' | trained models require explicit approval | Qwen port '+s.qwenPort+
      ' | No REA or external-action authority';
  }catch(e){$('health').textContent='Service status unavailable: '+e.message}
}
button.addEventListener('click',async()=>{
  button.disabled=true;
  result.textContent='Running local ML task…';
  try{
    const prompt=$('prompt').value;
    const data=JSON.parse($('data').value);
    const response=await fetch('/api/ml/run',{
      method:'POST',headers:{'content-type':'application/json','x-fi-ml':'operator-click'},
      body:JSON.stringify({prompt,data,operatorConfirmed:$('approve').checked})
    });
    const value=await response.json();
    if(!response.ok)throw Error(value.error||'HTTP '+response.status);
    result.textContent=JSON.stringify(value,null,2);
  }catch(e){result.textContent='ML HOLD: '+String(e.message).slice(0,300)}
  finally{button.disabled=false;status()}
});
status();
})();
