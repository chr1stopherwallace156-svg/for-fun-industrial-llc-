import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {ROOF_BULK_PAGE} from '../src/ui/roofing-bulk-page-v2.mjs';
import {BULK_VERSION,bulkCatalog,startBulkSync,bulkMarkets} from '../src/roofing/roofing-bulk-bridge-v2.mjs';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {DASHBOARD_HTML} from '../src/ui/oneport-dashboard-v1.mjs';
const css=new URL('../src/ui/roofing-bulk-page-v2.css',import.meta.url);
const client=new URL('../src/ui/roofing-bulk-page-v2.js',import.meta.url);

test('bulk system recognizes real full official exports without keys',()=>{
 const c=bulkCatalog();
 assert.equal(c.version,BULK_VERSION);
 assert.equal(c.sources.filter(s=>s.mode==='FULL_EXPORT_SYNC').length,4);
 assert.ok(c.sources.some(s=>s.id==='sb_assessor_characteristics'&&
   s.mode==='MANUAL_CSV_OR_FIXED_WIDTH_HOLD'));
 assert.equal(c.configuredSocrataToken,Boolean(process.env.SOCRATA_APP_TOKEN));
 assert.equal(c.modelExecutions,0);
 assert.equal(c.automatedOutreach,0);
 assert.equal(c.elektronTouched,false);
 assert.throws(()=>startBulkSync('arbitrary-url'),/NOT_AUTOMATABLE/);
});
test('bulk UI links only real local endpoints and has no automated actions',async()=>{
 const js=await readFile(client,'utf8'),style=await readFile(css,'utf8');
 assert.match(ROOF_BULK_PAGE,/Roofing Opportunity Intelligence/);
 assert.match(ROOF_BULK_PAGE,/id="market-body"/);
 assert.match(ROOF_BULK_PAGE,/id="source-list"/);
 assert.match(ROOF_BULK_PAGE,/No permit sample caps/);
 assert.match(js,/operator-sync-full-export/);
 assert.match(js,/confirm\(/);
 assert.match(js,/noPermit/);
 assert.doesNotMatch(js,/setInterval|localStorage|WebSocket|new WebSocket|eval\(/);
 assert.doesNotMatch(ROOF_BULK_PAGE,/<script(?![^>]*src)[^>]*>/i);
 assert.match(style,/@media\(max-width:750px\)/);
});
test('bulk UI is on separate route; original production homepage is preserved',async()=>{
 const server=createUnifiedMlHub({ml:{},commerce:{},
   grounded:{status:()=>({})},reviewedDispatch:{},reviewedCompute:{}});
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 function req(path,method='GET',body='',headers={}){
  return new Promise((resolve,reject)=>{
   const request=http.request({host:'127.0.0.1',port,path,method,
    headers:{host:'127.0.0.1:8802',...headers}},res=>{
    let content='';res.setEncoding('utf8');res.on('data',c=>content+=c);
    res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:content}));
   });
   request.on('error',reject);
   request.end(body);
  });
 }
 try{
  const home=await req('/');
  assert.equal(home.status,200);
  assert.equal(home.body,DASHBOARD_HTML);
  const ui=await req('/roofing/bulk/');
  assert.equal(ui.status,200);
  assert.equal(ui.headers['x-fi-roofing-version'],BULK_VERSION);
  const css=await req('/api/fun/roofing/bulk/style.css');
  assert.equal(css.status,200);
  const js=await req('/api/fun/roofing/bulk/client.js');
  assert.equal(js.status,200);
  const status=await req('/api/fun/roofing/bulk/status');
  assert.equal(status.status,200);
  assert.equal(JSON.parse(status.body).automatedOutreach,0);
  const unapproved=await req('/api/fun/roofing/bulk/sync','POST',
    '{"source":"la_permits_pre2010"}',{'content-type':'application/json'});
  assert.equal(unapproved.status,403);
  const unsupported=await req('/api/fun/roofing/bulk/sync','POST',
    '{"source":"sb_assessor_characteristics"}',{'content-type':'application/json',
    'origin':'http://127.0.0.1:8802',
    'x-fi-roofing-bulk-click':'operator-sync-full-export'});
  assert.equal(unsupported.status,422);
  const invalid=await req('/api/fun/roofing/bulk/markets?county=Other');
  assert.equal(invalid.status,422);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
