import test from 'node:test';
import assert from 'node:assert/strict';
import {createAilDashboardServer} from '../src/integrations/ail-dashboard.mjs';
async function withServer(fn){const server=createAilDashboardServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});try{await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}}
test('separate dashboard renders all five organized sections',async()=>withServer(async url=>{const r=await fetch(url);const h=await r.text();assert.equal(r.status,200);for(const s of ['Overview','Sources','Intelligence','Approvals','Resources'])assert.ok(h.includes(s));assert.ok(h.includes('AIL not connected'));}));
test('status exposes no credentials or raw intelligence',async()=>withServer(async url=>{const r=await fetch(url+'/api/status');const j=await r.json();assert.equal(j.ailConnected,false);assert.ok(j.totalMiB>0);assert.equal('token' in j,false);}));
test('dashboard refuses POST and unknown paths',async()=>withServer(async url=>{assert.equal((await fetch(url+'/api/status',{method:'POST'})).status,405);assert.equal((await fetch(url+'/missing')).status,404);}));
test('dashboard uses no-store and CSP restrictions',async()=>withServer(async url=>{const r=await fetch(url);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);}));
