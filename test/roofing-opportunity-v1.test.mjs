import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import http from 'node:http';
import {createUnifiedMlHub} from '../scripts/Run-Fun-ML-Dashboard8802.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ROOF_VERSION,SOURCE_DIRECTORY,importRoofData,roofingSnapshot,roofingLeads,refreshLaCity,refreshNws} from '../src/roofing/roofing-intelligence-v1.mjs';
import {ROOF_UI_HTML} from '../src/ui/roofing-opportunity-v1.mjs';
import {PREVIEW_HTML} from '../src/ui/organized-preview-v1.mjs';

async function sandbox(fn){
 const root=await mkdtemp(join(tmpdir(),'fun-roofing-test-'));
 try{return await fn(root)}finally{await rm(root,{recursive:true,force:true})}
}
const fixture=[
 {county:'Los Angeles',city:'Los Angeles',address:'120 MAIN ST',year_built:1988,zip:'90001'},
 {county:'San Bernardino',city:'Victorville',address:'450 SAMPLE WAY',year_built:1981,zip:'92392'},
 {county:'Los Angeles',city:'Palmdale',address:'170 TEST LANE',year_built:2002,zip:'93550'},
 {county:'San Bernardino',city:'Ontario',address:'100 SCHOOL RD',year_built:2015,zip:'91761'},
];
test('both counties, no permit found is retained, unknown roof age is explicit',()=>sandbox(async root=>{
 const result=await importRoofData({kind:'properties',sourceId:'test_properties',rows:fixture},{root});
 assert.equal(result.accepted,4);
 const list=await roofingLeads({root,filters:{minAge:20}});
 assert.equal(list.total,3);
 assert.ok(list.rows.every(r=>r.category==='NO_PERMIT_FOUND_IN_INGESTED_RECORDS'));
 assert.ok(list.rows.every(r=>r.roofConditionKnown===false&&r.roofAgeKnown===false));
 assert.equal(list.rows.filter(r=>r.county==='San Bernardino').length,1);
 assert.equal(list.rows.filter(r=>r.county==='Los Angeles').length,2);
 const state=await roofingSnapshot({root});
 assert.equal(state.elektronTouched,false);assert.equal(state.toolExecutions,0);
 assert.equal(state.byCounty['Los Angeles'],2);
}));
test('roof permit matching updates only the correct address and selected county',()=>sandbox(async root=>{
 await importRoofData({kind:'properties',sourceId:'test_properties',rows:fixture},{root});
 const result=await importRoofData({kind:'roof_permits',sourceId:'test_permits',rows:[
  {county:'San Bernardino',city:'Victorville',address:'450 SAMPLE WAY',issue_date:'2003-11-02',work_description:'REROOF'},
  {county:'Los Angeles',city:'Los Angeles',address:'120 MAIN ST',issue_date:'2023-04-02',work_description:'REROOF'},
 ]},{root});
 assert.equal(result.accepted,2);
 const all=await roofingLeads({root,filters:{minAge:20}});
 const map=Object.fromEntries(all.rows.map(r=>[r.address,r]));
 assert.equal(map['450 SAMPLE WAY'].category,'LAST_RECORDED_ROOF_PERMIT_20_PLUS');
 assert.equal(map['120 MAIN ST'].category,'RECENT_ROOF_PERMIT_FOUND');
 assert.equal(map['170 TEST LANE'].category,'NO_PERMIT_FOUND_IN_INGESTED_RECORDS');
 const filter=await roofingLeads({root,filters:{countyFilter:'San Bernardino',minAge:20}});
 assert.equal(filter.total,1);
 assert.equal(filter.rows[0].address,'450 SAMPLE WAY');
}));
test('LA neighborhood alias matches official LA City roof permit by ZIP and address',()=>sandbox(async root=>{
 await importRoofData({kind:'properties',sourceId:'test_properties',rows:[
  {county:'Los Angeles',city:'Hollywood',address:'123 N EXAMPLE ST',zip:'90028',year_built:1970}
 ]},{root});
 await importRoofData({kind:'roof_permits',sourceId:'la_test',rows:[
  {county:'Los Angeles',city:'Los Angeles',address:'123 N EXAMPLE ST',zip:'90028',
   issue_date:'2025-04-01',work_description:'REROOF'}
 ]},{root});
 const all=await roofingLeads({root,filters:{minAge:20}});
 assert.equal(all.rows[0].category,'RECENT_ROOF_PERMIT_FOUND');
}));
test('bad data, owner contacts and invalid imports do not get copied into state',()=>sandbox(async root=>{
 await assert.rejects(importRoofData({kind:'properties',sourceId:'test_properties',rows:[
  {county:'Los Angeles',city:'Los Angeles',address:'1 A ST',year_built:'unknown'}]},{root}));
 await importRoofData({kind:'properties',sourceId:'test_properties',rows:[{
  county:'Los Angeles',city:'Los Angeles',address:'120 MAIN ST',year_built:1988,owner_name:'IGNORE',phone:'5551234567',
 }]},{root});
 const raw=await readFile(join(root,'state.json'),'utf8');
 assert.ok(!raw.includes('IGNORE'));assert.ok(!raw.includes('5551234567'));
 await assert.rejects(importRoofData({kind:'roof_permits',sourceId:'test_permits',rows:[
  {county:'Los Angeles',city:'Los Angeles',address:'120 MAIN ST',issue_date:'2020-01-01',work_description:'REMODEL'}]},{root}));
}));
test('official LA city source uses fixed dataset IDs and bounded roof-only query',()=>sandbox(async root=>{
 const urls=[];
 const fetchImpl=async(url,opts)=>{
  urls.push(url);
  assert.equal(opts.method,'GET');
  assert.equal(opts.redirect,'error');
  const u=new URL(url);
  assert.equal(u.hostname,'data.lacity.org');
  assert.equal(u.searchParams.get('$limit'),'1000');
  assert.match(u.searchParams.get('$where'),/ROOF/);
  return {ok:true,text:async()=>JSON.stringify([{
   permit_nbr:'26016-12345',primary_address:'120 MAIN ST',
   issue_date:'2026-11-03T00:00:00.000',work_desc:'REROOF EXTERIOR'
  }])};
 };
 const result=await refreshLaCity({root,fetchImpl});
 assert.equal(result.samples.length,2);
 assert.equal(result.completeCountyCoverage,false);
 const state=await roofingSnapshot({root});
 assert.equal(state.roofPermitRecords,1);
 assert.equal(urls.length,2);
 assert.ok(SOURCE_DIRECTORY.some(s=>s.id==='la_county_epicla'&&s.status==='PORTAL_NOT_CONNECTED'));
}));
test('NWS request is fixed to official API, and forecasts are not roof-damage claims',()=>sandbox(async root=>{
 const called=[];
 const fetchImpl=async(url)=>{
  called.push(url);
  const u=new URL(url);
  assert.equal(u.hostname,'api.weather.gov');
  return {ok:true,text:async()=>JSON.stringify(u.pathname.startsWith('/points/')?
   {properties:{forecast:'https://api.weather.gov/gridpoints/LOX/100,99/forecast'}}:
   {properties:{updateTime:'2026-11-23T09:00:00Z',periods:[
    {name:'Tuesday',startTime:'2026-11-24T07:00:00-08:00',
     shortForecast:'Chance Rain',probabilityOfPrecipitation:{value:35}}
   ]}})};
 };
 const res=await refreshNws({root,fetchImpl});
 assert.equal(res.forecastAreas,5);
 assert.equal(res.notRoofDamageEvidence,true);
 assert.equal(called.length,10);
 const state=await roofingSnapshot({root});
 assert.equal(state.forecastAreas.length,5);
 assert.equal(state.forecastAreas[0].periods[0].precipitationProbability,35);
}));
test('UI integrated into organized dashboard without changing original homepage',()=>{
 assert.match(ROOF_UI_HTML,/id="roof-property-file"/);
 assert.match(ROOF_UI_HTML,/id="roof-weather-refresh"/);
 assert.match(ROOF_UI_HTML,/No-permit properties included/);
 assert.match(ROOF_UI_HTML,/No automatic outreach/);
 assert.match(PREVIEW_HTML,/href="\/roofing\/"/);
});

test('same-origin roofing routes work; mutation endpoints reject unapproved requests',async()=>{
 const server=createUnifiedMlHub({ml:{},commerce:{},
   grounded:{status:()=>({})},reviewedDispatch:{},reviewedCompute:{}});
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 async function request(path,method='GET',body='',headers={}){
  return await new Promise((resolve,reject)=>{
   const req=http.request({hostname:'127.0.0.1',port,method,path,
    headers:{host:'127.0.0.1:8802',...headers}},res=>{
     let value='';res.setEncoding('utf8');res.on('data',part=>value+=part);
     res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:value}));
    });
   req.on('error',reject);req.end(body);
  });
 }
 try{
  const home=await request('/');
  const panel=await request('/roofing/');
  const css=await request('/api/fun/roofing/style.css');
  const js=await request('/api/fun/roofing/client.js');
  const denied=await request('/api/fun/roofing/refresh-la','POST','{}',{'content-type':'application/json'});
  const denied2=await request('/api/fun/roofing/import','POST','{}',{'content-type':'application/json'});
  assert.equal(home.status,200);
  assert.equal(panel.status,200);
  assert.equal(panel.headers['x-fi-roofing-version'],ROOF_VERSION);
  assert.ok(panel.body.includes('roof-property-file'));
  assert.equal(css.status,200);assert.ok(css.body.includes('market-scroll'));
  assert.equal(js.status,200);assert.ok(js.body.includes('roof-markets'));
  assert.equal(denied.status,403);
  assert.equal(denied2.status,403);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
