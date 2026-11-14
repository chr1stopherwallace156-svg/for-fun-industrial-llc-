// FIAL5.6 lightweight executive analysis interface, local 8802 only.
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const state=$('fi-competence-state'),result=$('fi-competence-output'),
  list=$('fi-competence-list'),question=$('fi-competence-question'),
  button=$('fi-competence-analyze');
 if(!state||!result||!list||!question||!button)return;
 function add(parent,label,value){
  const p=document.createElement('p'),b=document.createElement('strong');
  b.textContent=label+': ';p.append(b,document.createTextNode(String(value??'Unknown')));
  parent.append(p);
 }
 async function load(){
  try{
   const r=await fetch('/api/operator/competence/status',{method:'GET',cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   if(data.version!=='fial5.6-business-operator-v1')throw Error('UNVERIFIED_VERSION');
   state.textContent=data.state==='NOT_ACTIVATED'?'Business layer not yet activated':
    'Last scheduled analysis: '+String(data.cycle_utc||'unknown')+
    ' · items '+String(data.tracked_tasks||0)+
    ' · new local packets '+String(data.packets_created||0)+
    ' · external actions: none';
   list.replaceChildren();
   const tasks=Array.isArray(data.tasks)?data.tasks:[];
   for(const t of tasks.slice(0,25)){
    const section=document.createElement('div');section.className='item';
    add(section,'Work item',String(t.title||'Untitled').slice(0,160));
    add(section,'Business methods',Array.isArray(t.framework_ids)?t.framework_ids.join(', '):'None matched');
    add(section,'State','Local plan prepared; not a completed business decision');
    list.append(section);
   }
   if(!tasks.length)add(list,'Analysis queue','No evidence-backed work items analyzed yet');
  }catch(e){state.textContent='Business competence status HOLD: '+String(e.message||e).slice(0,160)}
 }
 async function analyze(){
  const q=question.value.trim();
  if(q.length<4||q.length>1000){result.textContent='Enter a business question between 4 and 1,000 characters.';return}
  button.disabled=true;result.replaceChildren();add(result,'Status','Analyzing locally with deterministic business methods…');
  try{
   const r=await fetch('/api/operator/competence/analyze',{
    method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json','x-fi-business-click':'one-local-decision-analysis'},
    body:JSON.stringify({question:q})});
   const data=await r.json();
   if(!r.ok)throw Error('HTTP '+r.status+' '+String(data.error||'request held'));
   if(data.plan?.version!=='fial5.6-business-competence-v1')throw Error('UNVERIFIED_PLAN');
   result.replaceChildren();
   add(result,'Status',String(data.plan.state));
   add(result,'Verified business decision','NOT YET — evidence and responsible approval required');
   for(const f of data.plan.frameworks||[]){
    add(result,String(f.name||'Business method'),String(f.reason||''));
    add(result,'Evidence required',Array.isArray(f.evidence_required)?f.evidence_required.join('; '):'Unknown');
   }
   add(result,'Next step',String(data.plan.next_step||'Collect evidence'));
   add(result,'Model / tool execution','None; existing Qwen Chat separately supports conceptual explanations');
  }catch(e){result.replaceChildren();add(result,'Analysis HOLD',String(e.message||e).slice(0,180))}
  finally{button.disabled=false}
 }
 const finance=$('fi-finance-input'),financeButton=$('fi-finance-calculate'),financeResult=$('fi-finance-result');
 const writing=$('fi-writing-input'),writingButton=$('fi-writing-check'),writingResult=$('fi-writing-result');
 async function oneClick(path,body,click){
  const r=await fetch(path,{method:'POST',credentials:'same-origin',
   headers:{'content-type':'application/json','x-fi-business-click':click},
   body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok)throw Error('HTTP '+r.status+' '+String(data.error||'request held'));
  return data;
 }
 async function financeCase(){
  if(!finance||!financeResult||!financeButton)return;
  let values;
  try{
   if(!finance.value.trim()||finance.value.length>1600)throw Error('Enter JSON numeric scenario values (maximum 1,600 characters).');
   values=JSON.parse(finance.value);
   if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Expected a JSON object.');
  }catch(e){financeResult.textContent=String(e.message||e);return}
  financeButton.disabled=true;financeResult.replaceChildren();
  try{
   const data=await oneClick('/api/operator/competence/finance',
    {metrics:values},'one-local-financial-calculation');
   if(data.claim_verified!==false)throw Error('Unexpected finance verification claim');
   add(financeResult,'Financial evidence','Operator-supplied scenario only; not verified company actuals');
   for(const [label,output] of Object.entries(data.calculations||{})){
    const compact=Object.entries(output||{}).map(([k,v])=>k+'='+String(v===null?'unknown':v)).join(' · ');
    add(financeResult,label.replaceAll('_',' '),compact.slice(0,500));
   }
  }catch(e){add(financeResult,'Finance HOLD',String(e.message||e).slice(0,180))}
  finally{financeButton.disabled=false}
 }
 async function writingCase(){
  if(!writing||!writingButton||!writingResult)return;
  const draft=writing.value;
  if(!draft.trim()||draft.length>4000){writingResult.textContent='Paste a writing draft of up to 4,000 characters.';return}
  writingButton.disabled=true;writingResult.replaceChildren();
  try{
   const data=await oneClick('/api/operator/competence/writing',
    {draft},'one-local-writing-review');
   if(data.review?.version!=='fial5.6-business-writing-v1')throw Error('Unexpected writing result');
   add(writingResult,'Heuristic review','Suggestions only; grammar and factual accuracy are not certified');
   const issues=Array.isArray(data.review.issues)?data.review.issues:[];
   for(const item of issues.slice(0,25))add(writingResult,item.code+' (line '+String(item.line??'general')+')',item.suggestion);
   if(!issues.length)add(writingResult,'Findings','No issues detected by the limited local rules');
  }catch(e){add(writingResult,'Writing HOLD',String(e.message||e).slice(0,160))}
  finally{writingButton.disabled=false}
 }
 if(financeButton)financeButton.addEventListener('click',financeCase);
 if(writingButton)writingButton.addEventListener('click',writingCase);
 button.addEventListener('click',analyze);
 question.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();if(!button.disabled)void analyze()}
 });
 void load();
})();
