// Fun Industrial EV Prototype V2. No external process, networking, installations or vehicle authority.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,parse,sep} from 'node:path';
import {homedir} from 'node:os';

const ID=/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const LABEL=/^[A-Za-z][A-Za-z0-9_+-]{0,19}$/;
const COLORS=new Set(['BK','RD','GN','YE','BU','WH','GY','BN','OG','VT','PK']);
const REQUIRED=['schema','scope','plate','harness'];
function hold(code){throw Error('FUN_EV_V2_'+code+'_HOLD');}
function sha(data){return createHash('sha256').update(data,'utf8').digest('hex');}
function dirsSafe(path){
 const full=resolve(path),root=parse(full).root;
 let p=root;
 for(const segment of full.slice(root.length).split(sep).filter(Boolean)){
  p=join(p,segment);
  try{const st=lstatSync(p);if(st.isSymbolicLink()||!st.isDirectory())hold('UNSAFE_DIRECTORY');}
  catch(e){if(e.code!=='ENOENT')throw e;}
 }
}
function fileSafe(path){
 try{const st=lstatSync(path);if(st.isSymbolicLink()||!st.isFile()||st.size>32768)hold('UNSAFE_FILE');}
 catch(e){if(e.code==='ENOENT')hold('MISSING_FILE');throw e;}
}
function rootPath(){
 const base=process.env.LOCALAPPDATA||join(homedir(),'AppData','Local');
 return resolve(process.env.FUN_EV_V2_ROOT||join(base,'FunIndustrial','EVEngineering','Prototypes'));
}
function paths(id){
 if(!ID.test(id||''))hold('BAD_ID');
 const root=rootPath();dirsSafe(root);
 return {root,dir:join(root,id)};
}
function only(obj,keys){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))hold('SCHEMA');
 if(Object.keys(obj).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(obj,k)))hold('SCHEMA');
}
function range(n,low,high){
 if(typeof n!=='number'||!Number.isFinite(n)||n<low||n>high)hold('BOUNDS');
}
function validate(spec){
 only(spec,REQUIRED);
 if(spec.schema!=='fun.ev.prototype.v2'||spec.scope!=='UNPOWERED_NON_VEHICLE_BENCH_ONLY')hold('SCOPE');
 only(spec.plate,['width_mm','depth_mm','thickness_mm','holes']);
 const p=spec.plate;
 range(p.width_mm,30,500);range(p.depth_mm,30,500);range(p.thickness_mm,1,20);
 if(!Array.isArray(p.holes)||p.holes.length>12)hold('HOLES');
 for(const h of p.holes){
  only(h,['x_mm','y_mm','diameter_mm']);
  range(h.diameter_mm,2,20);range(h.x_mm,0,p.width_mm);range(h.y_mm,0,p.depth_mm);
  const r=h.diameter_mm/2;
  if(h.x_mm-r<1||h.x_mm+r>p.width_mm-1||h.y_mm-r<1||h.y_mm+r>p.depth_mm-1)hold('EDGE_CLEARANCE');
 }
 for(let i=0;i<p.holes.length;i++)for(let j=i+1;j<p.holes.length;j++){
  const a=p.holes[i],b=p.holes[j],d=Math.hypot(a.x_mm-b.x_mm,a.y_mm-b.y_mm);
  if(d<=(a.diameter_mm+b.diameter_mm)/2+1)hold('HOLE_COLLISION');
 }
 only(spec.harness,['x1_pinlabels','x2_pinlabels','cable']);
 const w=spec.harness;
 if(!Array.isArray(w.x1_pinlabels)||!Array.isArray(w.x2_pinlabels)||
    w.x1_pinlabels.length<2||w.x1_pinlabels.length>8||
    w.x1_pinlabels.length!==w.x2_pinlabels.length)hold('PINS');
 for(const labels of [w.x1_pinlabels,w.x2_pinlabels]){
  if(labels.some(x=>typeof x!=='string'||!LABEL.test(x))||new Set(labels).size!==labels.length)hold('PIN_LABELS');
 }
 only(w.cable,['gauge_mm2','length_m','colors']);
 range(w.cable.gauge_mm2,0.1,2.5);range(w.cable.length_m,0.1,10);
 if(!Array.isArray(w.cable.colors)||w.cable.colors.length!==w.x1_pinlabels.length||
    w.cable.colors.some(x=>!COLORS.has(x)))hold('COLORS');
 return spec;
}
function sample(){
 return {schema:'fun.ev.prototype.v2',scope:'UNPOWERED_NON_VEHICLE_BENCH_ONLY',
  plate:{width_mm:120,depth_mm:80,thickness_mm:4,holes:[
   {x_mm:20,y_mm:20,diameter_mm:6},{x_mm:100,y_mm:60,diameter_mm:6}]},
  harness:{x1_pinlabels:['RETURN','SENSE'],x2_pinlabels:['RETURN','SENSE'],
   cable:{gauge_mm2:0.25,length_m:0.5,colors:['BK','RD']}}};
}
function freecad(spec,id){
 const p=spec.plate;
 const lines=[
  '# Fun Industrial V2 synthetic, non-vehicle bench geometry only.',
  '# Open in FreeCAD GUI via Macro menu. Does not save, export or operate machinery.',
  'import FreeCAD as App',
  'import Part',
  'doc = App.newDocument("FI_BENCH_'+id.replaceAll('-','_')+'")',
  'shape = Part.makeBox('+p.width_mm+', '+p.depth_mm+', '+p.thickness_mm+')'
 ];
 for(const h of p.holes){
  lines.push('shape = shape.cut(Part.makeCylinder('+(h.diameter_mm/2)+', '+p.thickness_mm+', App.Vector('+h.x_mm+', '+h.y_mm+', 0)))');
 }
 lines.push('obj = doc.addObject("Part::Feature", "BenchPlate")',
  'obj.Shape = shape','doc.recompute()',
  'print("Fun Industrial bench geometry created; UNSUITABLE FOR VEHICLE FABRICATION")');
 return lines.join('\n')+'\n';
}
function wireviz(spec,id){
 const w=spec.harness,n=w.x1_pinlabels.length;
 const pin=Array.from({length:n},(_,i)=>i+1).join(', ');
 return [
  '# Fun Industrial V2 - synthetic, unpowered bench example. NOT vehicle wiring.',
  'metadata:','  title: "Fun Industrial Bench Harness '+id+'"',
  'connectors:','  X1:','    type: "Bench test connector"',
  '    pinlabels: ['+w.x1_pinlabels.join(', ')+']',
  '  X2:','    type: "Bench test connector"',
  '    pinlabels: ['+w.x2_pinlabels.join(', ')+']',
  'cables:','  W1:','    category: bundle',
  '    gauge: '+w.cable.gauge_mm2+' mm2',
  '    length: '+w.cable.length_m,
  '    colors: ['+w.cable.colors.join(', ')+']',
  'connections:','  -','    - X1: ['+pin+']','    - W1: ['+pin+']','    - X2: ['+pin+']'
 ].join('\n')+'\n';
}
function pinout(spec){
 const w=spec.harness;
 return 'cable_id,wire_index,from_connector,from_pin,to_connector,to_pin,color,review_status\n'+
 w.cable.colors.map((color,i)=>['W1',i+1,'X1',i+1,'X2',i+1,color,'NOT_ENGINEER_REVIEWED'].join(',')).join('\n')+'\n';
}
function prepare(id){
 const {root,dir}=paths(id);
 try{lstatSync(dir);hold('EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
 mkdirSync(root,{recursive:true});dirsSafe(root);
 mkdirSync(dir,{recursive:false});
 writeFileSync(join(dir,'prototype.json'),JSON.stringify(sample(),null,2)+'\n',{flag:'wx'});
 writeFileSync(join(dir,'README.txt'),
  'Fun Industrial synthetic, unpowered NON-VEHICLE bench inputs only.\n'+
  'Edit prototype.json before export; use sourced real component inputs for any future separately qualified design.\n'+
  'Never use this output to fabricate vehicle mounts or wire a high-voltage system.\n',{flag:'wx'});
 return {schema:'fun.ev.v2.result',action:'prepare',status:'INPUT_PREPARED',project_id:id,external_tools_executed:0};
}
function readInput(dir){
 dirsSafe(dir);
 fileSafe(join(dir,'prototype.json'));
 let data;
 try{data=JSON.parse(readFileSync(join(dir,'prototype.json'),'utf8'));}catch{hold('BAD_JSON');}
 return validate(data);
}
function exportFiles(id){
 const {dir}=paths(id),spec=readInput(dir),dest=join(dir,'output');
 try{lstatSync(dest);hold('OUTPUT_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
 const contents=[
  ['bench-plate.FCMacro',freecad(spec,id)],
  ['bench-harness.yml',wireviz(spec,id)],
  ['bench-pinout.csv',pinout(spec)]
 ];
 mkdirSync(dest,{recursive:false});
 const files=[];
 for(const [name,content] of contents){
  writeFileSync(join(dest,name),content,{flag:'wx'});
  files.push({name,sha256:sha(content),size_bytes:Buffer.byteLength(content,'utf8')});
 }
 const input=readFileSync(join(dir,'prototype.json'),'utf8');
 const manifest={schema:'fun.ev.prototype-export.v2',scope:spec.scope,
  status:'UNQUALIFIED_NON_VEHICLE_BENCH',production_released:false,
  high_voltage_work_authorized:false,engineering_approved:false,
  external_tools_executed:0,network_calls:0,project_id:id,
  input_sha256:sha(input),files};
 writeFileSync(join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {schema:'fun.ev.v2.result',action:'export',status:manifest.status,
  project_id:id,output_dir:dest,files:files.length,external_tools_executed:0};
}
function inspect(id){
 const {dir}=paths(id);dirsSafe(dir);
 const dest=join(dir,'output');dirsSafe(dest);
 fileSafe(join(dest,'manifest.json'));
 let m;
 try{m=JSON.parse(readFileSync(join(dest,'manifest.json'),'utf8'));}catch{hold('MANIFEST_INVALID');}
 if(m.schema!=='fun.ev.prototype-export.v2'||m.project_id!==id||
    m.scope!=='UNPOWERED_NON_VEHICLE_BENCH_ONLY'||m.production_released!==false||
    m.engineering_approved!==false||m.high_voltage_work_authorized!==false||
    m.external_tools_executed!==0||!Array.isArray(m.files)||m.files.length!==3)hold('MANIFEST_INVALID');
 const expected=new Set(['bench-plate.FCMacro','bench-harness.yml','bench-pinout.csv']);
 if(m.files.some(f=>!expected.delete(f.name))||expected.size!==0)hold('MANIFEST_FILES');
 for(const f of m.files){
  fileSafe(join(dest,f.name));
  const data=readFileSync(join(dest,f.name),'utf8');
  if(sha(data)!==f.sha256||Buffer.byteLength(data,'utf8')!==f.size_bytes)hold('HASH_MISMATCH');
 }
 fileSafe(join(dir,'prototype.json'));
 if(sha(readFileSync(join(dir,'prototype.json'),'utf8'))!==m.input_sha256)hold('INPUT_CHANGED');
 return {schema:'fun.ev.v2.result',action:'inspect',status:'FILES_HASH_VERIFIED_ENGINEERING_HOLD',
  project_id:id,files_verified:3,external_tools_executed:0};
}
function main(args){
 const [cmd,id,...extra]=args;
 if(extra.length||!['prepare','export','inspect','demo'].includes(cmd))hold('USAGE');
 if(cmd==='prepare')return prepare(id);
 if(cmd==='export')return exportFiles(id);
 if(cmd==='inspect')return inspect(id);
 prepare(id);return { ...exportFiles(id),action:'demo'};
}
try{process.stdout.write(JSON.stringify(main(process.argv.slice(2)),null,2)+'\n');}
catch(e){process.stderr.write(String(e.message||e)+'\n');process.exitCode=1;}
