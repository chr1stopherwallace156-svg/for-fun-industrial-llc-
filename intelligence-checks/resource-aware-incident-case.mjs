import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeIncidentStream,analyzeSyntheticIncidents,validateIncidentPolicy} from '../src/resource-aware/incident-stream.mjs';
const record=(domain='alpha.example',category='breach_report')=>JSON.stringify({domain,category,published:'2026-10-01',source:'public-report',title:'A synthetic report'})+'\n';
async function* parts(...xs){for(const x of xs)yield Buffer.from(x);}
const fast={pauseMs:0,sampleEveryChunks:1,maxProcessRssMiB:1024};
test('parses partial byte chunks and counts only allowlisted domains',async()=>{
 const a=record(),b=record('beta.example');
 const r=await analyzeIncidentStream(parts(a.slice(0,9),a.slice(9)+b),fast);
 assert.equal(r.state,'PASS');assert.equal(r.records,2);assert.equal(r.matched,1);assert.equal(r.counts['alpha.example'],1);
});
test('supports allowlisted multi-domain counts with a fixed type set',async()=>{
 const r=await analyzeIncidentStream(parts(record('beta.example','exposure_notice'),record('alpha.example')),{...fast,allowDomains:['alpha.example','beta.example']});
 assert.equal(r.state,'PASS');assert.equal(r.matched,2);assert.equal(r.types.exposure_notice,1);
});
test('an invalid JSON record causes HOLD rather than fabricated success',async()=>{
 const r=await analyzeIncidentStream(parts('{bad}\n'),fast);assert.equal(r.reason,'INVALID_JSON_OR_UTF8');assert.equal(r.sha256,null);
});
test('rejects unauthorized structural fields',async()=>{
 const row=JSON.stringify({...JSON.parse(record()),password:'secret'})+'\n';
 const r=await analyzeIncidentStream(parts(row),fast);assert.equal(r.reason,'RECORD_SCHEMA_INVALID');
});
test('rejects an overlong line before accumulating it',async()=>{
 const r=await analyzeIncidentStream(parts('X'.repeat(200)),{...fast,maxLineBytes:64});assert.equal(r.reason,'LINE_BUDGET_EXCEEDED');
});
test('rejects invalid UTF-8 bytes',async()=>{
 const r=await analyzeIncidentStream((async function*(){yield Buffer.from([0xff,10]);})(),fast);assert.equal(r.reason,'INVALID_JSON_OR_UTF8');
});
test('rejects records beyond configured count',async()=>{
 const r=await analyzeIncidentStream(parts(record()+record()),{...fast,maxRecords:1});assert.equal(r.reason,'RECORD_BUDGET_EXCEEDED');
});
test('rejects input budget overrun',async()=>{
 const one=Buffer.from(record());async function* source(){for(let i=0;i<20000;i++)yield one;}
 const r=await analyzeIncidentStream(source(),{...fast,maxInputMiB:1});assert.equal(r.reason,'INPUT_BUDGET_EXCEEDED');
});
test('rejects unsupported or unbounded options',async()=>{
 assert.throws(()=>validateIncidentPolicy({allowDomains:[]}));assert.throws(()=>validateIncidentPolicy({fetchFromNetwork:true}));
 assert.throws(()=>validateIncidentPolicy({chunkKiB:9999}));
});
test('streaming synthetic dataset reports bounded totals without returning content',async()=>{
 const r=await analyzeSyntheticIncidents({totalMiB:1,maxProcessRssMiB:1024,pauseMs:0});
 assert.equal(r.state,'PASS');assert.ok(r.records>4000);assert.equal(r.matched*2,r.records);assert.equal(r.counts['alpha.example'],r.matched);
 assert.equal('title' in r,false);assert.equal(typeof r.sha256,'string');
});
test('host reserve pressure causes HOLD',async()=>{
 const r=await analyzeIncidentStream(parts(record()),{...fast,minimumHostFreeMiB:1048576});assert.equal(r.reason,'HOST_MEMORY_RESERVE');
});
