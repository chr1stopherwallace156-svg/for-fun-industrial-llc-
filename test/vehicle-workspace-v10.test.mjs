import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createWorkspaceServer} from '../src/vehicle-library/workspace-v10.mjs';
import {register,attachArtifact} from '../src/vehicle-library/v9.mjs';
test('read-only workspace lists registered configurations and graph',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fun-v10-'));register({root,vehicle:'F-450',id:'F450-001'});
 const server=createWorkspaceServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base='http://127.0.0.1:'+server.address().port;const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Vehicle Workspace/);const data=await (await fetch(base+'/api/v10/configurations?vehicle=F-450')).json();assert.equal(data.configurations[0].id,'F450-001');const graph=await(await fetch(base+'/api/v10/graph?vehicle=F-450')).json();assert.ok(graph.edges.some(e=>e.type==='HAS_CONFIGURATION'));assert.equal((await fetch(base+'/api/v10/configurations?vehicle=../../bad')).status,400);assert.equal((await fetch(base,{method:'POST'})).status,405);}
 finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
test('artifact route serves only registry-linked files',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fun-v10-'));register({root,vehicle:'E-450',id:'E450-001'});const file=path.join(root,'part.step');fs.writeFileSync(file,'synthetic-step');const a=attachArtifact({root,vehicle:'E-450',id:'E450-001',file,kind:'CAD'});
 const server=createWorkspaceServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base='http://127.0.0.1:'+server.address().port;const prefix=base+'/api/v10/artifact?vehicle=E-450&id=E450-001&kind=CAD&hash=';const r=await fetch(prefix+a.sha256);assert.equal(r.status,200);assert.equal(await r.text(),'synthetic-step');assert.equal((await fetch(prefix+'bad')).status,404);}
 finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
