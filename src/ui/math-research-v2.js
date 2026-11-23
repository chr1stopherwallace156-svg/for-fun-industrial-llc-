// Fun Industrial V2 read-only display. Only explicit operator click sends to Qwen.
const $=id=>document.getElementById(id);
const str=x=>x==null?'—':String(x);
const pct=x=>typeof x==='number'?x.toFixed(5):'—';
function cell(s){const td=document.createElement('td');td.textContent=str(s);return td}
function metric(name,value){const div=document.createElement('div');div.className='metric';const small=document.createElement('span');small.textContent=name;const strong=document.createElement('strong');strong.textContent=str(value);div.append(small,strong);return div}
async function refresh(){
 const status=$('fi-math-status'),metrics=$('fi-math-metrics'),rows=$('fi-math-periods');
 status.textContent='Reading verified local report…';metrics.replaceChildren();rows.replaceChildren();
 try{
  const r=await fetch('/api/fun/math/status',{cache:'no-store',headers:{accept:'application/json'}});
  if(!r.ok)throw Error('Math status HTTP '+r.status);
  const d=await r.json();
  if(!d.ready){status.textContent='V2 report not yet ready: '+str(d.state);return}
  status.textContent=(d.stale?'Cached or stale evidence':'Verified local report')+' · last draw '+d.latestDraw+
   ' · SHA-256 '+d.datasetSha256.slice(0,12)+'…';
  for(const [k,v] of [['Drawings',d.draws],['Generated equations',d.equations],['Last draw',d.latestDraw],['Conclusion','No verified predictive edge']])metrics.append(metric(k,v));
  for(const [year,period] of Object.entries(d.periods||{})){
   const tr=document.createElement('tr');
   for(const v of [year,period.selected||period.status,period.testMeanLogGain,pct(period.pCorrectedAcrossEras)])tr.append(cell(v));
   rows.append(tr);
  }
  $('fi-math-future').textContent='Future-only protocol: '+str(d.future?.status)+
   ' · Frozen at: '+str(d.future?.frozenAt)+' · Independently scored future draws: '+str(d.future?.futureScored);
 }catch(e){status.textContent='Report access failed: '+String(e.message).slice(0,180)}
}
let busy=false;
async function ask(){
 if(busy)return;
 const question=$('fi-math-question').value.trim();
 if(question.length<4||question.length>1200){$('fi-math-answer').textContent='Question must contain 4–1200 characters';return}
 busy=true;$('fi-math-ask').disabled=true;$('fi-math-answer').textContent='Asking the existing local Qwen worker…';
 try{
  const r=await fetch('/api/fial/grounded/chat',{method:'POST',
   headers:{'content-type':'application/json','x-fi-chat-click':'one-local-model-response'},
   body:JSON.stringify({question,useMathEvidence:true})});
  const d=await r.json();
  if(!r.ok)throw Error(d.error||'Qwen route HTTP '+r.status);
  $('fi-math-answer').textContent=d.answer||('No model answer. State: '+str(d.state));
 }catch(e){$('fi-math-answer').textContent='Qwen or evidence unavailable: '+String(e.message).slice(0,220)}
 finally{busy=false;$('fi-math-ask').disabled=false}
}
$('fi-math-refresh').addEventListener('click',refresh);
$('fi-math-ask').addEventListener('click',ask);
refresh();
