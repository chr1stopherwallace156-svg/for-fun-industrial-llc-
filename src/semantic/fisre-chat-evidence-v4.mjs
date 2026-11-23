// Bounded text evidence adapter for the ONE existing Qwen chat at 8802.
// Models receive static FISRE results; they cannot invoke the code analyzer or tools.
const hold=x=>{throw Error('FISRE_CHAT_EVIDENCE_'+x)};
export function createFisreChatEvidence(result,source){
 if(!result||result.version!=='fun-fisre-live-v4'||
    result.state!=='SOURCE_ANALYZED_AND_REPLAYED'||
    result.source_executed!==false||result.authority_granted!==false||
    result.replay?.state!=='SOURCE_BOUND_REPLAY_MATCH'||
    result.replay?.independently_proved!==false||
    result.cognitive?.claim?.status!=='proposed'||
    typeof source!=='string')hold('INVALID_SOURCE_OR_REPORT');
 const checks=(result.proof?.division_checks||[]).slice(0,6).map(c=>({
  line:c.line,expression:String(c.expression||'').slice(0,120),
  status:c.status,minimum:c.minimum,maximum:c.maximum,witness:c.witness||null
 }));
 const functions=(result.source?.functions||[]).slice(0,6).map(f=>({
  name:f.name,parameters:(f.parameters||[]).slice(0,10),
  internal_call_candidates:(f.internal_calls||[]).slice(0,5),
  effect_candidates:(f.suspected_effects||[]).slice(0,5),
  unresolved_calls:(f.unresolved_calls||[]).slice(0,5)
 }));
 const evidence={
  kind:'untrusted_local_static_analysis_data',
  source_sha256:result.source?.sha256,
  proof_status:result.proof?.status,
  proof_reason:result.proof?.reason,
  domain:result.proof?.domain,
  divisions:checks,
  functions,
  replay_status:result.replay?.state,
  independently_verified:false,
  cognitive_claim_status:'proposed',
  source_executed:false,
  source_excerpt_not_executable:source.slice(0,900)
 };
 // Very small model context on 16GB host: prioritize verdict, scope, functions.
 let text=JSON.stringify(evidence);
 if(text.length>3650){
  evidence.source_excerpt_not_executable=source.slice(0,240);
  evidence.functions=functions.slice(0,3);
  evidence.divisions=checks.slice(0,3);
  text=JSON.stringify(evidence);
 }
 if(text.length>3650)hold('EVIDENCE_TOO_LARGE');
 return text;
}
