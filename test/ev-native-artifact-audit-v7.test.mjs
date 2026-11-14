import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const v2=resolve('src/ev-conversion/prototype-v2.mjs');
const audit=resolve('src/ev-conversion/native-artifact-audit-v7.mjs');
function sha(s){return createHash('sha256').update(s).digest('hex');}
function fixture(fn){
 const local=mkdtempSync(join(tmpdir(),'fun-v7-local-'));
 const id='fixture-bench';
 const env={...process.env,LOCALAPPDATA:local};
 const run=(file,...args)=>spawnSync(process.execPath,[file,...args],{
   env,cwd:resolve('.'),timeout:8000,encoding:'utf8',maxBuffer:1024*1024
 });
 try{
  const prepared=run(v2,'demo',id);assert.equal(prepared.status,0,prepared.stderr);
  const base=join(local,'FunIndustrial','EVEngineering','Prototypes',id);
  const dest=join(base,'native-wireviz-v3');mkdirSync(dest);
  const svg=[
   '<?xml version="1.0" encoding="UTF-8"?>',
   '<svg width="480" height="240" xmlns="http://www.w3.org/2000/svg">',
   '<title>X1</title><title>X2</title><title>W1</title>',
   '<rect width="480" height="240" fill="#ffffff"/>',
   '<text x="10" y="20">X1</text><text x="200" y="20">X2</text>',
   '<text x="140" y="20">W1</text>',
   '<text x="10" y="50">RETURN</text><text x="200" y="50">RETURN</text>',
   '<text x="10" y="75">SENSE</text><text x="200" y="75">SENSE</text>',
   '</svg>'
  ].join('\n');
  const bom='Id\tDescription\tQty\tUnit\tDesignators\n1\tCable, 2 conductor\t0.5\tm\tW1\n2\tBench connector\t2\t\tX1, X2\n';
  const write=(name,contents)=>writeFileSync(join(dest,name),contents);
  write('bench-harness.svg',svg);write('bench-harness.bom.tsv',bom);
  const v2manifest=readFileSync(join(base,'output','manifest.json'));
  const manifest={
    schema:'fun.ev.native-render.v3',project_id:id,source_scope:'UNPOWERED_NON_VEHICLE_BENCH_ONLY',
    state:'NATIVE_RENDERED_ENGINEERING_HOLD',production_released:false,
    high_voltage_work_authorized:false,engineering_approved:false,
    native_wireviz_executable_sha256:'a'.repeat(64),graphviz_dot_sha256:'b'.repeat(64),
    v2_manifest_sha256:sha(v2manifest),
    files:[{name:'bench-harness.svg',sha256:sha(svg),size_bytes:Buffer.byteLength(svg)},
      {name:'bench-harness.bom.tsv',sha256:sha(bom),size_bytes:Buffer.byteLength(bom)}]
  };
  const rewriteManifest=()=>write('native-manifest.json',JSON.stringify(manifest));
  rewriteManifest();
  fn({local,id,base,dest,manifest,write,rewriteManifest,run,svg,bom});
 }finally{rmSync(local,{recursive:true,force:true})}
}
test('audit verifies V2 lineage, synthetic wire pins, BOM designators and SVG labels without writes',()=>{
 fixture(x=>{
  const r=x.run(audit,'audit',x.id);assert.equal(r.status,0,r.stderr);
  const result=JSON.parse(r.stdout);
  assert.equal(result.state,'ARTIFACT_INTEGRITY_AND_STRUCTURAL_LABELS_PASS_ENGINEERING_HOLD');
  assert.equal(result.pinout_rows_checked,2);
  assert.equal(result.bom_designators_checked,3);
  assert.equal(result.input_and_lineage_sha256_verified,true);
  assert.equal(result.electrical_continuity_measured,false);
  assert.equal(result.engineering_approved,false);
  assert.equal(result.files_written,0);
  assert.equal(result.external_tools_executed,0);
 });
});
test('altering SVG bytes while preserving original native manifest fails SHA',()=>{
 fixture(x=>{
  x.write('bench-harness.svg',x.svg+'corrupt');
  const r=x.run(audit,'audit',x.id);assert.notEqual(r.status,0);
  assert.match(r.stderr,/FILE_DIGEST_HOLD/);
 });
});
test('rehashed SVG with missing pin label is still rejected semantically',()=>{
 fixture(x=>{
  const svg=x.svg.replaceAll('SENSE','BADLABEL');
  x.write('bench-harness.svg',svg);
  x.manifest.files[0].sha256=sha(svg);x.manifest.files[0].size_bytes=Buffer.byteLength(svg);
  x.rewriteManifest();
  const r=x.run(audit,'audit',x.id);assert.notEqual(r.status,0);
  assert.match(r.stderr,/SVG_LABEL_ABSENT_HOLD/);
 });
});
test('rehashed BOM with incorrect cable length is rejected semantically',()=>{
 fixture(x=>{
  const bom=x.bom.replace('\t0.5\tm\tW1','\t0.7\tm\tW1');
  x.write('bench-harness.bom.tsv',bom);
  x.manifest.files[1].sha256=sha(bom);x.manifest.files[1].size_bytes=Buffer.byteLength(bom);
  x.rewriteManifest();
  const r=x.run(audit,'audit',x.id);assert.notEqual(r.status,0);
  assert.match(r.stderr,/BOM_CABLE_QUANTITY_HOLD/);
 });
});
test('duplicate BOM designators and active SVG content cause a HOLD',()=>{
 fixture(x=>{
  const bom=x.bom.replace('X1, X2','X1, X1');
  x.write('bench-harness.bom.tsv',bom);
  x.manifest.files[1].sha256=sha(bom);x.manifest.files[1].size_bytes=Buffer.byteLength(bom);
  x.rewriteManifest();
  let r=x.run(audit,'audit',x.id);assert.notEqual(r.status,0);
  assert.match(r.stderr,/BOM_DESIGNATOR_HOLD/);
 });
 fixture(x=>{
  const svg=x.svg.replace('</svg>','<script>alert(1)</script></svg>');
  x.write('bench-harness.svg',svg);
  x.manifest.files[0].sha256=sha(svg);x.manifest.files[0].size_bytes=Buffer.byteLength(svg);
  x.rewriteManifest();
  let r=x.run(audit,'audit',x.id);assert.notEqual(r.status,0);
  assert.match(r.stderr,/SVG_ACTIVE_CONTENT_HOLD/);
 });
});
test('V2 pinout or project contents cannot be changed by updating only native manifest',()=>{
 fixture(x=>{
  const p=join(x.base,'output','bench-pinout.csv');
  writeFileSync(p,readFileSync(p,'utf8').replace('BK','RD'));
  const r=x.run(audit,'audit',x.id);assert.notEqual(r.status,0);
  assert.match(r.stderr,/FILE_DIGEST_HOLD/);
 });
});
test('path traversal and missing project fail closed without generating files',()=>{
 fixture(x=>{
  let r=x.run(audit,'audit','../path');assert.notEqual(r.status,0);
  assert.match(r.stderr,/USAGE_HOLD/);
  r=x.run(audit,'audit','missing');assert.notEqual(r.status,0);
  assert.match(r.stderr,/MISSING_DIRECTORY_HOLD/);
 });
});
