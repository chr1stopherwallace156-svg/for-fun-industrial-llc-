import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {planBusinessDecision} from '../src/competence/business-knowledge-v5-6.mjs';
const source='<html><head><title>Hub</title></head><body><main id="legacy">REA tools remain</main></body></html>';
const widget='(function(){window.syntheticWidget=true})();'+' '.repeat(100);
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_RUN')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({trends:null,shopify:null})};
const stubStatus=()=>({version:'fial5.6-business-operator-v1',state:'EXECUTED_LOCAL_BUSINESS_COMPETENCE_CYCLE',
 tasks:[],tracked_tasks:0,packets_created:0,actions:{mail_sent:0,government_filings:0,
 purchases:0,code_mutations:0,rea_executions:0,model_invocations:0}});
async function serve(executor,{businessPlan=planBusinessDecision,businessStatus=async()=>stubStatus()}={}){
 const server=createUnifiedMlHub({ml,commerce,businessStatus,businessPlan,
  readPage:async()=>source,readWidget:async()=>widget,
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 try{await executor(server)}finally{await new Promise(resolve=>server.close(resolve))}
}
function fetchLocal(server,path,{method='GET',body,origin,click,host='127.0.0.1:8802'}={}){
 return new Promise((resolve,reject)=>{
  const headers={host};
  if(origin)headers.origin=origin;
  if(click)headers['x-fi-business-click']=typeof click==='string'?click:'one-local-decision-analysis';
  if(body!==undefined){headers['content-type']='application/json';headers['content-length']=Buffer.byteLength(body)}
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method,headers},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));
   res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString('utf8')}))});
  req.on('error',reject);req.end(body);
 })
}
test('new business-analysis panel shares original operations console without losing legacy tools',()=>{
 assert.match(EXEC_PAGE,/fi-competence/);
 assert.match(EXEC_PAGE,/api\/operator\/competence\/client.js/);
 assert.match(EXEC_PAGE,/fi-real-work/);
 assert.match(EXEC_PAGE,/Qwen Chat/);
 assert.match(EXEC_PAGE,/Tools &amp; Review/);
});
test('business client always uses textContent and explicit local user click',async()=>{
 const content=await readFile(new URL('../src/competence/business-console-v5-6.js',import.meta.url),'utf8');
 assert.match(content,/textContent/);
 assert.match(content,/x-fi-business-click/);
 assert.doesNotMatch(content,/innerHTML\s*=|eval\(|setInterval\(|fetch\(['"]https?:\/\/|messages\/send/);
});
test('primary dashboard provides GET saved status with zero side effects and no process actions',async()=>{
 let statuses=0,plans=0;
 await serve(async server=>{
  const p=await fetchLocal(server,'/operations/');assert.equal(p.status,200);
  assert.match(p.text,/Business Competence/);
  const js=await fetchLocal(server,'/api/operator/competence/client.js');assert.equal(js.status,200);
  assert.match(js.text,/one-local-decision-analysis/);
  const status=await fetchLocal(server,'/api/operator/competence/status');
  assert.equal(status.status,200);assert.equal(JSON.parse(status.text).tracked_tasks,0);
  assert.equal(statuses,1);assert.equal(plans,0);
  assert.equal((await fetchLocal(server,'/api/operator/competence/status',{method:'POST'})).status,404);
  assert.equal((await fetchLocal(server,'/operations/',{host:'attacker.invalid'})).status,403);
 },{businessStatus:async()=>{statuses++;return stubStatus()},businessPlan:()=>{plans++;throw Error('NOT_ALLOWED')}});
});
test('business analysis requires exact same-origin explicit click; one deterministic plan only',async()=>{
 let plans=0;const body=JSON.stringify({question:'Evaluate pricing strategy for vehicle fleet conversion'});
 await serve(async server=>{
  assert.equal((await fetchLocal(server,'/api/operator/competence/analyze',{method:'POST',body})).status,403);
  assert.equal((await fetchLocal(server,'/api/operator/competence/analyze',{method:'POST',body,origin:'http://evil.invalid',click:true})).status,403);
  assert.equal((await fetchLocal(server,'/api/operator/competence/analyze',{method:'POST',body,origin:'http://127.0.0.1:8802'})).status,403);
  assert.equal((await fetchLocal(server,'/api/operator/competence/analyze',{method:'POST',body:JSON.stringify({bad:true}),origin:'http://127.0.0.1:8802',click:true})).status,422);
  assert.equal(plans,0);
  const pass=await fetchLocal(server,'/api/operator/competence/analyze',{method:'POST',body,origin:'http://127.0.0.1:8802',click:true});
  assert.equal(pass.status,200);const parsed=JSON.parse(pass.text);
  assert.equal(parsed.plan.version,'fial5.6-business-competence-v1');
  assert.equal(parsed.plan.decision_reached,false);
  assert.equal(parsed.tool_executions,0);
  assert.equal(parsed.model_invocations,0);
  assert.equal(plans,1);
 },{businessPlan:question=>{plans++;return planBusinessDecision(question)}});
});
test('elevated business status or fabricated local decision fails closed',async()=>{
 await serve(async server=>{
  const req=await fetchLocal(server,'/api/operator/competence/status');
  assert.equal(req.status,422);
 },{businessStatus:async()=>({...stubStatus(),actions:{mail_sent:1}})});
 await serve(async server=>{
  const body=JSON.stringify({question:'Explain organizational structure and RACI'});
  const req=await fetchLocal(server,'/api/operator/competence/analyze',{method:'POST',
   body,origin:'http://127.0.0.1:8802',click:true});
  assert.equal(req.status,422);
 },{businessPlan:()=>({version:'fial5.6-business-competence-v1',external_action_authorized:true})});
});


test('finance and writing checks require separate exact operator clicks and never send or act',async()=>{
 await serve(async server=>{
  const finance=JSON.stringify({metrics:{unit_price:100,unit_variable_cost:50,monthly_fixed_cost:1000}});
  const writing=JSON.stringify({draft:'hello team, we we guarantee guaranteed funding'});
  assert.equal((await fetchLocal(server,'/api/operator/competence/finance',{
   method:'POST',body:finance})).status,403);
  assert.equal((await fetchLocal(server,'/api/operator/competence/writing',{
   method:'POST',body:writing,origin:'http://evil.invalid',click:true})).status,403);
  const f=await fetchLocal(server,'/api/operator/competence/finance',{method:'POST',body:finance,
   origin:'http://127.0.0.1:8802',click:false,headers:{'x-fi-business-click':'one-local-financial-calculation'}});
  assert.equal(f.status,403);
  const r=await fetchLocal(server,'/api/operator/competence/finance',{method:'POST',body:finance,
   origin:'http://127.0.0.1:8802',click:'one-local-financial-calculation'});
  assert.equal(r.status,200);
  const result=JSON.parse(r.text);
  assert.equal(result.calculations.unit_economics.monthly_break_even_units,20);
  assert.equal(result.claim_verified,false);
  assert.equal(result.model_invocations,0);
  const w=await fetchLocal(server,'/api/operator/competence/writing',{method:'POST',body:writing,
   origin:'http://127.0.0.1:8802',click:'one-local-writing-review'});
  assert.equal(w.status,200);
  const result2=JSON.parse(w.text);
  assert.equal(result2.messages_sent,0);
  assert.ok(result2.review.issues.some(x=>x.code==='DUPLICATE_WORD'));
  assert.ok(result2.review.issues.some(x=>x.code==='UNVERIFIED_BUSINESS_CLAIM'));
  const malformed=await fetchLocal(server,'/api/operator/competence/finance',{
   method:'POST',body:JSON.stringify({metrics:{unit_price:'invented'}}),
   origin:'http://127.0.0.1:8802',click:'one-local-financial-calculation'});
  assert.equal(malformed.status,422);
 });
});
