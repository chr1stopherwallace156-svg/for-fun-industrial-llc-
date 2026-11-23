/* Fun Industrial Semantic Reasoning: strictly same-origin, click-only.
   No auto-run, no local storage, no dynamic HTML or dynamic code evaluation. */
(()=>{'use strict';
const get=id=>document.getElementById(id);
const form=get('fi-form');
if(!form)return;
const msg=get('fi-message'),button=get('fi-run');
const limitLines=(x,n=30)=>String(x||'').split('\n').slice(0,n).join('\n');
function format(report){
 const p=report.proof||{},r=report.replay||{},s=report.source||{},c=report.cognitive||{};
 const lines=[
  'Source SHA-256: '+(s.sha256||'unknown'),
  'Functions identified: '+String(s.functions_total??0),
  'Imports: '+(s.imports?.join(', ')||'(none)'),
  'Call relationships: '+String(s.call_edges?.length||0),
  '',
  'MATHEMATICAL CONSTRAINTS',
  'Function: '+String(p.function||'unknown'),
  'Status: '+String(p.status||'UNKNOWN'),
  'Reason: '+String(p.reason||'unknown'),
  ...((p.division_checks||[]).slice(0,30).map(d=>
   'Line '+d.line+' — '+d.expression+' : '+d.status+
   (d.minimum===undefined?'':(' ['+d.minimum+', '+d.maximum+']'))+
   (d.witness?' witness='+JSON.stringify(d.witness):''))),
  '',
  'FUNCTION & CAPABILITY EVIDENCE',
  ...((s.functions||[]).slice(0,50).flatMap(fn=>[
   fn.name+'('+((fn.parameters||[]).join(', '))+') · line '+fn.line,
   '  Internal candidates: '+(fn.internal_calls?.join(', ')||'none'),
   '  Unresolved calls: '+(fn.unresolved_calls?.join(', ')||'none'),
   '  Effect candidates: '+(fn.suspected_effects?.join(', ')||'none'),
   '  Potential divisor hazards: '+(fn.divisor_risks?.length||0)
  ])),
  '',
  'SOURCE REPLAY & COGNITION',
  'Replay: '+(r.state||'NOT_VERIFIED'),
  'Source hash matched: '+String(r.selected_source_matched_report===true),
  'Same-analyzer replay matched: '+String(r.analyzer_replay_matched===true),
  'Independently proved: '+String(r.independently_proved===true),
  'Cognitive status: '+String(c.claim?.status||'not-created'),
  'Claim: '+String(c.claim?.object||'unknown'),
  'Persisted: '+String(c.persisted===true),
  'External actions: '+String(report.external_actions??0),
  'Authority granted: '+String(report.authority_granted===true),
  '',
  'Limits: This is supported rational-arithmetic reasoning; not general Python runtime verification.'
 ];
 return limitLines(lines.join('\n'),320);
}
form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(button.disabled)return;
 msg.dataset.error='false';msg.textContent='Analyzing locally…';
 button.disabled=true;
 get('fi-result').hidden=true;
 try{
  const ranges=get('fi-range').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!ranges.length||ranges.length>16)throw Error('Enter 1–16 rational input ranges.');
  const req={source:get('fi-source').value,function:get('fi-function').value.trim(),ranges};
  const controller=new AbortController();
  // No automatic job retry; operator controls each analysis.
  const response=await fetch('/api/fisre/analyze',{method:'POST',credentials:'same-origin',
   headers:{'content-type':'application/json','x-fi-fisre':'operator-click'},
   body:JSON.stringify(req),signal:controller.signal});
  const out=await response.json();
  if(!response.ok)throw Error(String(out.error||'Analysis refused'));
  if(out.state!=='SOURCE_ANALYZED_AND_REPLAYED'||out.replay?.state!=='SOURCE_BOUND_REPLAY_MATCH')
   throw Error('Unsupported analysis result.');
  get('fi-verdict').textContent=out.proof?.status||'UNKNOWN';
  get('fi-details').textContent=format(out);
  get('fi-result').hidden=false;
  get('fi-empty').hidden=true;
  msg.textContent='Source analyzed. Rational proof replayed; cognitive claim remains proposed.';
 }catch(error){
  msg.dataset.error='true';
  msg.textContent=String(error?.message||error).slice(0,220);
 }finally{button.disabled=false}
});
})();