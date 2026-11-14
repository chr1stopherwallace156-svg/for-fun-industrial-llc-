import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {EXEC_PAGE} from '../src/operator/executive-console-v1.mjs';
import {VERSION} from '../src/regulatory/intelligence-engine-v5-8.mjs';
const base='<html><body><div id="action-review">Preserved Qwen and REA</div></body></html>';
const ml={status:async()=>({state:'ready'}),run:async()=>{throw Error('NO_ML_RUN')}};
const commerce={status:async()=>({version:'commerce'}),data:async()=>({trends:null,shopify:null})};
const sample=()=>({version:VERSION,state:'REAL_PUBLIC_DATA_CHECK_COMPLETED',
 as_of_utc:'2026-11-14T23:00:00Z',counts:{monitored:8,refreshed:8,source_changes:0,source_holds:0,economic_series:2},
 rule_watch:[],timeline:[{id:'ctc-obd-quarterly',year:2027,date:'2027-10-01',name:'CTC',type:'program_frequency_change',is_legal_individual_deadline:false}],
 sources:[],economic_series:[{id:'CUUR0000SA0',label:'CPI',unit:'index',observations:[{month:'2026-09',value:320},{month:'2026-10',value:323}]}],
 boundaries:{emails_sent:0,automatic_filing:0,model_calls:0,verified_individual_due_dates:0}});
async function withServer(status,fn){
 const server=createUnifiedMlHub({ml,commerce,regulatoryStatus:status,
  readPage:async()=>base,readWidget:async()=>'(function(){})();'+' '.repeat(100),
  proxy:async(req,res)=>{res.writeHead(200);res.end('{}')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn(server)}finally{await new Promise(resolve=>server.close(resolve))}
}
function call(server,path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,
   path,method,headers:{host:'127.0.0.1:8802'}},res=>{
    const b=[];res.on('data',chunk=>b.push(chunk));
    res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(b).toString('utf8')}));
   });req.on('error',reject);req.end()
 })
}
test('new source-linked regulatory economic panel shares existing operations page',()=>{
 assert.match(EXEC_PAGE,/fi-regulatory-intelligence/);
 assert.match(EXEC_PAGE,/fi-regulatory-trends/);
 assert.match(EXEC_PAGE,/fi-regulatory-timeline/);
 assert.match(EXEC_PAGE,/Qwen Chat/);
 assert.match(EXEC_PAGE,/fi-outcome-status/);
 assert.match(EXEC_PAGE,/fi-competence/);
});
test('native SVG charts have no external script or unsafe HTML injection',async()=>{
 const code=await readFile(new URL('../src/regulatory/regulatory-console-v5-8.js',import.meta.url),'utf8');
 assert.match(code,/createElementNS/);
 assert.match(code,/textContent/);
 assert.doesNotMatch(code,/innerHTML|eval\(|setInterval\(|WebSocket|method:\s*['"]POST['"]|https:\/\/.*\.js/);
});
test('GET regulatory status displays observed BLS data; no implicit fetch or model calls',async()=>{
 let count=0;
 await withServer(async()=>{count++;return sample()},async server=>{
  const page=await call(server,'/operations/');
  assert.equal(page.status,200);assert.match(page.body,/fi-regulatory-trends/);
  const client=await call(server,'/api/operator/regulatory/client.js');
  assert.equal(client.status,200);assert.match(client.body,/createElementNS/);
  const result=await call(server,'/api/operator/regulatory/status');
  assert.equal(result.status,200);
  const json=JSON.parse(result.body);
  assert.equal(json.version,VERSION);
  assert.equal(json.economic_series[0].observations[0].value,320);
  assert.equal(count,1);
  assert.equal((await call(server,'/api/operator/regulatory/status','POST')).status,404);
  assert.equal((await call(server,'/api/operator/regulatory/run','POST')).status,404);
 });
});
test('forged report with external actions or fabricated verified dates fails closed',async()=>{
 await withServer(async()=>({...sample(),boundaries:{...sample().boundaries,emails_sent:1}}),async server=>{
  const r=await call(server,'/api/operator/regulatory/status');
  assert.equal(r.status,422);assert.match(r.body,/FIAL58_STATUS_AUTHORITY_OR_SCHEMA_INVALID/);
 });
 await withServer(async()=>({...sample(),boundaries:{...sample().boundaries,verified_individual_due_dates:1}}),async server=>{
  assert.equal((await call(server,'/api/operator/regulatory/status')).status,422);
 });
});
