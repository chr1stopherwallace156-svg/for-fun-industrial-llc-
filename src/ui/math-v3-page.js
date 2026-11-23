// Same-origin client; no eval, web fetching, autonomous job starts or writes.
(()=>{'use strict';
const $=s=>document.getElementById(s), str=v=>v==null?'—':String(v);
function number(v){return typeof v==='number'?v.toFixed(6):'—'}
function metric(label,value){const root=document.createElement('div');root.className='stat';
 const name=document.createElement('span');name.textContent=label;
 const val=document.createElement('strong');val.textContent=str(value);
 root.append(name,val);return root}
async function loadStatus(){
 $('fi-v3-status').textContent='Verifying the local research report…';
 try{
  const res=await fetch('/api/fun/math/v3/status',{cache:'no-store'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const d=await res.json();if(!d.ready)throw Error(d.state||'unavailable');
  $('fi-v3-status').textContent='Verified report · Source SHA-256 '+d.sourceSha256.slice(0,12)+'…'+(d.stale?' · STALE':'');
  const stats=$('fi-v3-stats');stats.replaceChildren();
  [['Validated drawings',d.draws],['Equation candidates per era',d.equationsPerEra],['Latest drawing',d.lastDraw],['Conclusion','No verified predictive edge']].forEach(([k,v])=>stats.append(metric(k,v)));
  const f=d.prospective||{};
  $('fi-v3-future').textContent='Future protocol: '+str(f.state)+' · Freeze: '+str(f.frozenAt)+
     ' · Future draws evaluated: '+str(f.futureScored)+' · Mixture e-value: '+str(f.eValue)+
     ' · Pre-registered threshold: '+str(f.threshold)+' · Crossed: '+String(f.crossed===true);
 }catch(e){$('fi-v3-status').textContent='Report unavailable: '+String(e.message||e).slice(0,180)}
}
async function loadCandidates(){
 const era=$('fi-v3-era').value,status=$('fi-v3-rows-state'),rows=$('fi-v3-rows');
 rows.replaceChildren();status.textContent='Reading all 138 candidate scores…';
 try{
  const res=await fetch('/api/fun/math/v3/candidates?era='+encodeURIComponent(era),{cache:'no-store'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const d=await res.json();if(!d.ready)throw Error(d.state||'candidate source unavailable');
  const sorted=[...d.rows].sort((a,b)=>b.validationRankScore-a.validationRankScore||a.name.localeCompare(b.name));
  for(const item of sorted){const tr=document.createElement('tr');
   for(const text of [item.name,number(item.validationMeanLogGain),number(item.historicalTestMeanLogGain)]){
    const td=document.createElement('td');td.textContent=str(text);tr.append(td)}rows.append(tr)}
  status.textContent='Showing '+sorted.length+' equations, sorted by validation score. No historical-test-based selection.';
 }catch(e){status.textContent='Candidate evidence held: '+String(e.message||e).slice(0,170)}
}
let asking=false;
async function askQwen(){if(asking)return;
 const question=$('fi-v3-question').value.trim();
 if(question.length<4||question.length>1200){$('fi-v3-answer').textContent='Question must be 4–1200 characters.';return}
 asking=true;$('fi-v3-ask').disabled=true;$('fi-v3-answer').textContent='Requesting one local Qwen reply with V3 research evidence…';
 try{
  const res=await fetch('/api/fial/grounded/chat',{method:'POST',credentials:'same-origin',
   headers:{'content-type':'application/json','x-fi-chat-click':'one-local-model-response'},
   body:JSON.stringify({question,useMathV3Evidence:true})});
  const d=await res.json();if(!res.ok)throw Error('HTTP '+res.status+' '+(d.error||''));
  $('fi-v3-answer').textContent=d.state==='ANSWERED_BY_QWEN'?String(d.answer||''):
     'No verified Qwen answer: '+str(d.reason||d.warning||d.state);
 }catch(e){$('fi-v3-answer').textContent='Chat unavailable: '+String(e.message||e).slice(0,250)}
 finally{asking=false;$('fi-v3-ask').disabled=false}
}
$('fi-v3-era').addEventListener('change',loadCandidates);
$('fi-v3-refresh').addEventListener('click',()=>{void loadStatus();void loadCandidates()});
$('fi-v3-ask').addEventListener('click',askQwen);
void loadStatus();void loadCandidates();
})();