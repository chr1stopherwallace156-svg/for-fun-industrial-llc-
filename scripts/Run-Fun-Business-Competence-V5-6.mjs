// FIAL5.6 single-use CLI. No resident worker or external privileges.
import {runBusinessCompetenceCycle,readBusinessCompetenceStatus,OPERATOR_VERSION} from '../src/competence/business-operator-v5-6.mjs';
import {planBusinessDecision} from '../src/competence/business-knowledge-v5-6.mjs';
import {calculateFinancials,rankEvidenceBackedOptions} from '../src/competence/business-finance-v5-6.mjs';
import {reviewBusinessWriting} from '../src/competence/business-writing-v5-6.mjs';
import {inspectBusinessDocument,runValeCheck} from '../src/competence/optional-document-tools-v5-6.mjs';
async function stdinJson(){
 const chunks=[];let size=0;
 for await(const part of process.stdin){
  size+=part.length;if(size>8000)throw Error('FIAL56_STDIN_TOO_LARGE');
  chunks.push(part);
 }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
try{
 const action=process.argv[2];
 if(action==='--once'&&process.argv.length===3){
  const r=await runBusinessCompetenceCycle();
  if(r.version!==OPERATOR_VERSION||r.external_execution!=='NOT_PERFORMED'||
   Object.values(r.actions).some(x=>x!==0))throw Error('FIAL56_UNVERIFIED_RESULT');
  console.log('FIAL56_BUSINESS_COMPETENCE_CYCLE=PASS');
  console.log('FIAL56_ELIGIBLE_TASKS='+r.eligible_tasks);
  console.log('FIAL56_PACKETS_CREATED='+r.packets_created);
  console.log('FIAL56_FRAMEWORKS_AVAILABLE='+r.framework_count);
  console.log('FIAL56_EXTERNAL_ACTIONS=ZERO');
 }else if(action==='--status'&&process.argv.length===3){
  console.log(JSON.stringify(await readBusinessCompetenceStatus()));
 }else if(action==='--analyze-stdin'&&process.argv.length===3){
  const input=await stdinJson();
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.question!=='string')
   throw Error('FIAL56_QUESTION_REQUIRED');
  const result={
   plan:planBusinessDecision(input.question,{
    metrics:input.metrics||{},company:input.company||'ELEKTRON INDUSTRIAL LLC',
    evidence:input.evidence||[]}),
   calculations:calculateFinancials(input.metrics||{}),
   options:Array.isArray(input.options)?rankEvidenceBackedOptions(input.options):[],
   writing:input.writing?reviewBusinessWriting(input.writing,{audience:input.audience||'business'}):null,
   model_invocations:0,emails_sent:0,government_filings:0,rea_calls:0
  };
  console.log(JSON.stringify(result));
 }else if(action==='--document'&&process.argv.length===4){
  const r=await inspectBusinessDocument(process.argv[3]);console.log(JSON.stringify({
   version:r.version,state:r.state,chars:typeof r.text==='string'?r.text.length:0,
   sample:typeof r.text==='string'?r.text.slice(0,3000):null,
   source_is_untrusted:true,external_actions:0}));
 }else if(action==='--vale'&&process.argv.length===4){
  console.log(JSON.stringify(await runValeCheck(process.argv[3])));
 }else{
  throw Error('FIAL56_ALLOWED=--once|--status|--analyze-stdin|--document <local_file>|--vale <local_file>');
 }
}catch(e){
 console.error('FIAL56_HOLD='+String(e.message||e).slice(0,230));
 process.exitCode=1;
}
