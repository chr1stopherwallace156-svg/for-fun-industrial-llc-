import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {init,register,importSource,attachArtifact,graph,inspect} from '../src/vehicle-library/v9.mjs';
const setup=()=>fs.mkdtempSync(path.join(os.tmpdir(),'fun-v9-'));
test('creates isolated vehicle library for all three Ford models',()=>{
 const root=setup();try{init({root});for(const v of ['F-450','F-550','E-450'])assert.ok(fs.existsSync(path.join(root,'Ford',v,'2026','CAD')));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('rejects traversal and duplicate configuration IDs',()=>{
 const root=setup();try{assert.throws(()=>register({root,vehicle:'F-450',id:'../escape'}),/INVALID/);register({root,vehicle:'F-450',id:'config-001'});assert.throws(()=>register({root,vehicle:'F-450',id:'config-001'}),/ALREADY_EXISTS/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('preserves source bytes and links CAD to source in graph without approval',()=>{
 const root=setup();try{
  register({root,vehicle:'F-450',id:'config-001'});
  const pdf=path.join(root,'input.pdf'),cad=path.join(root,'demo.step');
  fs.writeFileSync(pdf,'%PDF-1.4\nsynthetic test');fs.writeFileSync(cad,'ISO-10303-21;\nsynthetic test');
  const s=importSource({root,vehicle:'F-450',id:'config-001',file:pdf});
  const a=attachArtifact({root,vehicle:'F-450',id:'config-001',file:cad,kind:'CAD',sourceIds:[s.id]});
  const g=graph({root,vehicle:'F-450'});
  assert.ok(g.edges.some(e=>e.type==='DERIVED_FROM'&&e.to==='source:'+s.id));
  assert.equal(inspect({root,vehicle:'F-450'}).configurations[0].engineeringApproved,false);
  assert.equal(a.engineeringApproved,false);
  assert.equal(fs.readFileSync(path.join(root,'Ford','F-450','2026','Sources',s.storedName),'utf8'),fs.readFileSync(pdf,'utf8'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('rejects unknown source links and unsupported artifact categories',()=>{
 const root=setup();try{register({root,vehicle:'E-450',id:'c1'});const file=path.join(root,'part.step');fs.writeFileSync(file,'test');assert.throws(()=>attachArtifact({root,vehicle:'E-450',id:'c1',file,kind:'CAD',sourceIds:['unknown']}),/UNKNOWN_SOURCE/);assert.throws(()=>attachArtifact({root,vehicle:'E-450',id:'c1',file,kind:'Sources'}),/INVALID_ARTIFACT_KIND/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
