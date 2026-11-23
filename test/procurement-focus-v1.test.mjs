import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {PROCUREMENT_FOCUS_HTML,PROCUREMENT_FOCUS_VERSION} from '../src/ui/procurement-focus-v1.mjs';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';

const validProcurement={
 version:'fial5.10-published-procurement-v1',state:'NOT_ACTIVATED',as_of_utc:null,
 counts:{verified_current_published_notices:0,verified_fit_for_elektron:0},
 boundaries:{actual_rfps_submitted:0,emails_sent:0,rea_calls:0,model_calls:0,
 revenue_usd:0,orders:0,awarded_contracts:0},
 notice:null,verified_current_published_notices:[],sources:[],review_notes:[]
};
async function withHub(callback){
 const server=createUnifiedMlHub({ml:{},commerce:{},procurementStatus:async()=>validProcurement,
  grounded:{status:()=>({})},reviewedDispatch:{},reviewedCompute:{}});
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 async function request(path,method='GET'){
  return new Promise((resolve,reject)=>{
   const req=http.request({hostname:'127.0.0.1',port,method,path,
    headers:{host:'127.0.0.1:8802'}},res=>{
      let body='';res.setEncoding('utf8');
      res.on('data',s=>body+=s);
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
   });
   req.on('error',reject);req.end();
  });
 }
 try{return await callback(request)}
 finally{await new Promise(resolve=>server.close(resolve))}
}
test('Procurement isolated UI contains actual FIAL5.10 client target and not executive dashboard',()=>{
 assert.match(PROCUREMENT_FOCUS_HTML,/<section class="panel" id="fi-procurement"/);
 assert.match(PROCUREMENT_FOCUS_HTML,/id="fi-procurement-status"/);
 assert.match(PROCUREMENT_FOCUS_HTML,/id="fi-procurement-notices"/);
 assert.match(PROCUREMENT_FOCUS_HTML,/id="fi-procurement-sources"/);
 assert.match(PROCUREMENT_FOCUS_HTML,/src="\/api\/operator\/procurement\/client.js"/);
 assert.doesNotMatch(PROCUREMENT_FOCUS_HTML,/fi-exec-queue|fi-competence-question|fi-buyer-summary/);
 assert.match(PROCUREMENT_FOCUS_HTML,/not an exhaustive live statewide bid search/);
});
test('Dedicated procurement route shows only focused module, with existing source-linked read-only API',()=>withHub(async request=>{
 const page=await request('/procurement/');
 const client=await request('/api/operator/procurement/client.js');
 const status=await request('/api/operator/procurement/status');
 const invalidPost=await request('/procurement/','POST');
 assert.equal(page.status,200);
 assert.equal(page.headers['x-fi-procurement-view'],PROCUREMENT_FOCUS_VERSION);
 assert.match(page.headers['content-security-policy'],/script-src 'self'/);
 assert.ok(!page.body.includes('fi-exec-queue'));
 assert.equal(client.status,200);
 assert.match(client.body,/\/api\/operator\/procurement\/status/);
 assert.equal(status.status,200);
 assert.equal(JSON.parse(status.body).state,'NOT_ACTIVATED');
 assert.equal(invalidPost.status,404);
}));
test('Both dashboard interfaces link procurement to the dedicated page',async()=>{
 const organized=await readFile(new URL('../src/ui/organized-preview-v1.js',import.meta.url),'utf8');
 const original=await readFile(new URL('../src/ui/oneport-dashboard-v1.js',import.meta.url),'utf8');
 assert.match(organized,/Open procurement evidence',href:'\/procurement\/'/);
 assert.match(original,/procurement:\{name:'Procurement',type:'procurement'/);
 assert.match(original,/safeFrame\('procurement','\/procurement\/'/);
 assert.doesNotMatch(organized,/href:'\/operations\/#fi-purchase-demand'/);
});
